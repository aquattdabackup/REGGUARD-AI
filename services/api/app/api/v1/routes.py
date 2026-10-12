import hashlib
import json
import secrets
from datetime import UTC, timedelta
from typing import Annotated
from uuid import UUID

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import db_session, iso, now, uid
from app.core.security import FINALIZE, REVIEW, WRITE, Actor, actor, require_role, tenant_get
from app.models.entities import (
    AIUsage,
    Anchor,
    AuditEvent,
    Case,
    DemoSession,
    Document,
    Finding,
    Job,
    Membership,
    Organization,
    Policy,
    Report,
    Review,
    Run,
    Snapshot,
    WalletNonce,
)
from app.schemas.domain import AnalyzeInput, CaseCreate, CasePatch, ReviewInput, StrictModel
from app.services.demo import seed_cases
from app.services.documents import Storage, file_hash, validate_upload
from app.services.integrity import verify_package
from app.services.jobs import enqueue
from app.services.policies import get_policy
from app.services.reports import finalize, render_pdf, row_dict, verification_package

router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(db_session)]
User = Annotated[Actor, Depends(actor)]
ACTIVE = ("QUEUED", "COLLECTING", "EXTRACTING", "EVALUATING")


def audit(db, who, event, payload):
    db.add(
        AuditEvent(
            organization_id=who.organization_id,
            actor_id=who.user_id,
            event_type=event,
            event_payload=payload,
        )
    )


@router.get("/config")
def config():
    return {
        "demo_mode": settings().demo_mode,
        "auth_provider": "demo" if settings().demo_mode else "supabase",
    }


@router.post("/demo/session", status_code=201)
def demo_session(db: DB):
    if not settings().demo_mode:
        raise HTTPException(404, "Not found")
    org, user = Organization(id=uid(), name="RegGuard Sandbox"), uid()
    db.add(org)
    db.flush()
    db.add(Membership(organization_id=org.id, user_id=user, role="owner"))
    token = "demo_" + secrets.token_urlsafe(32)
    db.add(
        DemoSession(
            organization_id=org.id,
            user_id=user,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expires_at=now() + timedelta(hours=8),
        )
    )
    db.commit()
    seed_cases(db, org.id, user)
    return {
        "access_token": token,
        "expires_in": 28800,
        "mode": "fixture",
        "organization_id": org.id,
    }


@router.post("/logout", status_code=204)
def logout(db: DB, who: User):
    if who.mode == "fixture":
        for session in db.scalars(select(DemoSession).where(DemoSession.user_id == who.user_id)):
            db.delete(session)
        db.commit()
    return Response(status_code=204)


class OrganizationInput(StrictModel):
    name: str = Field(min_length=2, max_length=160)


@router.post("/organization", status_code=201)
def create_organization(body: OrganizationInput, db: DB, who: User):
    if who.organization_id:
        raise HTTPException(409, "Organization already assigned")
    org = Organization(id=uid(), name=body.name)
    db.add(org)
    db.flush()
    db.add(Membership(organization_id=org.id, user_id=who.user_id, role="owner"))
    db.commit()
    return row_dict(org)


@router.get("/me")
def me(db: DB, who: User):
    organization = db.get(Organization, who.organization_id) if who.organization_id else None
    members = (
        db.scalars(
            select(Membership).where(Membership.organization_id == who.organization_id)
        ).all()
        if who.organization_id
        else []
    )
    total = (
        0
        if not who.organization_id
        else db.scalar(
            select(func.coalesce(func.sum(AIUsage.estimated_cost), 0)).where(
                AIUsage.organization_id == who.organization_id,
                AIUsage.created_at
                >= now().replace(day=1, hour=0, minute=0, second=0, microsecond=0),
            )
        )
    )
    return {
        "user_id": who.user_id,
        "organization": row_dict(organization) if organization else None,
        "role": who.role,
        "mode": who.mode,
        "members": [row_dict(m) for m in members],
        "ai_usage_reserved_usd": total,
        "ai_budget_usd": settings().ai_monthly_budget_usd,
        "integrations": {
            "Supabase": "fixture" if who.mode == "fixture" else "configured",
            "OpenAI": "configured" if settings().openai_api_key else "unavailable",
            "GLEIF": "fixture" if who.mode == "fixture" else "live on request",
            "Sepolia RPC": "configured" if settings().evm_rpc_url else "unavailable",
            "AuditRegistry": "configured" if settings().audit_registry_address else "unavailable",
            "CRE": "unavailable",
        },
        "retention": "No automatic deletion is enabled. Demo sessions expire after 8 hours; evidence remains until the local data directory is removed. Production retention requires an organization policy.",
    }


