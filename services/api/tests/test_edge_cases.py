from copy import deepcopy
from datetime import timedelta
from uuid import uuid4

from test_workflow import cases, evaluate_case

from app.core.db import SessionLocal, now
from app.models.entities import Case, Job, Run
from app.services.jobs import claim, finish
from app.services.rules import evaluate


def test_idempotency_rejects_changed_policy(client, session):
    case = cases(client, session)[0]
    headers = {**session, "Idempotency-Key": str(uuid4())}
    url = f"/api/v1/cases/{case['id']}/analyze"
    assert client.post(url, headers=headers, json={}).status_code == 202
    assert client.post(url, headers=headers, json={"policy_version": "2.0"}).status_code == 409
    assert client.post(url, headers=headers, json={"scenario": "api-failure"}).status_code == 409


def test_exhausted_worker_lease_fails_case_and_run(client, session):
    case = cases(client, session)[0]
    response = client.post(
        f"/api/v1/cases/{case['id']}/analyze",
        headers={**session, "Idempotency-Key": str(uuid4())},
        json={},
    ).json()
    with SessionLocal() as db:
        job = db.get(Job, response["job_id"])
        job.status, job.attempt_count = "RUNNING", 3
        job.lease_owner, job.lease_until = "crashed-worker", now() - timedelta(seconds=10)
        db.commit()
    assert claim() is None
    with SessionLocal() as db:
        assert db.get(Job, response["job_id"]).status == "FAILED"
        assert db.get(Run, response["run_id"]).failure_code == "WORKER_LEASE_EXHAUSTED"
        assert db.get(Case, case["id"]).status == "FAILED"


def test_stale_worker_cannot_finish_reclaimed_job(client, session):
    case = cases(client, session)[0]
    client.post(
        f"/api/v1/cases/{case['id']}/analyze",
        headers={**session, "Idempotency-Key": str(uuid4())},
        json={},
    )
    job_id, owner = claim()
    with SessionLocal() as db:
        db.get(Job, job_id).lease_until = now() - timedelta(seconds=10)
        db.commit()
    recovered_id, recovered_owner = claim()
    assert recovered_id == job_id and recovered_owner != owner
    finish(job_id, owner)
    with SessionLocal() as db:
        assert db.get(Job, job_id).status == "RUNNING"
    finish(job_id, recovered_owner)
    with SessionLocal() as db:
        assert db.get(Job, job_id).status == "COMPLETED"


def test_duplicate_fields_cannot_replace_missing_document_evidence(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    run = evaluate_case(client, session, case)
    snapshot = deepcopy(run["snapshot"])
    first, second = snapshot["documents"]
    first["extraction"]["fields"] *= 2
    second["extraction"]["fields"] = []
    results = {r["rule_code"]: r for r in evaluate(run["policy"]["rules_json"], snapshot)}
    assert results["R03"]["status"] == "REVIEW_REQUIRED"
    assert results["R06"]["status"] == "UNKNOWN"
    assert results["R07"]["status"] == "REVIEW_REQUIRED"


def test_chunked_upload_limit_and_cors(client, session):
    # No Content-Length header: ASGI limiter still caps the complete stream.
    def chunks():
        for _ in range(13):
            yield b"x" * 1_000_000

    response = client.post(
        "/api/v1/cases",
        headers={**session, "Origin": "http://localhost:3000", "Content-Type": "application/json"},
        content=chunks(),
    )
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_replay_deterministic_for_identical_input(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    run = evaluate_case(client, session, case)
    assert evaluate(run["policy"]["rules_json"], run["snapshot"]) == evaluate(
        run["policy"]["rules_json"], deepcopy(run["snapshot"])
    )


def test_verified_identity_without_membership_can_bootstrap(client, monkeypatch):
    from types import SimpleNamespace

    from app.core import security

    user_id = str(uuid4())
    # Stub only the external identity boundary; this is not an account-backed Supabase test.
    monkeypatch.setattr(
        security,
        "jwks",
        lambda: SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key="stub")),
    )
    monkeypatch.setattr(security.jwt, "decode", lambda *args, **kwargs: {"sub": user_id})
    headers = {"Authorization": "Bearer mocked-verified-identity"}
    profile = client.get("/api/v1/me", headers=headers)
    assert profile.status_code == 200 and profile.json()["organization"] is None
    assert client.get("/api/v1/cases", headers=headers).status_code == 403
    created = client.post(
        "/api/v1/organization", headers=headers, json={"name": "New organization"}
    )
    assert created.status_code == 201
    assert (
        client.get("/api/v1/me", headers=headers).json()["organization"]["id"]
        == created.json()["id"]
    )
    assert client.get("/api/v1/cases", headers=headers).status_code == 200
