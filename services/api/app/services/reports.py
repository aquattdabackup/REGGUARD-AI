import io
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate
from sqlalchemy import select

from app.core.db import iso
from app.models.entities import Anchor, Finding, Review
from app.services.integrity import finalize_commitment

DISCLAIMER = "Internal policy readiness assessment only. This report is not legal advice, regulatory approval, or a certification of legal compliance. Source accuracy and human legal judgment remain outside automated assurance."


def row_dict(row, exclude=()):
    from datetime import datetime

    return {
        c.name: iso(v) if isinstance(v := getattr(row, c.name), datetime) else v
        for c in row.__table__.columns
        if c.name not in exclude
    }


def finalize(db, report, run, policy, organization):
    if report.finalized_at:
        return report
    findings = db.scalars(
        select(Finding).where(Finding.run_id == run.id).order_by(Finding.rule_code)
    ).all()
    reviews = db.scalars(
        select(Review)
        .where(Review.finding_id.in_([f.id for f in findings]))
        .order_by(Review.created_at)
    ).all()
    payload = {
        "schema_version": "regguard-report-v1",
        "report_id": report.id,
        "version": report.version,
        "organization": {"id": organization.id, "name": organization.name},
        "case": run.snapshot["case"],
        "scope": "Digital Asset Issuer Onboarding & Compliance Readiness",
        "disclaimer": DISCLAIMER,
        "policy": policy.rules_json,
        "policy_hash": policy.policy_hash,
        "evaluation_timestamp": run.snapshot["evaluated_at"],
        "mode": run.snapshot["mode"],
        "snapshot": run.snapshot,
        "findings": [row_dict(f) for f in findings],
        "reviews": [row_dict(r) for r in reviews],
        "uncertainties": [
            f.rule_code for f in findings if f.status in ("UNKNOWN", "REVIEW_REQUIRED")
        ],
        "cre_execution": run.cre_evidence,
        "finalized_at": iso(),
    }
    integrity = finalize_commitment(payload)
    from app.core.db import now

    report.payload = payload
    report.report_hash, report.salt, report.record_key = (
        integrity["commitment"],
        integrity["salt"],
        integrity["record_key"],
    )
    report.finalized_at, report.status = now(), "FINALIZED"
    db.flush()
    return report


def verification_package(db, report):
    anchor = db.scalar(select(Anchor).where(Anchor.report_id == report.id))
    return {
        "format": "regguard-verification-v1",
        "report": report.payload,
        "salt": report.salt,
        "commitment": report.report_hash,
        "record_key": report.record_key,
        "anchor": row_dict(anchor, exclude=("raw_transaction",)) if anchor else None,
    }


def render_pdf(package):
    payload = package["report"]
    buffer = io.BytesIO()
    font_dir = Path(__file__).resolve().parents[1] / "assets" / "fonts"
    if "NotoSans" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("NotoSans", str(font_dir / "NotoSans-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("NotoSans-Bold", str(font_dir / "NotoSans-Bold.ttf")))
        pdfmetrics.registerFontFamily(
            "NotoSans",
            normal="NotoSans",
            bold="NotoSans-Bold",
            italic="NotoSans",
            boldItalic="NotoSans-Bold",
        )
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = (
            "NotoSans-Bold" if style.name.startswith(("Heading", "Title")) else "NotoSans"
        )
        if style.name.startswith(("Heading", "Title")):
            style.keepWithNext = True
    styles["Normal"].fontSize, styles["Normal"].leading = 9, 14
    styles["Normal"].spaceAfter = 7
    styles["Heading1"].textColor = colors.HexColor("#0B1220")
    styles["Heading2"].textColor = colors.HexColor("#2563EB")
    story = []

    def p(text, style="Normal"):
        story.append(Paragraph(escape(str(text)), styles[style]))

    p("REGGUARD AI", "Title")
    p("VERIFIABLE COMPLIANCE INTELLIGENCE", "Heading2")
    p(payload["case"]["title"], "Heading1")
    p(f"Report {payload['report_id']} / version {payload['version']}")
    p(f"Evidence mode: {payload['mode'].upper()} | Evaluated: {payload['evaluation_timestamp']}")
    story.append(HRFlowable(width="100%", color=colors.HexColor("#CBD5E1")))
    p("Scope & limitations", "Heading2")
    p(payload["disclaimer"])
    p(f"Policy: {payload['policy']['code']} v{payload['policy']['version']}")
    p("Findings & evidence", "Heading2")
    for finding in payload["findings"]:
        p(f"{finding['rule_code']} / {finding['title']} / {finding['status']}", "Heading3")
        p(finding["explanation"])
        p("Observed: " + json.dumps(finding["observed_value"], ensure_ascii=False))
        p("Expected: " + json.dumps(finding["expected_value"], ensure_ascii=False))
        for ref in finding["evidence_refs"]:
            if ref["kind"] == "document":
                p(
                    f"Document {ref['document_id']} / page or section {ref['page']}: {ref['excerpt']}"
                )
            elif ref["kind"] == "source":
                p(f"{ref['provider']} ({ref['mode']}): {ref['source_identifier']}")
    p("Source manifest", "Heading2")
    for source in payload["snapshot"]["sources"]:
        p(f"{source['provider']} / {source['mode']} / retrieved {source['fetched_at']}")
        p("SHA-256: " + source["source_hash"])
    p("AI processing metadata", "Heading2")
    for document in payload["snapshot"]["documents"]:
        extraction = document.get("extraction", {})
        p(
            f"{document['filename']}: {extraction.get('provider', 'unavailable')} / {extraction.get('model', 'not available')} / {extraction.get('prompt_version', 'not available')}"
        )
    p("Human review", "Heading2")
    if not payload["reviews"]:
        p("No human review recorded at finalization.")
    for review in payload["reviews"]:
        p(
            f"{review['decision']} / reviewer {review['reviewer_id']} / {review['reviewed_at']}: {review['explanation']}"
        )
    p("Integrity & blockchain", "Heading2")
    p("Commitment: " + package["commitment"])
    p("Policy hash: " + payload["policy_hash"])
    p("Anchor: " + (package["anchor"]["status"] if package.get("anchor") else "Not anchored"))
    p(
        "The JSON verification package is the canonical evidence artifact. This PDF is a human-readable rendering. The private salt is provided only in the authorized JSON package."
    )

    def footer(canvas, doc):
        canvas.setFont("NotoSans", 8)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawString(44, 28, "RegGuard AI | Confidential evidence | Not a legal certification")
        canvas.drawRightString(551, 28, str(doc.page))

    SimpleDocTemplate(
        buffer,
        pagesize=(595, 842),
        rightMargin=44,
        leftMargin=44,
        topMargin=44,
        bottomMargin=48,
        title="RegGuard Compliance Readiness Report",
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
