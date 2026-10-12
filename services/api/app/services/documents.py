import hashlib
import io
import json
import subprocess
import sys
import zipfile
from pathlib import PurePosixPath

import httpx

from app.core.config import settings

MIMES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def validate_upload(filename, mime, data):
    suffix = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
    if suffix not in MIMES or mime != MIMES[suffix]:
        raise ValueError("UNSUPPORTED_FILE_TYPE")
    if not data or len(data) > settings().max_upload_bytes:
        raise ValueError("FILE_SIZE_LIMIT")
    if suffix == ".pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
            raise ValueError("INVALID_PDF_SIGNATURE")
    else:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = archive.infolist()
                if len(members) > 500 or sum(x.file_size for x in members) > 30_000_000:
                    raise ValueError("DOCX_RESOURCE_LIMIT")
                if (
                    "word/document.xml" not in archive.namelist()
                    or "[Content_Types].xml" not in archive.namelist()
                ):
                    raise ValueError("INVALID_DOCX")
                for entry in members:
                    if (
                        ".." in PurePosixPath(entry.filename).parts
                        or entry.filename.startswith("/")
                        or "vbaProject" in entry.filename
                    ):
                        raise ValueError("UNSAFE_DOCX")
                    if entry.file_size > max(1, entry.compress_size) * 200:
                        raise ValueError("DOCX_COMPRESSION_LIMIT")
                    if entry.filename.endswith(
                        ".rels"
                    ) and b'TargetMode="External"' in archive.read(entry):
                        raise ValueError("EXTERNAL_DOCX_RELATIONSHIP")
        except zipfile.BadZipFile as error:
            raise ValueError("INVALID_DOCX") from error
    return suffix


class Storage:
    def save(self, path, data, mime):
        if settings().demo_mode:
            target = settings().data_dir / "uploads" / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        else:
            with httpx.Client(timeout=20) as client:
                response = client.post(
                    self.url(path),
                    content=data,
                    headers={**self.headers(), "Content-Type": mime, "x-upsert": "false"},
                )
                response.raise_for_status()

    def read(self, path):
        if settings().demo_mode:
            root = (settings().data_dir / "uploads").resolve()
            target = (root / path).resolve()
            if not target.is_relative_to(root):
                raise ValueError("INVALID_STORAGE_PATH")
            return target.read_bytes()
        with httpx.Client(timeout=20) as client:
            response = client.get(self.url(path), headers=self.headers())
            response.raise_for_status()
            return response.content

    def url(self, path):
        return (
            settings().supabase_url.rstrip("/")
            + "/storage/v1/object/"
            + settings().supabase_storage_bucket
            + "/"
            + path
        )

    def headers(self):
        key = settings().supabase_secret_key or settings().supabase_service_role_key
        if not key:
            raise ValueError("STORAGE_NOT_CONFIGURED")
        headers = {"apikey": key}
        # Publishable/secret API keys are not JWTs. Legacy service-role JWTs also
        # require the Authorization header; opaque sb_secret keys do not.
        if not key.startswith("sb_secret_"):
            headers["Authorization"] = "Bearer " + key
        return headers

    def signed_url(self, path):
        with httpx.Client(timeout=10) as client:
            url = (
                settings().supabase_url.rstrip("/")
                + "/storage/v1/object/sign/"
                + settings().supabase_storage_bucket
                + "/"
                + path
            )
            response = client.post(url, json={"expiresIn": 60}, headers=self.headers())
            response.raise_for_status()
            return (
                settings().supabase_url.rstrip("/") + "/storage/v1" + response.json()["signedURL"]
            )


def extract_pages(data, filename, mime):
    validate_upload(filename, mime, data)
    # Untrusted parsers run in a separate, time-limited process. No user path is executed.
    result = subprocess.run(
        [sys.executable, "-m", "app.services.parse_document", mime],
        input=data,
        capture_output=True,
        timeout=20,
        check=False,
    )
    if result.returncode:
        raise ValueError("MALFORMED_OR_UNSUPPORTED_DOCUMENT")
    output = json.loads(result.stdout)
    if output.get("error"):
        raise ValueError(output["error"])
    return output["pages"]


def file_hash(data):
    return hashlib.sha256(data).hexdigest()
