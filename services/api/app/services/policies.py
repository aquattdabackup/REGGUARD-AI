import yaml
from sqlalchemy import select

from app.core.config import ROOT
from app.models.entities import Policy
from app.schemas.domain import PolicyDefinition
from app.services.integrity import policy_hash


def load_policies(db):
    for path in sorted((ROOT / "policies").glob("*.yaml")):
        definition = PolicyDefinition.model_validate(
            yaml.safe_load(path.read_text(encoding="utf-8"))
        ).model_dump()
        hashed = policy_hash(definition)
        existing = db.scalar(
            select(Policy).where(
                Policy.policy_code == definition["code"], Policy.version == definition["version"]
            )
        )
        if existing:
            if existing.policy_hash != hashed:
                raise RuntimeError("Policy content changed without a new version")
            continue
        db.add(
            Policy(
                policy_code=definition["code"],
                version=definition["version"],
                jurisdiction=definition["jurisdiction"],
                rules_json=definition,
                policy_hash=hashed,
                effective_at=definition["effective_at"],
            )
        )
    db.commit()


def get_policy(db, version):
    policy = db.scalar(
        select(Policy).where(Policy.policy_code == "RG-DAR-001", Policy.version == version)
    )
    if not policy:
        raise ValueError("POLICY_NOT_FOUND")
    return policy
