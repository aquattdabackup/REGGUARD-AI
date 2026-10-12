export type Status = "PASS" | "FAIL" | "REVIEW_REQUIRED" | "UNKNOWN" | string;
export interface Case {
  id: string;
  title: string;
  legal_entity_name: string;
  lei: string | null;
  chain_id: number;
  contract_address: string;
  wallet_address: string | null;
  wallet_proof: { verified?: boolean };
  policy_version: string;
  notes: string;
  status: Status;
  mode: string;
  scenario: string;
  created_at: string;
  documents?: EvidenceDocument[];
  runs?: Run[];
  reports?: Report[];
}
export interface ExtractedField {
  field: string;
  value: string | null;
  document_id: string;
  page: number;
  excerpt: string;
  status: string;
  uncertainty: string;
}
export interface EvidenceDocument {
  id: string;
  filename: string;
  mime_type: string;
  sha256: string;
  status: string;
  size_bytes: number;
  error_code: string | null;
  pages: { page: number; text: string; reference_type: string }[];
  extraction: {
    fields?: ExtractedField[];
    provider?: string;
    model?: string;
    prompt_version?: string;
    error?: string;
  };
}
export interface EvidenceRef {
  kind: string;
  document_id?: string;
  page?: number;
  excerpt?: string;
  provider?: string;
  source_identifier?: string;
  source_hash?: string;
  mode?: string;
}
export interface Finding {
  id: string;
  rule_code: string;
  title: string;
  status: Status;
  severity: string;
  observed_value: { value: unknown };
  expected_value: Record<string, unknown>;
  explanation: string;
  evidence_refs: EvidenceRef[];
}
export interface Review {
  id: string;
  finding_id: string;
  decision: string;
  explanation: string;
  reviewer_id: string;
  reviewed_at: string;
}
export interface Source {
  id: string;
  provider: string;
  source_identifier: string;
  fetched_at: string;
  source_hash: string;
  mode: string;
  normalized_data: Record<string, unknown>;
  raw_data: Record<string, unknown>;
}
export interface Policy {
  id: string;
  policy_code: string;
  version: string;
  jurisdiction: string;
  policy_hash: string;
  effective_at: string;
  rules_json: {
    code: string;
    version: string;
    title: string;
    description: string;
    rules: {
      code: string;
      title: string;
      severity: string;
      operator: string;
      expected: Record<string, unknown>;
    }[];
  };
}
export interface Run {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  failure_code: string | null;
  findings?: Finding[];
  reviews?: Review[];
  sources?: Source[];
  policy?: Policy;
  diff: {
    kind: string;
    rule_code?: string;
    provider?: string;
    before: unknown;
    after: unknown;
    reason?: string;
  }[];
  cre_evidence: { status: string; reason: string };
  snapshot?: { documents: EvidenceDocument[] };
}
export interface Anchor {
  status: string;
  chain_id: number;
  registry_address: string;
  record_key: string;
  tx_hash: string | null;
  block_number: number | null;
}
export interface Report {
  id: string;
  run_id: string;
  status: string;
  version: number;
  report_hash: string | null;
  policy_hash: string;
  record_key: string | null;
  finalized_at: string | null;
  created_at: string;
  anchor?: Anchor | null;
  payload?: {
    case: Case;
    disclaimer: string;
    mode: string;
    evaluation_timestamp: string;
    findings: Finding[];
    reviews: Review[];
    uncertainties: string[];
    policy: Policy["rules_json"];
  };
}
export interface AuditEvent {
  id: string;
  event_type: string;
  actor_id: string;
  created_at: string;
  event_payload: Record<string, unknown>;
}
export interface Profile {
  user_id: string;
  organization: { id: string; name: string } | null;
  role: string;
  mode: string;
  members: { id: string; user_id: string; role: string }[];
  integrations: Record<string, string>;
  ai_usage_reserved_usd: number;
  ai_budget_usd: number;
  retention: string;
}
export interface Dashboard {
  total_cases: number;
  evaluated_cases: number;
  finalized_reports: number;
  source_alerts: number;
  mode: string;
  findings: Record<string, number>;
}
