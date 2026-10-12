import time

import httpx

from app.core.db import iso
from app.services.integrity import digest


def source(provider, identifier, data, raw, mode="live", error=None, fetched_at=None):
    normalized = {"status": "unavailable" if error else "ok", "error": error, **data}
    result = {
        "provider": provider,
        "source_identifier": identifier,
        "fetched_at": fetched_at or iso(),
        "normalized_data": normalized,
        "raw_data": raw,
        "mode": mode,
    }
    result["source_hash"] = digest(result)
    return result


class GLEIFConnector:
    def __init__(self, client=None):
        self.client = client

    def fetch(self, lei):
        identifier = "https://api.gleif.org/api/v1/lei-records/" + (lei or "")
        if not lei:
            return source("GLEIF", identifier, {}, {}, error="LEI_MISSING")
        for attempt in range(2):
            try:
                with (
                    httpx.Client(timeout=12, follow_redirects=False)
                    if self.client is None
                    else _borrow(self.client) as client
                ):
                    response = client.get(
                        identifier, headers={"Accept": "application/vnd.api+json"}
                    )
                if response.status_code == 404:
                    return source("GLEIF", identifier, {"found": False}, {}, error="NOT_FOUND")
                response.raise_for_status()
                raw = response.json()
                attrs = raw["data"]["attributes"]
                entity, registration = attrs["entity"], attrs["registration"]
                if attrs.get("lei") != lei:
                    raise ValueError("LEI_RESPONSE_MISMATCH")
                return source(
                    "GLEIF",
                    identifier,
                    {
                        "found": True,
                        "lei": attrs["lei"],
                        "legal_name": entity["legalName"]["name"],
                        "entity_status": entity.get("status"),
                        "registration_status": registration.get("status"),
                        "registered_address": entity.get("legalAddress"),
                        "last_update": registration.get("lastUpdateDate"),
                    },
                    raw,
                )
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                if attempt == 0:
                    time.sleep(0.25)
        return source("GLEIF", identifier, {}, {}, error="GLEIF_UNAVAILABLE")


class _borrow:
    def __init__(self, client):
        self.client = client

    def __enter__(self):
        return self.client

    def __exit__(self, *args):
        pass
