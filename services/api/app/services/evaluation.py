from sqlalchemy import select

from app.connectors.evm import EVMConnector
from app.connectors.gleif import GLEIFConnector
from app.core.db import iso, now
from app.models.entities import AuditEvent, Case, Document, Finding, Policy, Report, Run, Snapshot
from app.services.ai import extract
from app.services.demo import fixture_sources
from app.services.documents import Storage, extract_pages, file_hash
from app.services.reports import row_dict
from app.services.rules import evaluate, outcome


def process_document(db, document):
    if document.status in ("READY", "FAILED"):
        return
    case = db.get(Case, document.case_id)
    document.status = "EXTRACTING"
    db.commit()
    try:
        data = Storage().read(document.storage_path)
        if file_hash(data) != document.sha256:
            raise ValueError("DOCUMENT_INTEGRITY_MISMATCH")
        document.pages = extract_pages(data, document.filename, document.mime_type)
        document.extraction = extract(document, db, case.mode)
        document.status = "READY"
        document.error_code = document.extraction.get("error")
    except Exception as error:
        document.status = "FAILED"
        document.error_code = (
            str(error) if isinstance(error, ValueError) else "DOCUMENT_PROCESSING_FAILED"
        )
    db.commit()


def process_run(db, run, fence=lambda: True):
    if run.completed_at:
        return
    case = db.get(Case, run.case_id)
    policy = db.get(Policy, run.policy_id)
    run.status, case.status = "COLLECTING", "COLLECTING"
    db.commit()
    if run.replay_of:
        original = db.get(Run, run.replay_of)
        snapshot = original.snapshot
    else:
        documents = db.scalars(
            select(Document).where(Document.case_id == case.id).order_by(Document.created_at)
        ).all()
        if any(d.status not in ("READY", "FAILED") for d in documents):
            raise ValueError("DOCUMENTS_PENDING")
        if case.mode == "fixture":
            stamp = now()
            sources = fixture_sources(case, run.snapshot.get("scenario", case.scenario), stamp)
        else:
            sources = [
                GLEIFConnector().fetch(case.lei),
                EVMConnector().fetch(case.contract_address, case.chain_id),
            ]
            # Evaluate after collection so newly fetched sources cannot have negative ages.
            stamp = now()
        snapshot = {
            "case": row_dict(case),
            "mode": case.mode,
            "evaluated_at": iso(stamp),
            "sources": sources,
            "documents": [row_dict(d, exclude=("storage_path",)) for d in documents],
            "wallet_proof": case.wallet_proof,
        }
    run.status, case.status = "EVALUATING", "EVALUATING"
    db.commit()
    results = evaluate(policy.rules_json, snapshot)
    if not fence():
        raise ValueError("WORKER_LEASE_LOST")
    # Re-lock before materializing results; a recovered worker cannot duplicate finalized work.
    db.refresh(run, with_for_update=True)
    if run.completed_at:
        return
    run.snapshot = snapshot
    previous = (
        db.get(Run, run.replay_of)
        if run.replay_of
        else db.scalar(
            select(Run)
            .where(Run.case_id == case.id, Run.id != run.id, Run.completed_at.is_not(None))
            .order_by(Run.completed_at.desc())
            .limit(1)
        )
    )
    diff = []
    if previous:
        previous_results = {
            f.rule_code: f.status
            for f in db.scalars(select(Finding).where(Finding.run_id == previous.id))
        }
        diff = [
            {
                "kind": "rule",
                "rule_code": f["rule_code"],
                "before": previous_results.get(f["rule_code"]),
                "after": f["status"],
                "reason": f["explanation"],
            }
            for f in results
            if previous_results.get(f["rule_code"]) != f["status"]
        ]
        old_sources = {
            s["provider"]: s["normalized_data"] for s in previous.snapshot.get("sources", [])
        }
        for source in snapshot["sources"]:
            if old_sources.get(source["provider"]) != source["normalized_data"]:
                diff.append(
                    {
                        "kind": "source",
                        "provider": source["provider"],
                        "before": old_sources.get(source["provider"]),
                        "after": source["normalized_data"],
                    }
                )
    run.diff = diff
    for source in snapshot["sources"]:
        db.add(Snapshot(organization_id=run.organization_id, run_id=run.id, **source))
    for finding in results:
        db.add(Finding(organization_id=run.organization_id, run_id=run.id, **finding))
    run.status = outcome(results)
    run.completed_at = now()
    case.status = "READY" if run.status == "PASS" else run.status
    db.add(
        Report(organization_id=run.organization_id, run_id=run.id, policy_hash=policy.policy_hash)
    )
    db.add(
        AuditEvent(
            organization_id=run.organization_id,
            actor_id=case.created_by,
            event_type="evaluation.completed",
            event_payload={
                "case_id": case.id,
                "run_id": run.id,
                "outcome": run.status,
                "diff": diff,
            },
        )
    )
    if any(d["kind"] == "source" for d in diff):
        db.add(
            AuditEvent(
                organization_id=run.organization_id,
                actor_id=case.created_by,
                event_type="source.changed",
                event_payload={"case_id": case.id, "run_id": run.id, "diff": diff},
            )
        )
    db.commit()
