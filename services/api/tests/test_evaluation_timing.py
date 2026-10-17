from datetime import datetime, timedelta

import pytest
from test_workflow import cases, evaluate_case

from app.connectors.gleif import source
from app.core import db as core_db
from app.core.db import SessionLocal, iso, now
from app.models.entities import Case
from app.services import evaluation


def live_case(client, session):
    case = next(c for c in cases(client, session) if c["scenario"] == "valid-case")
    with SessionLocal() as db:
        db.get(Case, case["id"]).mode = "live"
        db.commit()
    return case


def install_sources(monkeypatch, clock, *, gleif_offset=None, gleif_error=None):
    calls = []

    def gleif_fetch(self, lei):
        calls.append("GLEIF")
        clock[0] += timedelta(seconds=3)
        return source(
            "GLEIF",
            "https://example.test/lei/" + lei,
            {
                "found": True,
                "legal_name": "Aurora Digital Assets Ltd",
                "registration_status": "ISSUED",
            },
            {},
            error=gleif_error,
            fetched_at=iso(clock[0] + gleif_offset) if gleif_offset else None,
        )

    def evm_fetch(self, address, chain_id):
        calls.append("EVM")
        clock[0] += timedelta(seconds=5)
        return source(
            "EVM",
            f"eip155:{chain_id}:{address}",
            {"chain_id": chain_id, "address": address, "contract_exists": False},
            {"code": "0x"},
        )

    monkeypatch.setattr(core_db, "now", lambda: clock[0])
    monkeypatch.setattr(evaluation, "now", lambda: clock[0])
    monkeypatch.setattr(evaluation.GLEIFConnector, "fetch", gleif_fetch)
    monkeypatch.setattr(evaluation.EVMConnector, "fetch", evm_fetch)
    return calls


def test_live_freshness_after_delayed_reads_and_immutable_replay(client, session, monkeypatch):
    case = live_case(client, session)
    clock = [now()]
    calls = install_sources(monkeypatch, clock)

    first = evaluate_case(client, session, case)
    findings = {f["rule_code"]: f for f in first["findings"]}
    assert findings["R08"]["status"] == "PASS", findings["R08"]
    assert all(0 <= age < 1 / 60 for age in findings["R08"]["observed_value"]["value"])
    assert findings["R04"]["status"] == "FAIL"
    assert findings["R04"]["observed_value"]["value"] is False
    snapshot = first["snapshot"]
    evaluated_at = datetime.fromisoformat(snapshot["evaluated_at"].replace("Z", "+00:00"))
    for evidence in snapshot["sources"]:
        fetched_at = datetime.fromisoformat(evidence["fetched_at"].replace("Z", "+00:00"))
        assert fetched_at <= evaluated_at

    # Replay must use the frozen evaluation time and avoid fresh connector calls.
    clock[0] += timedelta(days=30)
    replay = evaluate_case(client, session, case, {"replay_run_id": first["id"]})
    assert replay["snapshot"] == snapshot
    replay_freshness = next(f for f in replay["findings"] if f["rule_code"] == "R08")
    assert replay_freshness["status"] == "PASS"
    assert replay_freshness["observed_value"] == findings["R08"]["observed_value"]
    assert calls == ["GLEIF", "EVM"]
    original = client.get("/api/v1/runs/" + first["id"], headers=session).json()
    assert original["snapshot"] == snapshot


@pytest.mark.parametrize(
    ("offset", "error", "expected"),
    [
        (timedelta(hours=-73), None, "FAIL"),
        (timedelta(hours=1), None, "FAIL"),
        (None, "TEST_SOURCE_UNAVAILABLE", "UNKNOWN"),
    ],
    ids=["stale", "future", "unavailable"],
)
def test_live_freshness_does_not_accept_invalid_sources(
    client, session, monkeypatch, offset, error, expected
):
    case = live_case(client, session)
    install_sources(monkeypatch, [now()], gleif_offset=offset, gleif_error=error)
    run = evaluate_case(client, session, case)
    freshness = next(f for f in run["findings"] if f["rule_code"] == "R08")
    assert freshness["status"] == expected
