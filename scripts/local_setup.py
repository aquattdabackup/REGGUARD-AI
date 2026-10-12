"""Loopback-only, write-only OpenAI setup. Does not make API requests."""

import argparse
import html
import os
import re
import secrets
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parents[1]


def save_key(root: Path, value: str):
    if not re.fullmatch(r"sk-[A-Za-z0-9_-]{16,250}", value):
        raise ValueError("Invalid API key format")
    target = root / ".env"
    if target.is_symlink():
        raise ValueError("Linked environment file refused")
    current = target.read_text(encoding="utf-8-sig") if target.exists() else ""
    lines = [
        line
        for line in current.splitlines()
        if not re.match(r"^\s*(?:export\s+)?OPENAI_API_KEY\s*=", line)
    ]
    lines.append("OPENAI_API_KEY=" + value)
    private = root / ".data"
    private.mkdir(exist_ok=True)
    fd, name = tempfile.mkstemp(prefix="setup-", dir=private)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as file:
            file.write("\n".join(lines) + "\n")
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def make_server(root: Path = ROOT, port: int = 8765):
    csrf = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def local_host(self):
            return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

        def respond(self, code, body):
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            )
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.local_host() or self.path != "/":
                self.respond(404, "Not found")
                return
            self.respond(
                200,
                f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RegGuard / Local OpenAI setup</title>
<style>body{{font:16px/1.6 system-ui;background:#f5f7fb;color:#162238;margin:0;padding:24px}}main{{max-width:640px;margin:32px auto;background:white;padding:32px;border:1px solid #dce3ed;border-radius:16px}}h1{{font-size:28px}}p,small{{color:#52657e}}label{{display:block;font-weight:600}}input{{box-sizing:border-box;width:100%;padding:13px;margin:12px 0 18px;border:1px solid #8390a3;border-radius:6px}}button{{background:#2563eb;color:white;border:0;border-radius:6px;padding:13px 20px;font-size:16px;cursor:pointer}}a{{color:#1d4ed8}}input:focus,button:focus{{outline:3px solid #93b5ff;outline-offset:2px}}small{{display:block;margin-top:20px}}</style>
<main><p>REGGUARD AI / THIS COMPUTER ONLY</p><h1>Connect OpenAI when you are ready.</h1>
<p>Save your key to the backend's ignored <code>.env</code> file. The key is never returned to the page or sent to an external service by this form. Saving does not run or charge an AI request.</p>
<form method="post" action="/save"><input type="hidden" name="csrf" value="{html.escape(csrf)}"><label for="key">OpenAI API key</label><input id="key" name="key" type="password" autocomplete="off" spellcheck="false" required maxlength="253" placeholder="sk-..."><button type="submit">Save key on this computer</button></form>
<p><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Open OpenAI API keys</a> &middot; <a href="https://railway.com/dashboard" target="_blank" rel="noreferrer">Open Railway dashboard</a></p>
<small>This utility does not encrypt the local file. This project is in OneDrive and may be synchronized. Keep the folder private. For the hosted worker, enter OPENAI_API_KEY in Railway Variables; this form does not update Railway.</small>
<small>After saving, restart the local API and worker. Demo mode continues to use fixtures. Live extraction also requires Supabase configuration. Existing model and budget settings are preserved.</small></main></html>''',
            )

        def do_POST(self):
            origin = f"http://127.0.0.1:{self.server.server_port}"
            if (
                not self.local_host()
                or self.path != "/save"
                or self.headers.get("Origin") != origin
            ):
                self.respond(
                    403, "Request refused. Open the local setup page directly."
                )
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 4096 or self.headers.get("Transfer-Encoding"):
                    raise ValueError("Invalid request size")
                if (
                    self.headers.get("Content-Type", "").split(";")[0]
                    != "application/x-www-form-urlencoded"
                ):
                    raise ValueError("Unsupported form format")
                data = parse_qs(
                    self.rfile.read(length).decode("utf-8"), strict_parsing=True
                )
                if not secrets.compare_digest(data.get("csrf", [""])[0], csrf):
                    self.respond(403, "Invalid form. Reload the setup page.")
                    return
                save_key(root, data.get("key", [""])[0])
            except (ValueError, UnicodeError):
                self.respond(
                    400, "Invalid input. No key saved. Reload the form and try again."
                )
                return
            except OSError:
                self.respond(
                    500, "Could not save configuration. Check local file permissions."
                )
                return
            self.respond(
                200,
                '<!doctype html><html lang="en"><meta charset="utf-8"><title>Configuration saved</title><h1>OpenAI key saved locally.</h1><p>No API request was made. Restart the API and worker to load it. Demo mode remains simulated.</p><p>For hosting, also set OPENAI_API_KEY in Railway Variables.</p><a href="/">Return to setup</a></html>',
            )

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with make_server(port=args.port) as server:
        print(f"Local OpenAI setup: http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()
