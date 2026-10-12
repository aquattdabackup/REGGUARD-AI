from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, now, uid


class Identity:
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Tenant:
    organization_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("organizations.id"), index=True
    )


class Organization(Identity, Base):
    __tablename__ = "organizations"
    name: Mapped[str] = mapped_column(String(160))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Membership(Identity, Tenant, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True)
    role: Mapped[str] = mapped_column(String(20))


class DemoSession(Identity, Tenant, Base):
    __tablename__ = "demo_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Case(Identity, Tenant, Base):
    __tablename__ = "cases"
    created_by: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    title: Mapped[str] = mapped_column(String(160))
    legal_entity_name: Mapped[str] = mapped_column(String(200))
    lei: Mapped[str | None] = mapped_column(String(20))
    chain_id: Mapped[int] = mapped_column(Integer, default=11155111)
    contract_address: Mapped[str] = mapped_column(String(42))
    wallet_address: Mapped[str | None] = mapped_column(String(42))
    policy_version: Mapped[str] = mapped_column(String(20), default="1.0")
    notes: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")
    mode: Mapped[str] = mapped_column(String(16), default="live")
    scenario: Mapped[str] = mapped_column(String(40), default="valid-case")
    wallet_proof: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Document(Identity, Tenant, Base):
    __tablename__ = "documents"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    storage_path: Mapped[str] = mapped_column(String(400))
    sha256: Mapped[str] = mapped_column(String(64))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    status: Mapped[str] = mapped_column(String(40), default="QUEUED")
    pages: Mapped[list] = mapped_column(JSON, default=list)
    extraction: Mapped[dict] = mapped_column(JSON, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(100))


class Policy(Identity, Base):
    __tablename__ = "policies"
    __table_args__ = (UniqueConstraint("policy_code", "version"),)
    policy_code: Mapped[str] = mapped_column(String(40))
    version: Mapped[str] = mapped_column(String(20))
    jurisdiction: Mapped[str] = mapped_column(String(200))
    rules_json: Mapped[dict] = mapped_column(JSON)
    policy_hash: Mapped[str] = mapped_column(String(64))
    effective_at: Mapped[str] = mapped_column(String(40))


class Run(Identity, Tenant, Base):
    __tablename__ = "check_runs"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id"), index=True)
    policy_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("policies.id"))
    status: Mapped[str] = mapped_column(String(40), default="QUEUED")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_code: Mapped[str | None] = mapped_column(String(100))
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    replay_of: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("check_runs.id"))
    diff: Mapped[list] = mapped_column(JSON, default=list)
    cre_evidence: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "status": "UNAVAILABLE",
            "reason": "No authenticated CRE execution artifact attached",
        },
    )


class Snapshot(Identity, Tenant, Base):
    __tablename__ = "source_snapshots"
    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("check_runs.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(40))
    source_identifier: Mapped[str] = mapped_column(String(400))
    fetched_at: Mapped[str] = mapped_column(String(40))
    normalized_data: Mapped[dict] = mapped_column(JSON)
    raw_data: Mapped[dict] = mapped_column(JSON)
    source_hash: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(16))


class Finding(Identity, Tenant, Base):
    __tablename__ = "findings"
    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("check_runs.id"), index=True
    )
    rule_code: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(30))
    severity: Mapped[str] = mapped_column(String(20))
    observed_value: Mapped[dict] = mapped_column(JSON)
    expected_value: Mapped[dict] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(String(2000))
    evidence_refs: Mapped[list] = mapped_column(JSON)
    title: Mapped[str] = mapped_column(String(200))


class Review(Identity, Tenant, Base):
    __tablename__ = "reviews"
    finding_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("findings.id"), index=True
    )
    reviewer_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    decision: Mapped[str] = mapped_column(String(40))
    explanation: Mapped[str] = mapped_column(String(2000))
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Report(Identity, Tenant, Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("run_id", "version"),)
    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("check_runs.id"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    report_hash: Mapped[str | None] = mapped_column(String(64))
    policy_hash: Mapped[str] = mapped_column(String(64))
    salt: Mapped[str | None] = mapped_column(String(64))
    record_key: Mapped[str | None] = mapped_column(String(66), unique=True)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")


class Anchor(Identity, Tenant, Base):
    __tablename__ = "chain_anchors"
    report_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("reports.id"), unique=True
    )
    record_key: Mapped[str] = mapped_column(String(66))
    chain_id: Mapped[int] = mapped_column(Integer)
    registry_address: Mapped[str] = mapped_column(String(42))
    tx_hash: Mapped[str | None] = mapped_column(String(66))
    block_number: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="QUEUED")
    raw_transaction: Mapped[str | None] = mapped_column(String(4000))


class AuditEvent(Identity, Tenant, Base):
    __tablename__ = "audit_events"
    actor_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    event_type: Mapped[str] = mapped_column(String(80))
    event_payload: Mapped[dict] = mapped_column(JSON)


class Job(Identity, Tenant, Base):
    __tablename__ = "background_jobs"
    __table_args__ = (UniqueConstraint("organization_id", "idempotency_key"),)
    job_type: Mapped[str] = mapped_column(String(30))
    reference_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    status: Mapped[str] = mapped_column(String(30), default="QUEUED", index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_owner: Mapped[str | None] = mapped_column(String(40))
    error_code: Mapped[str | None] = mapped_column(String(100))
    idempotency_key: Mapped[str] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class WalletNonce(Identity, Tenant, Base):
    __tablename__ = "wallet_nonces"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id"))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    address: Mapped[str] = mapped_column(String(42))
    message: Mapped[str] = mapped_column(String(2000))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIUsage(Identity, Tenant, Base):
    __tablename__ = "ai_usage"
    document_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("documents.id"))
    model: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="RESERVED")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[float] = mapped_column(Float)
