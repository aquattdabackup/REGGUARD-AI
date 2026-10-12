import io
import json
from datetime import timedelta
from uuid import uuid4

import pymupdf as fitz
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import select

from app.core.db import SessionLocal, now
from app.models.entities import Case, Job, Membership, WalletNonce
from app.services.integrity import commitment, verify_package
from app.worker import tick


def cases(client, session):
    return client.get("/api/v1/cases", headers=session).json()["items"]


def evaluate_case(client, session, case, body=None):
    response = client.post(
        f"/api/v1/cases/{case['id']}/analyze",
        json=body or {},
        headers={**session, "Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 202, response.text
    for _ in range(10):
        if not tick():
            break
    response = client.get("/api/v1/runs/" + response.json()["run_id"], headers=session)
    assert response.status_code == 200
    return response.json()


def test_happy_path_finalize_export_and_tamper(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    run = evaluate_case(client, session, case)
    assert run["status"] == "PASS", run
    assert len(run["findings"]) == 8
    assert all(f["status"] == "PASS" for f in run["findings"])
    reports = client.get(f"/api/v1/cases/{case['id']}", headers=session).json()["reports"]
    report_id = reports[0]["id"]
    finalized = client.post(f"/api/v1/reports/{report_id}/finalize", headers=session)
    assert finalized.status_code == 200, finalized.text
    second = client.post(f"/api/v1/reports/{report_id}/finalize", headers=session)
    assert second.json()["report_hash"] == finalized.json()["report_hash"]
    package = client.get(f"/api/v1/reports/{report_id}/download", headers=session).json()
    assert verify_package(package)["integrity_valid"]
    assert verify_package(package)["status"] == "ANCHOR_NOT_FOUND"
    pdf = client.get(f"/api/v1/reports/{report_id}/download?format=pdf", headers=session)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    with fitz.open(stream=pdf.content) as doc:
        assert doc.page_count >= 2
        assert "REGGUARD" in doc[0].get_text()
    from app.core.config import ROOT

    (ROOT / ".data" / "sample-report.pdf").write_bytes(pdf.content)
    (ROOT / ".data" / "sample-report.json").write_text(json.dumps(package), encoding="utf-8")
    package["report"]["case"]["title"] = "tampered"
    assert verify_package(package)["status"] == "INTEGRITY_MISMATCH"
    assert client.post(f"/api/v1/reports/{report_id}/anchor", headers=session).status_code == 503


def test_mismatch_requires_review_and_review_does_not_override(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "mismatched-case")
    run = evaluate_case(client, session, case)
    finding = next(f for f in run["findings"] if f["rule_code"] == "R03")
    assert finding["status"] == "REVIEW_REQUIRED"
    response = client.post(
        f"/api/v1/findings/{finding['id']}/review",
        headers=session,
        json={
            "decision": "ACCEPT",
            "explanation": "Reviewed supporting evidence; follow-up is recorded.",
        },
    )
    assert response.status_code == 201
    assert (
        client.get(f"/api/v1/runs/{run['id']}", headers=session).json()["findings"][2]["status"]
        == "REVIEW_REQUIRED"
    )


def test_policy_replay_and_source_change_preserve_snapshot(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    first = evaluate_case(client, session, case)
    replay = evaluate_case(
        client, session, case, {"policy_version": "2.0", "replay_run_id": first["id"]}
    )
    assert replay["snapshot"] == first["snapshot"]
    assert {d["rule_code"] for d in replay["diff"] if d["kind"] == "rule"} == {"R05", "R08"}
    changed = evaluate_case(client, session, case, {"scenario": "changed-source-case"})
    assert changed["findings"][1]["status"] == "FAIL"
    assert any(d["kind"] == "source" for d in changed["diff"])
    assert (
        client.get(f"/api/v1/runs/{first['id']}", headers=session).json()["snapshot"]
        == first["snapshot"]
    )


def test_missing_data_and_api_failure_never_pass(client, session):
    missing = next(c for c in cases(client, session) if c["scenario"] == "missing-data-case")
    run = evaluate_case(client, session, missing)
    assert run["findings"][2]["status"] == "UNKNOWN"
    assert run["findings"][5]["status"] == "FAIL"
    good = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    failed = evaluate_case(client, session, good, {"scenario": "api-failure"})
    for index in [0, 1, 2, 3, 7]:
        assert failed["findings"][index]["status"] == "UNKNOWN"


def test_cross_tenant_cases_documents_reports_denied(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    evaluate_case(client, session, case)
    detail = client.get(f"/api/v1/cases/{case['id']}", headers=session).json()
    token = client.post("/api/v1/demo/session").json()["access_token"]
    other = {"Authorization": "Bearer " + token}
    paths = [
        f"/cases/{case['id']}",
        f"/documents/{detail['documents'][0]['id']}/content",
        f"/reports/{detail['reports'][0]['id']}",
        f"/runs/{detail['runs'][0]['id']}",
    ]
    for path in paths:
        assert client.get("/api/v1" + path, headers=other).status_code == 404
    assert client.get("/api/v1/cases").status_code == 401


def test_viewer_and_analyst_cannot_finalize_or_review(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    run = evaluate_case(client, session, case)
    report_id = client.get("/api/v1/reports", headers=session).json()[0]["id"]
    with SessionLocal() as db:
        member = db.scalar(select(Membership))
        member.role = "viewer"
        db.commit()
    assert client.post(f"/api/v1/reports/{report_id}/finalize", headers=session).status_code == 403
    assert client.post(f"/api/v1/reports/{report_id}/anchor", headers=session).status_code == 403
    with SessionLocal() as db:
        db.scalar(select(Membership)).role = "analyst"
        db.commit()
    assert (
        client.post(
            f"/api/v1/findings/{run['findings'][0]['id']}/review",
            json={"decision": "ACCEPT", "explanation": "Attempted role escalation"},
            headers=session,
        ).status_code
        == 403
    )


def test_upload_malformed_and_real_pdf_processing(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "missing-data-case")
    url = f"/api/v1/cases/{case['id']}/documents"
    assert (
        client.post(
            url, headers=session, files={"file": ("evil.pdf", b"not pdf", "application/pdf")}
        ).status_code
        == 422
    )
    assert (
        client.post(
            url, headers=session, files={"file": ("script.exe", b"MZ", "application/octet-stream")}
        ).status_code
        == 422
    )
    with fitz.open() as pdf:
        page = pdf.new_page()
        page.insert_text((50, 50), "Document type: certificate\nEntity: Aurora Digital Assets Ltd")
        data = pdf.tobytes()
    response = client.post(
        url,
        headers=session,
        files={"file": ("certificate.pdf", io.BytesIO(data), "application/pdf")},
    )
    assert response.status_code == 202, response.text
    tick()
    document = client.get(f"/api/v1/cases/{case['id']}/documents", headers=session).json()[0]
    assert document["status"] == "READY", document
    assert document["extraction"]["provider"] == "fixture"
    assert document["extraction"]["fields"][0]["document_id"] == document["id"]


def test_idempotent_analysis(client, session):
    case = cases(client, session)[0]
    headers = {**session, "Idempotency-Key": "fixed-key"}
    one = client.post(f"/api/v1/cases/{case['id']}/analyze", headers=headers, json={})
    two = client.post(f"/api/v1/cases/{case['id']}/analyze", headers=headers, json={})
    assert one.json()["run_id"] == two.json()["run_id"]
    with SessionLocal() as db:
        assert len(db.scalars(select(Job).where(Job.job_type == "evaluate")).all()) == 1


def test_wallet_signature_nonce_replay_and_expiry(client, session):
    case = cases(client, session)[0]
    account = Account.create()
    with SessionLocal() as db:
        db.get(Case, case["id"]).wallet_address = account.address
        db.commit()
    path = f"/api/v1/cases/{case['id']}/wallet"
    nonce = client.post(path + "/nonce", headers=session, json={"address": account.address}).json()
    signature = "0x" + Account.sign_message(
        encode_defunct(text=nonce["message"]), account.key
    ).signature.hex().removeprefix("0x")
    body = {"nonce_id": nonce["nonce_id"], "signature": signature}
    assert client.post(path + "/verify", headers=session, json=body).status_code == 200
    assert client.post(path + "/verify", headers=session, json=body).status_code == 422
    expired = client.post(
        path + "/nonce", headers=session, json={"address": account.address}
    ).json()
    with SessionLocal() as db:
        db.get(WalletNonce, expired["nonce_id"]).expires_at = now() - timedelta(seconds=1)
        db.commit()
    body["nonce_id"] = expired["nonce_id"]
    assert client.post(path + "/verify", headers=session, json=body).status_code == 422


def test_commitment_domain_and_salt():
    payload = {"a": 1, "z": "hello"}
    assert commitment(payload, "00" * 32) == commitment({"z": "hello", "a": 1}, "00" * 32)
    assert commitment(payload, "00" * 32) != commitment(payload, "01" * 32)
