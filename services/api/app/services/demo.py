from datetime import timedelta

import pymupdf as fitz

from app.connectors.gleif import source
from app.core.db import iso, uid
from app.models.entities import Case, Document
from app.services.ai import fixture_extract
from app.services.documents import Storage, file_hash
from app.services.parse_document import parse

DEMO_LEI = "5493001KJTIIGC8Y1R12"
DEMO_ADDRESS = "0x" + "1" * 40


def fixture_sources(case, scenario, evaluated_at):
    age = iso(evaluated_at - timedelta(hours=2))
    error = "CONTROLLED_API_FAILURE" if scenario == "api-failure" else None
    gleif = source(
        "GLEIF",
        "fixture://" + scenario + "/gleif",
        {
            "found": True,
            "lei": case.lei,
            "legal_name": "Aurora Digital Assets Ltd",
            "registration_status": "LAPSED" if scenario == "changed-source-case" else "ISSUED",
            "entity_status": "ACTIVE",
        },
        {"fixture": scenario},
        "fixture",
        error,
        age,
    )
    evm = source(
        "EVM",
        "fixture://" + scenario + "/evm",
        {
            "chain_id": 11155111,
            "address": case.contract_address,
            "contract_exists": True,
            "block_number": 1234567,
            "block_hash": "0x" + "a" * 64,
        },
        {"fixture": scenario},
        "fixture",
        error,
        age,
    )
    return [gleif, evm]


def seed_cases(db, org_id, user_id):
    for scenario, title in [
        ("valid-case", "Aurora / Issuer onboarding"),
        ("mismatched-case", "Northstar / Identity review"),
        ("missing-data-case", "Meridian / Evidence collection"),
    ]:
        case = Case(
            id=uid(),
            organization_id=org_id,
            created_by=user_id,
            title=title,
            legal_entity_name="Aurora Digital Assets Ltd",
            lei=DEMO_LEI,
            contract_address=DEMO_ADDRESS,
            mode="fixture",
            scenario=scenario,
            notes="Fictional sample case. External records are simulated.",
        )
        db.add(case)
        db.flush()
        if scenario == "missing-data-case":
            continue
        for kind in ["certificate", "issuer_declaration"]:
            entity = (
                "Northstar Token Ventures Ltd"
                if scenario == "mismatched-case" and kind == "issuer_declaration"
                else "Aurora Digital Assets Ltd"
            )
            pdf = fitz.open()
            page = pdf.new_page()
            page.insert_text((52, 64), "REGGUARD / SAMPLE EVIDENCE", fontsize=18)
            page.insert_text(
                (52, 110),
                f"Document type: {kind}\nEntity: {entity}\nLEI: {DEMO_LEI}\nAddress: 18 Example Quay, London\n\nFictional demonstration document. Not a legal record.\nPrepared for a controlled compliance-readiness demonstration.",
                fontsize=11,
            )
            data = pdf.tobytes()
            doc_id = uid()
            path = f"{org_id}/{case.id}/{doc_id}.pdf"
            Storage().save(path, data, "application/pdf")
            document = Document(
                id=doc_id,
                organization_id=org_id,
                case_id=case.id,
                filename=kind + ".pdf",
                storage_path=path,
                sha256=file_hash(data),
                mime_type="application/pdf",
                size_bytes=len(data),
                uploaded_by=user_id,
                pages=parse(data, "application/pdf"),
                status="READY",
            )
            document.extraction = fixture_extract(document)
            db.add(document)
    db.commit()
