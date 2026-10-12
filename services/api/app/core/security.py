import hashlib
from dataclasses import dataclass
from datetime import UTC
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import db_session, now
from app.models.entities import DemoSession, Membership

bearer = HTTPBearer(auto_error=False)
WRITE = {"owner", "admin", "analyst"}
REVIEW = {"owner", "admin", "reviewer"}
FINALIZE = REVIEW


@dataclass
class Actor:
    user_id: str
    organization_id: str
    role: str
    mode: str


@lru_cache
def jwks():
    return jwt.PyJWKClient(
        settings().supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json",
        cache_keys=True,
        timeout=10,
    )


def actor(
    request: Request,
    auth: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(db_session),
):
    if not auth:
        raise HTTPException(401, "Sign in required")
    token = auth.credentials
    if token.startswith("demo_"):
        if not settings().demo_mode:
            raise HTTPException(401, "Demo authentication is disabled")
        session = db.scalar(
            select(DemoSession).where(
                DemoSession.token_hash == hashlib.sha256(token.encode()).hexdigest()
            )
        )
        if not session or session.expires_at.replace(tzinfo=UTC) <= now():
            raise HTTPException(401, "Demo session expired")
        user_id, org_id, mode = session.user_id, session.organization_id, "fixture"
    else:
        try:
            key = jwks().get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                issuer=settings().supabase_url.rstrip("/") + "/auth/v1",
                options={"require": ["exp", "sub", "iat", "aud", "iss"]},
            )
            user_id = str(UUID(claims["sub"]))
        except Exception as error:
            raise HTTPException(401, "Invalid or expired session") from error
        membership = db.scalar(
            select(Membership).where(Membership.user_id == user_id).order_by(Membership.created_at)
        )
        if not membership:
            # A newly verified identity may bootstrap its own organization through /organization.
            if not (request.url.path == "/api/v1/me" and request.method == "GET") and not (
                request.url.path == "/api/v1/organization" and request.method == "POST"
            ):
                raise HTTPException(403, "Create an organization before accessing its resources")
            return Actor(user_id, "", "unassigned", "live")
        org_id, mode = membership.organization_id, "live"
    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == user_id, Membership.organization_id == org_id
        )
    )
    if not membership:
        raise HTTPException(403, "Organization membership required")
    return Actor(user_id, org_id, membership.role, mode)


def require_role(who: Actor, roles: set[str]):
    if who.role not in roles:
        raise HTTPException(403, "Your role does not permit this action")


def tenant_get(db, model, identifier, who, lock=False):
    try:
        identifier = str(UUID(identifier))
    except ValueError as error:
        raise HTTPException(404, "Resource not found") from error
    stmt = select(model).where(model.id == identifier, model.organization_id == who.organization_id)
    if lock:
        stmt = stmt.with_for_update()
    row = db.scalar(stmt)
    if row is None:
        raise HTTPException(404, "Resource not found")
    return row
