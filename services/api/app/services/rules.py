import re
import unicodedata
from datetime import datetime


def normalize(value):
    return re.sub(r"[^\w]", "", unicodedata.normalize("NFKC", value).casefold())


def operate(operator, observed, expected):
    if observed is None:
        return None
    match operator:
        case "equals":
            return observed == expected
        case "not_equals":
            return observed != expected
        case "exists":
            return observed is not None and observed != ""
        case "in":
            return observed in expected
        case "before":
            return observed < expected
        case "after":
            return observed > expected
        case "numeric_range":
            return expected[0] <= observed <= expected[1]
        case _:
            raise ValueError("Unsupported policy operator")


def evaluate(policy, snapshot):
    # Only immutable snapshot time is used: replay is deterministic.
    evaluated_at = datetime.fromisoformat(snapshot["evaluated_at"].replace("Z", "+00:00"))
    sources = snapshot["sources"]
    gleif = next((s for s in sources if s["provider"] == "GLEIF"), None)
    evm = next((s for s in sources if s["provider"] == "EVM"), None)
    gd = gleif["normalized_data"] if gleif else {}
    ed = evm["normalized_data"] if evm else {}
    docs = snapshot["documents"]
    all_fields = [f for doc in docs for f in doc.get("extraction", {}).get("fields", [])]
    fields = [
        f
        for f in all_fields
        if f["status"] == "EXTRACTED" and f["uncertainty"] == "LOW" and f["value"]
    ]
    names = [f for f in fields if f["field"] == "legal_entity_name"]

    def document_refs(field_names):
        return [
            {
                "kind": "document",
                "document_id": f["document_id"],
                "page": f["page"],
                "excerpt": f["excerpt"],
            }
            for f in fields
            if f["field"] in field_names
        ]

    source_refs = [
        {
            "kind": "source",
            "provider": s["provider"],
            "source_hash": s["source_hash"],
            "source_identifier": s["source_identifier"],
            "mode": s["mode"],
        }
        for s in sources
    ]
    results = []
    for rule in policy["rules"]:
        code, expected = rule["code"], rule["expected"]
        status, observed, evidence, reason = (
            "UNKNOWN",
            None,
            [],
            "Required evidence is unavailable.",
        )
        if code == "R01":
            observed, evidence = gd.get("found"), source_refs[:1]
            if gd.get("status") == "ok":
                status = (
                    "PASS" if operate(rule["operator"], observed, expected["value"]) else "FAIL"
                )
                reason = "GLEIF record retrieved for the supplied LEI."
            elif gd.get("error") == "NOT_FOUND":
                status, reason = "FAIL", "GLEIF returned no record for the supplied LEI."
        elif code == "R02":
            observed, evidence = (
                {"registration": gd.get("registration_status"), "entity": gd.get("entity_status")},
                source_refs[:1],
            )
            if gd.get("status") == "ok" and all(observed.values()):
                matches = (
                    operate(
                        rule["operator"], observed["registration"], expected["registration_status"]
                    )
                    and observed["entity"] in expected["entity_status"]
                )
                status = "PASS" if matches else "FAIL"
                reason = "Registration and entity lifecycle statuses were checked separately."
        elif code == "R03":
            observed, evidence = (
                [f["value"] for f in names],
                document_refs({"legal_entity_name"}) + source_refs[:1],
            )
            if names and gd.get("legal_name") and gd.get("status") == "ok":
                status = (
                    "PASS"
                    if {f["document_id"] for f in names} == {d["id"] for d in docs}
                    and all(normalize(f["value"]) == normalize(gd["legal_name"]) for f in names)
                    else "REVIEW_REQUIRED"
                )
                reason = (
                    "Normalized document names match the reference record."
                    if status == "PASS"
                    else "The entity names differ. A reviewer must resolve the identity ambiguity; this is not proof of fraud."
                )
        elif code == "R04":
            observed, evidence = ed.get("contract_exists"), source_refs[1:]
            if ed.get("status") == "ok" and observed is not None:
                status = (
                    "PASS" if operate(rule["operator"], observed, expected["value"]) else "FAIL"
                )
                reason = "Bytecode existence checked at the recorded finalized block. This does not establish contract safety."
        elif code == "R05":
            proof = snapshot.get("wallet_proof", {})
            observed = {"required": expected["required"], "verified": proof.get("verified", False)}
            evidence = [{"kind": "wallet", "proof": proof}] if proof else []
            if not expected["required"]:
                status, reason = (
                    "PASS",
                    "Wallet proof is outside the requirements of this policy version.",
                )
            elif (
                proof.get("verified")
                and proof.get("expires_at")
                and evaluated_at
                <= datetime.fromisoformat(proof["expires_at"].replace("Z", "+00:00"))
            ):
                status, reason = (
                    "PASS",
                    "A domain-bound signature proves key possession only, not legal authority.",
                )
        elif code == "R06":
            observed = sorted({f["value"] for f in fields if f["field"] == "document_type"})
            evidence = document_refs({"document_type"})
            if not docs:
                status, reason = "FAIL", "No supporting documents were supplied."
            elif any(
                doc.get("status") != "READY"
                or not any(
                    f["field"] == "document_type" and f["document_id"] == doc["id"] for f in fields
                )
                for doc in docs
            ):
                reason = "At least one document cannot be reliably classified."
            else:
                status = "PASS" if set(expected["types"]).issubset(observed) else "FAIL"
                reason = "Grounded document type labels were compared with the policy requirements."
        elif code == "R07":
            groups = {
                key: sorted({normalize(f["value"]) for f in fields if f["field"] == key})
                for key in ["legal_entity_name", "lei"]
            }
            observed, evidence = groups, document_refs({"legal_entity_name", "lei"})
            if any(len(values) > 1 for values in groups.values()):
                status, reason = (
                    "REVIEW_REQUIRED",
                    "Documents contain conflicting identifiers. Review the original excerpts.",
                )
            elif (
                len(docs) >= 2
                and {f["document_id"] for f in names} == {d["id"] for d in docs}
                and all(d.get("status") == "READY" for d in docs)
            ):
                status, reason = (
                    "PASS",
                    "Available entity identifiers are consistent across the supplied documents.",
                )
            else:
                status, reason = (
                    "REVIEW_REQUIRED",
                    "Not enough independently extracted document fields to establish consistency.",
                )
        elif code == "R08":
            evidence = source_refs
            if len(sources) == 2 and all(
                s["normalized_data"].get("status") == "ok" for s in sources
            ):
                observed = [
                    (
                        evaluated_at
                        - datetime.fromisoformat(s["fetched_at"].replace("Z", "+00:00"))
                    ).total_seconds()
                    / 3600
                    for s in sources
                ]
                status = (
                    "PASS"
                    if all(
                        operate(rule["operator"], age, [0, expected["max_age_hours"]])
                        for age in observed
                    )
                    else "FAIL"
                )
                reason = f"Source ages in hours compared with a {expected['max_age_hours']}-hour maximum at the immutable evaluation time."
        results.append(
            {
                "rule_code": code,
                "title": rule["title"],
                "severity": rule["severity"],
                "status": status,
                "observed_value": {"value": observed},
                "expected_value": expected,
                "explanation": reason,
                "evidence_refs": evidence,
            }
        )
    return results


def outcome(findings):
    states = {f["status"] for f in findings}
    return next((s for s in ["FAIL", "REVIEW_REQUIRED", "UNKNOWN"] if s in states), "PASS")
