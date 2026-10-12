BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE organizations (
    name VARCHAR(160) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE policies (
    policy_code VARCHAR(40) NOT NULL,
    version VARCHAR(20) NOT NULL,
    jurisdiction VARCHAR(200) NOT NULL,
    rules_json JSON NOT NULL,
    policy_hash VARCHAR(64) NOT NULL,
    effective_at VARCHAR(40) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (policy_code, version)
);

CREATE TABLE audit_events (
    actor_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    event_payload JSON NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_audit_events_organization_id ON audit_events (organization_id);

CREATE TABLE background_jobs (
    job_type VARCHAR(30) NOT NULL,
    reference_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    attempt_count INTEGER NOT NULL,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_until TIMESTAMP WITH TIME ZONE,
    lease_owner VARCHAR(40),
    error_code VARCHAR(100),
    idempotency_key VARCHAR(200) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX ix_background_jobs_organization_id ON background_jobs (organization_id);

CREATE INDEX ix_background_jobs_status ON background_jobs (status);

CREATE TABLE cases (
    created_by UUID NOT NULL,
    title VARCHAR(160) NOT NULL,
    legal_entity_name VARCHAR(200) NOT NULL,
    lei VARCHAR(20),
    chain_id INTEGER NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    wallet_address VARCHAR(42),
    policy_version VARCHAR(20) NOT NULL,
    notes VARCHAR(2000) NOT NULL,
    status VARCHAR(30) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    scenario VARCHAR(40) NOT NULL,
    wallet_proof JSON NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_cases_organization_id ON cases (organization_id);

CREATE TABLE demo_sessions (
    token_hash VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    UNIQUE (token_hash)
);

CREATE INDEX ix_demo_sessions_organization_id ON demo_sessions (organization_id);

CREATE TABLE memberships (
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX ix_memberships_organization_id ON memberships (organization_id);

CREATE INDEX ix_memberships_user_id ON memberships (user_id);

CREATE TABLE check_runs (
    case_id UUID NOT NULL,
    policy_id UUID NOT NULL,
    status VARCHAR(40) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    failure_code VARCHAR(100),
    snapshot JSON NOT NULL,
    replay_of UUID,
    diff JSON NOT NULL,
    cre_evidence JSON NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(case_id) REFERENCES cases (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    FOREIGN KEY(policy_id) REFERENCES policies (id),
    FOREIGN KEY(replay_of) REFERENCES check_runs (id)
);

CREATE INDEX ix_check_runs_case_id ON check_runs (case_id);

CREATE INDEX ix_check_runs_organization_id ON check_runs (organization_id);

CREATE TABLE documents (
    case_id UUID NOT NULL,
    filename VARCHAR(200) NOT NULL,
    storage_path VARCHAR(400) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_by UUID NOT NULL,
    status VARCHAR(40) NOT NULL,
    pages JSON NOT NULL,
    extraction JSON NOT NULL,
    error_code VARCHAR(100),
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(case_id) REFERENCES cases (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_documents_case_id ON documents (case_id);

CREATE INDEX ix_documents_organization_id ON documents (organization_id);

CREATE TABLE wallet_nonces (
    case_id UUID NOT NULL,
    user_id UUID NOT NULL,
    address VARCHAR(42) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(case_id) REFERENCES cases (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_wallet_nonces_organization_id ON wallet_nonces (organization_id);

CREATE TABLE ai_usage (
    document_id UUID NOT NULL,
    model VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    estimated_cost FLOAT NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(document_id) REFERENCES documents (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_ai_usage_organization_id ON ai_usage (organization_id);

CREATE TABLE findings (
    run_id UUID NOT NULL,
    rule_code VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    observed_value JSON NOT NULL,
    expected_value JSON NOT NULL,
    explanation VARCHAR(2000) NOT NULL,
    evidence_refs JSON NOT NULL,
    title VARCHAR(200) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    FOREIGN KEY(run_id) REFERENCES check_runs (id)
);

CREATE INDEX ix_findings_organization_id ON findings (organization_id);

CREATE INDEX ix_findings_run_id ON findings (run_id);

CREATE TABLE reports (
    run_id UUID NOT NULL,
    version INTEGER NOT NULL,
    payload JSON NOT NULL,
    report_hash VARCHAR(64),
    policy_hash VARCHAR(64) NOT NULL,
    salt VARCHAR(64),
    record_key VARCHAR(66),
    finalized_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    FOREIGN KEY(run_id) REFERENCES check_runs (id),
    UNIQUE (record_key),
    UNIQUE (run_id, version)
);

CREATE INDEX ix_reports_organization_id ON reports (organization_id);

CREATE INDEX ix_reports_run_id ON reports (run_id);

CREATE TABLE source_snapshots (
    run_id UUID NOT NULL,
    provider VARCHAR(40) NOT NULL,
    source_identifier VARCHAR(400) NOT NULL,
    fetched_at VARCHAR(40) NOT NULL,
    normalized_data JSON NOT NULL,
    raw_data JSON NOT NULL,
    source_hash VARCHAR(64) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    FOREIGN KEY(run_id) REFERENCES check_runs (id)
);

CREATE INDEX ix_source_snapshots_organization_id ON source_snapshots (organization_id);

CREATE INDEX ix_source_snapshots_run_id ON source_snapshots (run_id);

CREATE TABLE chain_anchors (
    report_id UUID NOT NULL,
    record_key VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    registry_address VARCHAR(42) NOT NULL,
    tx_hash VARCHAR(66),
    block_number INTEGER,
    status VARCHAR(30) NOT NULL,
    raw_transaction VARCHAR(4000),
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id),
    FOREIGN KEY(report_id) REFERENCES reports (id),
    UNIQUE (report_id)
);

CREATE INDEX ix_chain_anchors_organization_id ON chain_anchors (organization_id);

CREATE TABLE reviews (
    finding_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    decision VARCHAR(40) NOT NULL,
    explanation VARCHAR(2000) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    organization_id UUID NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(finding_id) REFERENCES findings (id),
    FOREIGN KEY(organization_id) REFERENCES organizations (id)
);

CREATE INDEX ix_reviews_finding_id ON reviews (finding_id);

CREATE INDEX ix_reviews_organization_id ON reviews (organization_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

COMMIT;
