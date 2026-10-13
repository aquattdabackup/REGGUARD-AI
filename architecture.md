# Architecture memory

Verified 12 October 2026. Root: C:/Users/luong/OneDrive/REGGUARD-AI. Initial repository contained only README; no AGENTS.md was present.

## Entry points and boundaries

- apps/web: Next.js App Router, strict TypeScript. Pages delegate to src/features; lib/api.ts handles authorized API requests and lib/types.ts defines responses. PDF viewer loads authenticated bytes. Public verifier uses the shared integrity package without uploading the artifact.
- services/api/app/main.py: FastAPI entry point; api/v1/routes.py endpoints; core/security.py Supabase JWKS and development-only demo tokens with membership/RBAC. New identities may only read /me or bootstrap /organization until membership exists.
- services/api/app/worker.py: document, evaluation and anchor jobs. services/jobs.py owns leases/heartbeats/retries; services/evaluation.py orchestrates immutable snapshots, connectors, rule evaluation, diffing and reports.
- services/ai.py grounds Structured Outputs in exact source/page/excerpt; deterministic fixture extraction is separate and labeled. services/rules.py evaluates versioned policies independently of the LLM.
- services/reports.py freezes report contents and renders PDF with packaged OFL Noto Sans; services/integrity.py and packages/shared-schemas/integrity.mjs share RFC 8785, domain-separated SHA-256 and a private random salt.
- contracts/src: append-only AuditRegistry and separately pinned IssuerEvidenceReceiver for CRE. services/blockchain.py checks finalized state plus transaction receipts/events. One worker per signer; public writes contain commitments only.
- cre/workflows/issuer-verification/main.ts: official SDK HTTP consensus, finalized EVM read and optional signed report write. SDK compilation does not establish CLI simulation or DON execution. Backend reads are not CRE execution.

## Persistence and configuration

- SQLAlchemy entities: services/api/app/models/entities.py. Frozen Alembic revision 0001_initial.py; infra/database/001_schema.sql is an alternative PostgreSQL installation with the same revision stamp. Do not run both paths on the same fresh database.
- Apply infra/database/002_supabase_rls.sql after schema setup on Supabase. It constrains tenant reads, revokes browser writes/private salt access, protects storage paths and freezes finalized reports. PGlite tests emulate auth/storage interfaces, not real hosted behavior.
- .env.example lists configuration. Server reads root .env; browser reads apps/web/.env.local. REGGUARD_ROOT supports installed Docker package paths. Do not save credentials in memory/docs.
- Demo requires APP_ENV=development and DEMO_MODE=true. SQLite/private filesystem under ignored .data is only the offline demonstration. Live mode requires Supabase/PostgreSQL.
- scripts/start-demo.ps1 and stop-demo.ps1 start/stop hidden processes and match tracked PID plus start time. Logs/data persist under .data. Local UI: localhost:3000; API: localhost:8000.

## Invariants

Missing, failed or ungrounded evidence never silently passes. Findings retain source modes/times and policy version. Tenant ownership is enforced before private reads. Replay uses the original snapshot and evaluation time. Reviews are attributable and do not rewrite deterministic outcomes. Finalization freezes payload/salt/hash/key; new information requires another report. A local hash match returns ANCHOR_NOT_FOUND; VERIFIED requires an independently trusted finalized on-chain record and matching event.

## Build and test

Node 24/Python 3.12/pnpm 12.11.2. pnpm install --frozen-lockfile runs the local PDF.js worker copy. See README for complete setup. Python: .venv/Scripts/python.exe -m pytest services/api/tests -q; .venv/Scripts/ruff.exe check services/api. Frontend: pnpm typecheck, pnpm lint, pnpm build; demo running: pnpm test:e2e. Python happy-path test creates .data/sample-report.json before node --test scripts/integrity.test.mjs. node scripts/test-database.mjs exercises real PostgreSQL semantics in PGlite. forge test --root contracts -vv. node scripts/test-local-chain.mjs requires local Anvil on 8545 and refuses non-Anvil clients. CRE build/setup in cre/README.md.

Exact results and incomplete production controls are in docs/TEST_REPORT.md, docs/FINAL_STATUS.md and docs/SECURITY.md. No real account-backed Supabase flow, paid LLM call, public Sepolia write, CRE simulation/DON execution, hosted backend has been verified. GitHub Actions run 38264164335 passed both application and contracts/CRE jobs for commit 5f6531a. Vercel frontend Linux build and public/browser smoke checks have passed at https://regguard-ai.vercel.app.

## Hosted configuration and local setup

- New Supabase keys: browser `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy ANON fallback); server `SUPABASE_SECRET_KEY` (legacy SERVICE_ROLE fallback). Opaque secret keys use only the apikey header; legacy JWT keys retain Bearer authorization.
- Hosted frontend without NEXT_PUBLIC_API_BASE_URL reports backend unavailable and never defaults to the visitor's localhost. The independent verifier works without the API.
- scripts/local_setup.py is a loopback-only write-only OpenAI form with Host, Origin and CSRF checks. start-local-setup.ps1/stop-local-setup.ps1 manage its hidden process by PID/start time. It writes the ignored root .env; hosted secrets must be configured in Railway separately.
- Vercel root apps/web, outside-root workspace files enabled, Corepack/pnpm 12.11.2. Exact account setup is docs/ACCOUNT_SETUP.md. New Railway services use dashboard settings for API and worker; legacy TOML files are reference-only.
