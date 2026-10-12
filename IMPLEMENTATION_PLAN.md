# RegGuard AI implementation plan

Build an evidence-first issuer onboarding workflow. English product/docs; Vietnamese progress updates.

1. Requirements and reproducible monorepo: official requirement review, dependency setup, policy schema.
2. Persistence and authorization: SQLAlchemy/Alembic, Supabase JWT, roles, RLS, private storage; isolated local fixture mode.
3. Complete backend flow: cases, safe PDF/DOCX ingestion, durable worker, GLEIF/RPC, grounded structured extraction, deterministic rules.
4. Reports and differentiation: immutable snapshots, human review, replay, recheck, PDF/JSON, canonical commitments.
5. Connected Next.js product: marketing, auth, dashboard, case inspector, policies, reports, verifier, settings.
6. Solidity and CRE: append-only registry, tests, independent verifier, official SDK workflow; simulate/deploy only with actual tooling/access.
7. Verification and delivery: backend/security tests, frontend build/lint/typecheck/E2E, contract checks, deployment configuration and submission material.

## Acceptance
The full user brief is the acceptance source. Every verified, fixture-only, unverified, and blocked feature will be recorded in PROGRESS.md and docs/TEST_REPORT.md. No external deployment or paid service use without the authorization requested by the brief.
