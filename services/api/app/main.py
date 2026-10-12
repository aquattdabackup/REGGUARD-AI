import hashlib
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.routes import router
from app.core.config import settings
from app.core.db import SessionLocal
from app.services.policies import load_policies

log = logging.getLogger("regguard.api")


@asynccontextmanager
async def lifespan(app):
    settings().validate_runtime()
    with SessionLocal() as db:
        load_policies(db)
    yield


app = FastAPI(title="RegGuard AI", version="0.1.0", lifespan=lifespan)


class RequestBodyLimit:
    """Bound chunked as well as Content-Length requests before multipart parsing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        messages, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > settings().max_upload_bytes + 1_000_000:
                response = JSONResponse(
                    {
                        "error": {
                            "code": "PAYLOAD_TOO_LARGE",
                            "message": "Upload exceeds request limit",
                        }
                    },
                    status_code=413,
                )
                return await response(scope, receive, send)
            messages.append(message)
            if not message.get("more_body", False):
                break

        async def bounded_receive():
            if messages:
                return messages.pop(0)
            return await receive()

        await self.app(scope, bounded_receive, send)


app.add_middleware(RequestBodyLimit)
rate_windows = defaultdict(deque)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = str(uuid4())
    key = hashlib.sha256(
        request.headers.get(
            "authorization", request.client.host if request.client else "unknown"
        ).encode()
    ).hexdigest()
    key = (
        ("demo:" + (request.client.host if request.client else "unknown"))
        if request.url.path == "/api/v1/demo/session"
        else "api:" + key
    )
    stamp = time.monotonic()
    window = rate_windows[key]
    while window and window[0] < stamp - 60:
        window.popleft()
    limit = 12 if request.url.path == "/api/v1/demo/session" else 180
    if len(window) >= limit:
        return JSONResponse(
            {
                "error": {
                    "code": "RATE_LIMIT",
                    "message": "Please retry shortly",
                    "request_id": request.state.request_id,
                }
            },
            status_code=429,
            headers={"Retry-After": "60"},
        )
    window.append(stamp)
    if len(rate_windows) > 10000:
        rate_windows.clear()
    try:
        content_length = int(request.headers.get("content-length", "0"))
        if content_length < 0:
            raise ValueError()
    except ValueError:
        return JSONResponse(
            {"error": {"code": "BAD_LENGTH", "message": "Invalid request length"}}, status_code=400
        )
    if content_length > settings().max_upload_bytes + 1_000_000:
        return JSONResponse(
            {"error": {"code": "PAYLOAD_TOO_LARGE", "message": "Upload exceeds request limit"}},
            status_code=413,
        )
    response = await call_next(request)
    response.headers.update(
        {
            "X-Request-ID": request.state.request_id,
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
        }
    )
    return response


@app.exception_handler(HTTPException)
async def http_error(request, error):
    return JSONResponse(
        {
            "error": {
                "code": f"HTTP_{error.status_code}",
                "message": error.detail,
                "request_id": getattr(request.state, "request_id", ""),
            }
        },
        status_code=error.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    fields = [{"location": list(e["loc"]), "message": e["msg"]} for e in error.errors()]
    return JSONResponse(
        {
            "error": {
                "code": "VALIDATION",
                "message": "Check the submitted fields",
                "fields": fields,
                "request_id": getattr(request.state, "request_id", ""),
            }
        },
        status_code=422,
    )


@app.exception_handler(Exception)
async def unexpected_error(request, error):
    log.error(
        "request_failed",
        extra={
            "request_id": getattr(request.state, "request_id", ""),
            "error_type": type(error).__name__,
        },
    )
    return JSONResponse(
        {
            "error": {
                "code": "INTERNAL",
                "message": "The request could not be completed",
                "request_id": getattr(request.state, "request_id", ""),
            }
        },
        status_code=500,
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "regguard-api"}


@app.get("/ready")
def ready():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ready", "mode": "fixture" if settings().demo_mode else "live"}
    except Exception as error:
        raise HTTPException(503, "Database unavailable") from error


app.include_router(router)

# CORS wraps request limits/errors so browsers can display their actual status.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings().app_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)