@router.patch("/organization")
def update_organization(body: OrganizationInput, db: DB, who: User):
    require_role(who, {"owner", "admin"})
    org = db.get(Organization, who.organization_id)
    org.name = body.name
    audit(db, who, "organization.updated", {"name": body.name})
    db.commit()
    return row_dict(org)


@router.get("/cases")
def list_cases(
    db: DB,
    who: User,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str = Query("", max_length=100),
):
    stmt = select(Case).where(Case.organization_id == who.organization_id)
    if q:
        stmt = stmt.where(Case.title.icontains(q, autoescape=True))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    return {
        "items": [
            row_dict(c)
            for c in db.scalars(stmt.order_by(Case.created_at.desc()).limit(limit).offset(offset))
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/cases", status_code=201)
def create_case(body: CaseCreate, db: DB, who: User):
    require_role(who, WRITE)
    case = Case(
        **body.model_dump(),
        organization_id=who.organization_id,
        created_by=who.user_id,
        mode=who.mode,
    )
    db.add(case)
    db.flush()
    audit(db, who, "case.created", {"case_id": case.id})
    db.commit()
    return row_dict(case)


@router.get("/cases/{case_id}")
def get_case(case_id: str, db: DB, who: User):
    case = tenant_get(db, Case, case_id, who)
    runs = db.scalars(
        select(Run).where(Run.case_id == case.id).order_by(Run.created_at.desc()).limit(50)
    ).all()
    documents = db.scalars(
        select(Document).where(Document.case_id == case.id).order_by(Document.created_at)
    ).all()
    reports = db.scalars(select(Report).where(Report.run_id.in_([r.id for r in runs]))).all()
    return {
        **row_dict(case),
        "documents": [row_dict(d, exclude=("storage_path",)) for d in documents],
        "runs": [row_dict(r, exclude=("snapshot",)) for r in runs],
        "reports": [row_dict(r, exclude=("payload", "salt")) for r in reports],
    }


@router.patch("/cases/{case_id}")
def patch_case(case_id: str, body: CasePatch, db: DB, who: User):
    require_role(who, WRITE)
    case = tenant_get(db, Case, case_id, who, lock=True)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(case, key, value)
    audit(db, who, "case.updated", {"case_id": case.id, "fields": list(body.model_fields_set)})
    db.commit()
    return row_dict(case)


@router.post("/cases/{case_id}/documents", status_code=202)
async def upload(case_id: str, db: DB, who: User, file: UploadFile = File(...)):
    require_role(who, WRITE)
    case = tenant_get(db, Case, case_id, who, lock=True)
    if case.status in ACTIVE:
        raise HTTPException(409, "Wait for the active evaluation before adding evidence")
    count = db.scalar(select(func.count(Document.id)).where(Document.case_id == case.id))
    if count >= settings().max_documents_per_case:
        raise HTTPException(422, "Document quota reached")
    data = await file.read(settings().max_upload_bytes + 1)
    filename = (file.filename or "evidence").replace("\\", "/").split("/")[-1][:180]
    try:
        suffix = validate_upload(filename, file.content_type, data)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    doc_id = uid()
    path = f"{who.organization_id}/{case.id}/{doc_id}{suffix}"
    try:
        Storage().save(path, data, file.content_type)
    except Exception as error:
        raise HTTPException(503, "Private storage unavailable") from error
    document = Document(
        id=doc_id,
        organization_id=who.organization_id,
        case_id=case.id,
        filename=filename,
        storage_path=path,
        sha256=file_hash(data),
        mime_type=file.content_type,
        size_bytes=len(data),
        uploaded_by=who.user_id,
    )
    db.add(document)
    db.flush()
    enqueue(db, who.organization_id, "document", doc_id, "document:" + doc_id)
    audit(
        db,
        who,
        "document.uploaded",
        {"case_id": case.id, "document_id": doc_id, "sha256": document.sha256},
    )
    db.commit()
    return row_dict(document, exclude=("storage_path",))


@router.get("/cases/{case_id}/documents")
def list_documents(case_id: str, db: DB, who: User):
    tenant_get(db, Case, case_id, who)
    return [
        row_dict(d, exclude=("storage_path",))
        for d in db.scalars(select(Document).where(Document.case_id == case_id))
    ]


@router.get("/documents/{document_id}/content")
def document_content(document_id: str, db: DB, who: User):
    document = tenant_get(db, Document, document_id, who)
    data = Storage().read(document.storage_path)
    if file_hash(data) != document.sha256:
        raise HTTPException(409, "Stored document integrity mismatch")
    return Response(
        data,
        media_type=document.mime_type,
        headers={"Content-Disposition": "inline", "Cache-Control": "private, no-store"},
    )


@router.post("/documents/{document_id}/signed-url")
def signed_document(document_id: str, db: DB, who: User):
    document = tenant_get(db, Document, document_id, who)
    if settings().demo_mode:
        raise HTTPException(409, "Use authenticated content download for local documents")
    return {"url": Storage().signed_url(document.storage_path), "expires_in": 60}


def queue_run(case_id, body, db, who, key):
    require_role(who, WRITE)
    case = tenant_get(db, Case, case_id, who, lock=True)
    if not key or len(key) > 100:
        raise HTTPException(422, "Idempotency-Key header is required (1-100 characters)")
    scoped_key = "evaluate:" + key
    request_key = (
        scoped_key
        + ":"
        + hashlib.sha256(
            json.dumps(
                {
                    **body.model_dump(),
                    "case_id": case.id,
                    "scenario": body.scenario or case.scenario,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
    )
    existing = db.scalar(
        select(Job).where(
            Job.organization_id == who.organization_id,
            (Job.idempotency_key == scoped_key)
            | Job.idempotency_key.startswith(scoped_key + ":", autoescape=True),
        )
    )
    if existing:
        if existing.idempotency_key not in (scoped_key, request_key):
            raise HTTPException(409, "Idempotency key was used for a different evaluation request")
        prior = tenant_get(db, Run, existing.reference_id, who)
        if (
            prior.case_id != case.id
            or prior.policy_id != get_policy(db, body.policy_version).id
            or prior.replay_of != body.replay_run_id
        ):
            raise HTTPException(409, "Idempotency key was used for a different evaluation request")
        return {"run_id": prior.id, "job_id": existing.id, "status": prior.status}
    if case.status in ACTIVE:
        raise HTTPException(409, "An evaluation is already active")
    if body.scenario and who.mode != "fixture":
        raise HTTPException(422, "Fixture scenarios are prohibited in live mode")
    if body.replay_run_id:
        original = tenant_get(db, Run, body.replay_run_id, who)
        if original.case_id != case.id or not original.completed_at:
            raise HTTPException(422, "Replay requires a completed run from this case")
    policy = get_policy(db, body.policy_version)
    run = Run(
        organization_id=who.organization_id,
        case_id=case.id,
        policy_id=policy.id,
        replay_of=body.replay_run_id,
        snapshot={"scenario": body.scenario or case.scenario},
    )
    db.add(run)
    db.flush()
    job = enqueue(db, who.organization_id, "evaluate", run.id, request_key)
    case.status = "QUEUED"
    audit(
        db,
        who,
        "evaluation.queued",
        {"case_id": case.id, "run_id": run.id, "replay_of": body.replay_run_id},
    )
    db.commit()
    return {"run_id": run.id, "job_id": job.id, "status": "QUEUED"}


@router.post("/cases/{case_id}/analyze", status_code=202)
@router.post("/cases/{case_id}/recheck", status_code=202)
def analyze(
    case_id: str, body: AnalyzeInput, db: DB, who: User, idempotency_key: str | None = Header(None)
):
    return queue_run(case_id, body, db, who, idempotency_key)


@router.get("/runs/{run_id}")
def get_run(run_id: str, db: DB, who: User):
    run = tenant_get(db, Run, run_id, who)
    findings = db.scalars(
        select(Finding).where(Finding.run_id == run.id).order_by(Finding.rule_code)
    ).all()
    reviews = db.scalars(
        select(Review)
        .where(Review.finding_id.in_([f.id for f in findings]))
        .order_by(Review.created_at)
    ).all()
    sources = db.scalars(select(Snapshot).where(Snapshot.run_id == run.id)).all()
    policy = db.get(Policy, run.policy_id)
    return {
        **row_dict(run),
        "findings": [row_dict(f) for f in findings],
        "reviews": [row_dict(r) for r in reviews],
        "sources": [row_dict(s) for s in sources],
        "policy": row_dict(policy),
    }


@router.get("/runs/{run_id}/findings")
def findings(run_id: str, db: DB, who: User):
    tenant_get(db, Run, run_id, who)
    return [
        row_dict(f)
        for f in db.scalars(
            select(Finding).where(Finding.run_id == run_id).order_by(Finding.rule_code)
        )
    ]


@router.post("/findings/{finding_id}/review", status_code=201)
def review(finding_id: str, body: ReviewInput, db: DB, who: User):
    require_role(who, REVIEW)
    finding = tenant_get(db, Finding, finding_id, who)
    review = Review(
        organization_id=who.organization_id,
        finding_id=finding.id,
        reviewer_id=who.user_id,
        **body.model_dump(),
    )
    db.add(review)
    run = db.get(Run, finding.run_id)
    audit(
        db,
        who,
        "finding.reviewed",
        {"case_id": run.case_id, "finding_id": finding.id, "decision": body.decision},
    )
    db.commit()
    return row_dict(review)


@router.get("/policies")
def policies(db: DB, who: User):
    return [row_dict(p) for p in db.scalars(select(Policy).order_by(Policy.version))]


@router.get("/policies/{policy_id}")
def policy(policy_id: str, db: DB, who: User):
    try:
        result = db.get(Policy, str(UUID(policy_id)))
    except ValueError:
        result = None
    if not result:
        raise HTTPException(404, "Policy not found")
    return row_dict(result)


@router.get("/reports")
def reports(db: DB, who: User, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    return [
        row_dict(r, exclude=("payload", "salt"))
        for r in db.scalars(
            select(Report)
            .where(Report.organization_id == who.organization_id)
            .order_by(Report.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ]


@router.get("/reports/{report_id}")
def get_report(report_id: str, db: DB, who: User):
    report = tenant_get(db, Report, report_id, who)
    return {
        **row_dict(report, exclude=("salt",)),
        "anchor": verification_package(db, report)["anchor"],
    }


@router.post("/reports/{report_id}/finalize")
def finalize_report(report_id: str, db: DB, who: User):
    require_role(who, FINALIZE)
    report = tenant_get(db, Report, report_id, who, lock=True)
    if report.finalized_at:
        return row_dict(report, exclude=("salt",))
    run = db.get(Run, report.run_id)
    if not run.completed_at:
        raise HTTPException(409, "Evaluation not complete")
    finalize(
        db, report, run, db.get(Policy, run.policy_id), db.get(Organization, who.organization_id)
    )
    audit(
        db,
        who,
        "report.finalized",
        {"case_id": run.case_id, "report_id": report.id, "commitment": report.report_hash},
    )
    db.commit()
    return row_dict(report, exclude=("salt",))


@router.get("/reports/{report_id}/download")
def download(
    report_id: str, db: DB, who: User, format: str = Query("json", pattern="^(json|pdf)$")
):
    import json

    report = tenant_get(db, Report, report_id, who)
    if not report.finalized_at:
        raise HTTPException(409, "Finalize the report before exporting")
    package = verification_package(db, report)
    data = (
        render_pdf(package)
        if format == "pdf"
        else json.dumps(package, ensure_ascii=False, indent=2).encode()
    )
    return Response(
        data,
        media_type="application/pdf" if format == "pdf" else "application/json",
        headers={
            "Content-Disposition": f'attachment; filename="regguard-{report.id}.{format}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/reports/{report_id}/anchor", status_code=202)
def anchor_report(report_id: str, db: DB, who: User):
    require_role(who, FINALIZE)
    report = tenant_get(db, Report, report_id, who, lock=True)
    if not report.finalized_at:
        raise HTTPException(409, "Finalize first")
    cfg = settings()
    if not all([cfg.evm_rpc_url, cfg.audit_registry_address, cfg.anchor_signer_private_key]):
        raise HTTPException(
            503, "Sepolia RPC, registry, and authorized funded signer must be configured"
        )
    anchor = db.scalar(select(Anchor).where(Anchor.report_id == report.id))
    if not anchor:
        anchor = Anchor(
            organization_id=who.organization_id,
            report_id=report.id,
            record_key=report.record_key,
            chain_id=cfg.evm_chain_id,
            registry_address=cfg.audit_registry_address,
        )
        db.add(anchor)
        db.flush()
        enqueue(db, who.organization_id, "anchor", anchor.id, "anchor:" + report.id)
        audit(
            db,
            who,
            "anchor.queued",
            {"report_id": report.id, "case_id": db.get(Run, report.run_id).case_id},
        )
        db.commit()
    return row_dict(anchor, exclude=("raw_transaction",))


@router.get("/reports/{report_id}/verify")
def verify_report(report_id: str, db: DB, who: User):
    from app.services.blockchain import verify_onchain

    report = tenant_get(db, Report, report_id, who)
    if not report.finalized_at:
        raise HTTPException(409, "Report is not finalized")
    package = verification_package(db, report)
    local = verify_package(package)
    if not local["integrity_valid"] or not package["anchor"]:
        return local
    return {**local, **verify_onchain(package)}


@router.get("/cases/{case_id}/history")
def history(case_id: str, db: DB, who: User):
    tenant_get(db, Case, case_id, who)
    # JSON filtering occurs inside the tenant boundary; no cross-tenant events are loaded.
    events = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.organization_id == who.organization_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(500)
    ).all()
    return [row_dict(e) for e in events if e.event_payload.get("case_id") == case_id][:100]


@router.get("/audit-events")
def audit_events(
    db: DB, who: User, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)
):
    return [
        row_dict(e)
        for e in db.scalars(
            select(AuditEvent)
            .where(AuditEvent.organization_id == who.organization_id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ]


@router.get("/dashboard")
def dashboard(db: DB, who: User):
    cases = db.scalars(select(Case).where(Case.organization_id == who.organization_id)).all()
    latest = []
    for case in cases:
        run = db.scalar(
            select(Run)
            .where(Run.case_id == case.id, Run.completed_at.is_not(None))
            .order_by(Run.completed_at.desc())
            .limit(1)
        )
        if run:
            latest.append(run.id)
    counts = dict(
        db.execute(
            select(Finding.status, func.count())
            .where(Finding.run_id.in_(latest))
            .group_by(Finding.status)
        ).all()
    )
    finalized = db.scalar(
        select(func.count(Report.id)).where(
            Report.organization_id == who.organization_id, Report.finalized_at.is_not(None)
        )
    )
    alerts = db.scalar(
        select(func.count(AuditEvent.id)).where(
            AuditEvent.organization_id == who.organization_id,
            AuditEvent.event_type == "source.changed",
        )
    )
    return {
        "total_cases": len(cases),
        "evaluated_cases": len(latest),
        "findings": counts,
        "finalized_reports": finalized,
        "source_alerts": alerts,
        "mode": who.mode,
    }


class WalletRequest(StrictModel):
    address: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")


class WalletSignature(StrictModel):
    nonce_id: str
    signature: str = Field(pattern=r"^0x[a-fA-F0-9]{130}$")


@router.post("/cases/{case_id}/wallet/nonce")
def wallet_nonce(case_id: str, body: WalletRequest, db: DB, who: User):
    require_role(who, WRITE)
    case = tenant_get(db, Case, case_id, who)
    if not case.wallet_address or body.address.lower() != case.wallet_address.lower():
        raise HTTPException(422, "Address must match the case wallet")
    nonce = secrets.token_hex(32)
    expires = now() + timedelta(minutes=5)
    message = f"RegGuard wallet possession proof\nDomain: {settings().app_origin}\nChain ID: {case.chain_id}\nOrganization: {who.organization_id}\nCase: {case.id}\nAddress: {body.address.lower()}\nNonce: {nonce}\nExpires: {iso(expires)}\nThis proves key possession, not legal authority."
    record = WalletNonce(
        organization_id=who.organization_id,
        case_id=case.id,
        user_id=who.user_id,
        address=body.address.lower(),
        message=message,
        expires_at=expires,
    )
    db.add(record)
    db.commit()
    return {"nonce_id": record.id, "message": message, "expires_at": iso(expires)}


@router.post("/cases/{case_id}/wallet/verify")
def wallet_verify(case_id: str, body: WalletSignature, db: DB, who: User):
    require_role(who, WRITE)
    case = tenant_get(db, Case, case_id, who, lock=True)
    nonce = tenant_get(db, WalletNonce, body.nonce_id, who, lock=True)
    if (
        nonce.case_id != case.id
        or nonce.user_id != who.user_id
        or nonce.consumed_at
        or nonce.expires_at.replace(tzinfo=UTC) <= now()
    ):
        raise HTTPException(422, "Nonce expired, consumed, or bound to another request")
    try:
        signer = Account.recover_message(
            encode_defunct(text=nonce.message), signature=body.signature
        )
    except Exception as error:
        raise HTTPException(422, "Invalid wallet signature") from error
    if signer.lower() != nonce.address:
        raise HTTPException(422, "Wallet signer mismatch")
    nonce.consumed_at = now()
    case.wallet_proof = {
        "verified": True,
        "address": signer,
        "verified_at": iso(),
        "expires_at": iso(now() + timedelta(hours=24)),
        "message": nonce.message,
        "signature": body.signature,
    }
    audit(db, who, "wallet.verified", {"case_id": case.id, "address": signer})
    db.commit()
    return case.wallet_proof
