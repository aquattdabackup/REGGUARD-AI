# API reference

Base: `/api/v1`. Interactive schema: `/docs`; generated snapshot: `docs/openapi.json`. Private endpoints require `Authorization: Bearer <Supabase access token>` or a development-only opaque demo token. A signed-in user without a membership may bootstrap one organization. Organization identity is resolved server-side.

| Endpoint | Behavior |
|---|---|
| GET /config | Public auth/demo availability; no secrets |
| POST /demo/session | Development only; isolated fictional workspace |
| GET /me; POST /logout | Role, organization, connection configuration / session logout |
| POST, PATCH /organization | Bootstrap / owner-admin name update |
| GET, POST /cases | Paginated/searchable list / create |
| GET, PATCH /cases/{id} | Detail with documents/runs/reports / title and notes update |
| POST /cases/{id}/documents | Multipart upload; 202 with durable parsing job |
| GET /cases/{id}/documents | Tenant-authorized evidence metadata |
| GET /documents/{id}/content | Authorized original bytes, digest checked |
| GET /documents/{id}/signed-url | Live private storage URL, 60 seconds |
| POST /cases/{id}/analyze or /recheck | Durable evaluation; requires Idempotency-Key |
| GET /runs/{id}; GET /runs/{id}/findings | Stages/snapshot/diffs, cited findings |
| POST /findings/{id}/review | Attributed reviewer decision; no finding mutation |
| GET /policies; GET /policies/{id} | Versioned policy content and hash |
| GET /reports; GET /reports/{id} | Tenant report metadata / payload (salt excluded) |
| POST /reports/{id}/finalize | Idempotent immutable finalization |
| GET /reports/{id}/download?format=json or pdf | Finalized private export; JSON includes salt |
| POST /reports/{id}/anchor | Queue configured Sepolia anchor; no fabricated success |
| GET /reports/{id}/verify | Local integrity and configured public-chain check |
| GET /cases/{id}/history; GET /audit-events | Attributed case / organization events |
| GET /dashboard | Aggregate actual latest completed evaluation data |
| POST /cases/{id}/wallet/nonce or /wallet/verify | Expiring domain-bound possession proof |
| GET /health; GET /ready | Process / database readiness (outside /api/v1) |

Evaluation body: `{"policy_version":"1.0"}`. Replay: `{"policy_version":"2.0","replay_run_id":"<completed run UUID>"}` against the same case. Controlled `scenario` is accepted only in fixture mode: valid-case, mismatched-case, missing-data-case, changed-source-case, api-failure. Use a new idempotency key when changing request semantics. Reusing a key for another case/policy/replay is rejected.

Typical queued response: `{"run_id":"...","job_id":"...","status":"QUEUED"}`. Poll the run to see COLLECTING/EVALUATING or the final outcome; percentages are not invented. A failure contains a sanitized failure code. HTTP errors have `error.code`, `error.message` and usually `error.request_id`; validation adds field locations. 401 unauthenticated, 403 role denied, 404 hidden/not found, 409 conflicting state, 413 request cap, 422 invalid evidence/input, 429 rate limited, 503 missing required service.

Frontend response types live in `apps/web/src/lib/types.ts`; extraction and policy schemas live in `services/api/app/schemas/domain.py`. OpenAPI currently has fully validated request bodies but not a detailed response model for every endpoint. No public administrative DML, external webhook or unauthenticated document download exists.
