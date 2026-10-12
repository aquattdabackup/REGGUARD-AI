from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaseCreate(StrictModel):
    title: str = Field(min_length=3, max_length=160)
    legal_entity_name: str = Field(min_length=2, max_length=200)
    lei: str | None = Field(default=None, pattern=r"^[A-Z0-9]{18}[0-9]{2}$")
    chain_id: Literal[11155111] = 11155111
    contract_address: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")
    wallet_address: str | None = Field(default=None, pattern=r"^0x[a-fA-F0-9]{40}$")
    policy_version: Literal["1.0", "2.0"] = "1.0"
    notes: str = Field(default="", max_length=2000)

    @field_validator("title", "legal_entity_name")
    @classmethod
    def meaningful(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("A meaningful value is required")
        return value.strip()


class CasePatch(StrictModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)


class ReviewInput(StrictModel):
    decision: Literal["ACCEPT", "REJECT", "REQUEST_EVIDENCE"]
    explanation: str = Field(min_length=10, max_length=2000)


class AnalyzeInput(StrictModel):
    policy_version: Literal["1.0", "2.0"] = "1.0"
    replay_run_id: str | None = None
    scenario: (
        Literal[
            "valid-case",
            "mismatched-case",
            "missing-data-case",
            "changed-source-case",
            "api-failure",
        ]
        | None
    ) = None


class ExtractedField(StrictModel):
    field: Literal[
        "legal_entity_name",
        "lei",
        "registered_address",
        "registration_reference",
        "document_type",
        "date",
        "named_party",
        "blockchain_identifier",
        "inconsistency",
    ]
    value: str | None
    document_id: str
    page: int = Field(ge=1)
    excerpt: str
    status: Literal["EXTRACTED", "MISSING", "UNCERTAIN"]
    uncertainty: Literal["LOW", "MEDIUM", "HIGH"]


class Extraction(StrictModel):
    fields: list[ExtractedField] = Field(max_length=80)


class PolicyRule(StrictModel):
    code: str
    title: str
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    operator: Literal["equals", "not_equals", "exists", "in", "before", "after", "numeric_range"]
    expected: dict


class PolicyDefinition(StrictModel):
    code: str
    version: str
    title: str
    jurisdiction: str
    effective_at: str
    description: str
    rules: list[PolicyRule] = Field(min_length=8, max_length=8)
