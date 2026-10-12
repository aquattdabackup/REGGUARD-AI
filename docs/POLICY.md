# RG-DAR-001: Digital Asset Issuer Onboarding Readiness

This is a fictional internal policy specification for the product demonstration, not enacted law. Jurisdiction is deliberately identified as internal readiness; no jurisdictional legal approval is implied. Policy files are JSON-compatible YAML validated with Pydantic; arbitrary Python, JavaScript, `eval` and dynamic imports are not policy operators.

| Rule | Check | Result when unresolved |
|---|---|---|
| R01 | GLEIF returns the supplied LEI | UNKNOWN on outage; FAIL on explicit not-found |
| R02 | Registration ISSUED and entity ACTIVE, checked separately | UNKNOWN on missing fields/source |
| R03 | Grounded low-uncertainty legal names cover documents and match the GLEIF name after normalization | REVIEW_REQUIRED on differences or incomplete name coverage; UNKNOWN with no usable name |
| R04 | Contract bytecode exists on the configured chain at a finalized block | UNKNOWN on unavailable RPC; FAIL on empty bytecode |
| R05 | Domain-bound, unexpired wallet proof where required | v1.0 scope exclusion PASS; v2.0 missing proof UNKNOWN |
| R06 | Grounded certificate and issuer_declaration labels | FAIL for missing required documents; UNKNOWN when a file cannot be classified |
| R07 | Independently extracted identifiers are consistent across at least two documents | REVIEW_REQUIRED on conflicts or insufficient independent fields |
| R08 | Source ages measured against the immutable evaluation timestamp | UNKNOWN if source is unavailable; FAIL outside permitted age |

v1.0 permits 72-hour source age and does not require wallet possession. v2.0 permits one hour and requires proof. Demo sources are intentionally two hours old, so replaying Aurora v1 under v2 changes R05 and R08 while preserving evidence bytes/time. The pure evaluator has tests for equal/not-equal/exists/in/before/after/numeric-range operators. The current evaluator supports this fixed eight-rule policy family, not arbitrary user-authored legal rule programs.

Outcomes: PASS, FAIL, UNKNOWN, REVIEW_REQUIRED. Overall precedence is FAIL, then REVIEW_REQUIRED, then UNKNOWN, then PASS. Severity is recorded but does not silently override status. Entity-name mismatch requests review rather than alleging fraud. Contract existence does not establish security or ownership. Wallet possession does not establish legal authority. Exact citations do not validate a document's authenticity.

Replay uses an old snapshot with a new policy. Recheck fetches new sources and records new hashes, fields and outcome diffs. Reviews append human decisions without rewriting findings. A finalized report includes reviews present at its own finalization time; subsequent review requires a new evaluation/report to be included.
