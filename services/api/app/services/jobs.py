from datetime import timedelta

from sqlalchemy import and_, or_, select, update

from app.core.config import settings
from app.core.db import SessionLocal, now, uid
from app.models.entities import Anchor, Case, Document, Job, Run


def enqueue(db, org_id, job_type, reference_id, key):
    existing = db.scalar(
        select(Job).where(Job.organization_id == org_id, Job.idempotency_key == key)
    )
    if existing:
        return existing
    job = Job(
        organization_id=org_id, job_type=job_type, reference_id=reference_id, idempotency_key=key
    )
    db.add(job)
    db.flush()
    return job


def fail_reference(db, job, code):
    if job.job_type == "evaluate":
        run = db.get(Run, job.reference_id)
        if run and not run.completed_at:
            run.status, run.failure_code = "FAILED", code
            db.get(Case, run.case_id).status = "FAILED"
    elif job.job_type == "document":
        document = db.get(Document, job.reference_id)
        if document and document.status not in ("READY", "FAILED"):
            document.status, document.error_code = "FAILED", code
    elif job.job_type == "anchor":
        anchor = db.get(Anchor, job.reference_id)
        if anchor and anchor.status != "CONFIRMED":
            anchor.status = "FAILED"


def claim():
    with SessionLocal() as db:
        expired = and_(Job.status == "RUNNING", Job.lease_until < now())
        ready = and_(Job.status == "QUEUED", Job.next_attempt_at <= now())
        for abandoned in db.scalars(
            select(Job).where(expired, Job.attempt_count >= 3).with_for_update(skip_locked=True)
        ):
            abandoned.status = "FAILED"
            abandoned.error_code = "WORKER_LEASE_EXHAUSTED"
            abandoned.lease_until = None
            fail_reference(db, abandoned, abandoned.error_code)
        db.commit()
        job = db.scalar(
            select(Job)
            .where(or_(ready, expired), Job.attempt_count < 3)
            .order_by(Job.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return None
        owner = uid()
        # Conditional UPDATE also fences competing SQLite demo workers.
        result = db.execute(
            update(Job)
            .execution_options(synchronize_session=False)
            .where(Job.id == job.id, or_(ready, expired))
            .values(
                status="RUNNING",
                lease_owner=owner,
                lease_until=now() + timedelta(seconds=settings().lease_seconds),
                attempt_count=Job.attempt_count + 1,
            )
        )
        db.commit()
        return (job.id, owner) if result.rowcount else None


def heartbeat(job_id, owner):
    with SessionLocal() as db:
        changed = db.execute(
            update(Job)
            .execution_options(synchronize_session=False)
            .where(Job.id == job_id, Job.lease_owner == owner, Job.status == "RUNNING")
            .values(lease_until=now() + timedelta(seconds=settings().lease_seconds))
        )
        db.commit()
        return bool(changed.rowcount)


def finish(job_id, owner, error=None):
    with SessionLocal() as db:
        job = db.scalar(
            select(Job)
            .where(Job.id == job_id, Job.lease_owner == owner, Job.status == "RUNNING")
            .with_for_update()
        )
        if not job:
            return
        job.status = (
            "COMPLETED" if not error else ("FAILED" if job.attempt_count >= 3 else "QUEUED")
        )
        job.error_code = error
        job.next_attempt_at = now() + timedelta(seconds=2**job.attempt_count)
        job.lease_until = None
        if job.status == "FAILED":
            fail_reference(db, job, error)
        db.commit()
