# Deployment runbook

Frontend deployed and smoke-tested at https://regguard-ai.vercel.app on 13 October 2026. Supabase public URL/key are configured in the deployed bundle; private database/storage and Railway services remain pending. Account setup and exact dashboard steps are in [ACCOUNT_SETUP](ACCOUNT_SETUP.md). Private Supabase services, Railway, paid OpenAI extraction and public contracts remain unconfigured; local tests do not establish those integrations.

## Supabase and API

1. Create a Supabase project. Configure asymmetric JWT signing (ES256/RS256), email verification, Site URL and allowed redirect URLs for `/login` and `/reset-password`. Legacy shared-secret HS256 tokens are deliberately not accepted.
2. Configure the server `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), `DATABASE_URL` and exact `APP_ORIGIN`. Use the direct database/session pooler connection for migrations and persistent worker transactions, not a transaction-mode endpoint with incompatible prepared statements.
3. On a new database run `python -m alembic -c services/api/alembic.ini upgrade head`. Alternatively apply `infra/database/001_schema.sql` in the SQL editor. **Choose one**; the SQL export includes the Alembic revision stamp.
4. Apply `infra/database/002_supabase_rls.sql` once as the database administrator. It requires Supabase's `auth` and `storage` schemas. It creates the private evidence bucket, membership read policies and final-report immutability trigger. Review existing bucket policies first: permissive pre-existing policies can broaden access.
5. Set `APP_ENV=production`, `DEMO_MODE=false`. Runtime rejects demo mode outside development and rejects live SQLite. Configure storage bucket `evidence`. Keep PostgreSQL and service-role credentials server-only.
6. Create two Railway services with repository root `/` and Dockerfile `services/api/Dockerfile`. Configure new services through the dashboard as described in ACCOUNT_SETUP; Railway now deprecates Config as Code. API uses the Docker CMD and `/ready` health check. Worker overrides start command with `python -m app.worker`, has no HTTP health endpoint, and runs **one replica** while sharing a signer. Apply migrations before either starts. The root `railway.toml` and `infra/railway-worker.toml` are legacy references only.
7. Add secrets in the host dashboard, never in repository files. Set container memory/CPU/time limits, TLS, request size limits, distributed edge rate limiting, log retention and backup/restore policy. Restrict backend egress as described in SECURITY.

`services/api/Dockerfile` runs as a non-root user. Its build is provided but not executed here because Docker's daemon was unavailable. The test suite exercises processes directly; it does not establish a working Railway deployment.

## Frontend

Set Vercel project root to `apps/web`, enable access to files outside that root for the workspace package, and use its `vercel.json`. Add only `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the browser-safe Supabase anon/publishable key. These are compiled into the bundle: rebuild after changing them. Confirm the API CORS origin exactly matches the Vercel production domain.

Register and verify a test user. First login may create an organization. Add team memberships through a controlled administrator procedure; there is no public self-grant or invitation endpoint. Verify Viewer cannot write, Analyst cannot finalize, and one organization cannot download another's evidence.

## OpenAI

Set `OPENAI_API_KEY`, `OPENAI_MODEL` and a small `AI_MONTHLY_BUDGET_USD`. Cost rates are configurable accounting assumptions, not a live billing quotation. Update them against the provider's pricing when changing models. Conservative input-byte/output/retry reservations are retained even on failure. Project-level provider budgets remain the billing authority. Structured extraction with a paid live model was not called in this build.

## Sepolia registry

Use Foundry and an encrypted keystore or wallet. Obtain test ETH, independently confirm chain ID 11155111 and retain deploy receipts. Example (substitute verified addresses and a secure RPC environment variable):

```bash
export REGISTRY_ADMIN_ADDRESS=0xYOUR_ADMIN
export ANCHOR_OPERATOR_ADDRESS=0xYOUR_OPERATOR
forge script contracts/script/Deploy.s.sol:Deploy --root contracts --rpc-url "$EVM_RPC_URL" --account your-keystore --broadcast
```

Set `AUDIT_REGISTRY_ADDRESS`, `EVM_RPC_URL`, `EVM_CHAIN_ID=11155111` and the operator secret on the **worker**. The API currently checks signer configuration to enable queueing, so its environment also needs the signer presence; isolate both services as privileged and migrate to a signer service before production. Never expose it to the frontend. Registry administrator should be a separate controlled address; revoke operator access if compromised.

An anchor is confirmed only after successful receipt and matching finalized registry state/event. Persist signed bytes before broadcast. A lost pending transaction can remain pending; investigate nonce/funding/RPC and resume safely rather than generating a second record key. No replacement-transaction UI is implemented.

CRE deployment and the pinned receiver have additional account/forwarder/workflow-identity prerequisites in `cre/README.md`. Do not substitute a permissive receiver to make a simulator appear successful.

## Acceptance before public use

Run the documented tests, then test real signup/email verification/password reset, private storage signed URL expiry, cross-tenant access, real extraction with citations, public Sepolia anchoring and independent verification. Record exact host URLs and explorer receipts in TEST_REPORT. Establish data-processing terms, deletion/retention controls, operational ownership and backups. Vercel deployment was authorized by the user; additional accounts and funded public-chain actions still need configuration. This runbook is not evidence that those checks have occurred.
