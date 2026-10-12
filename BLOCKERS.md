# External blockers and incomplete work

Status: 12 October 2026. The local demonstration is implemented and tested. The complete production/hackathon deployment objective is not finished.

| Item | State and exact reason | Next action |
|---|---|---|
| Supabase identity, hosted PostgreSQL and private storage | BLOCKED: no project URL/keys, database connection or test account supplied. JWT/RBAC code exists; SQL/RLS ran in PGlite with emulated Supabase interfaces. This is not hosted Supabase verification. | Configure a test project, apply schema and RLS, verify registration/email/reset, membership and cross-tenant storage using two real accounts. |
| Live AI extraction | BLOCKED: no OpenAI API key or paid-call authorization. Structured Outputs integration and citation validation exist; the demo uses labeled deterministic extraction fixtures. | Configure an approved key/budget and evaluate representative documents, ambiguity and adversarial inputs. |
| Public Sepolia anchor | BLOCKED: no authorized funded signer and deployed trusted registry. Read-only Sepolia RPC succeeded; Anvil transactions succeeded locally. | Deploy with a separately controlled administrator and permitted operator, then verify finalized state, receipt and event on public Sepolia. |
| CRE simulation and DON execution | BLOCKED: official CLI is installed and the official SDK workflow compiles, but simulation exits with authentication required. No CRE login/API key or DON access supplied. | Authenticate CRE locally, configure RPC/contracts, simulate and retain real execution output. DON deployment requires its own access and approval. |
| Hosted backend and CI | PARTIAL: Vercel frontend is READY at https://regguard-ai.vercel.app; public and browser smoke checks passed. GitHub target is aquattdabackup/REGGUARD-AI. Railway/Supabase accounts remain unconfigured. | Follow ACCOUNT_SETUP, connect backend variables, then verify real identity/storage and hosted CI. |
| Docker runtime validation | UNVERIFIED: Docker client exists, but no running daemon. | Build and smoke-test API and worker containers on an available Docker host. |
| Official submission details | UNVERIFIED: DoraHacks rules were not accessible. Exact deadline/timezone, eligibility, rubric, bounty conditions and video format are not confirmed. | Recheck official organizers' current rules and fill in team, source URL, demo URL, real contract and video. No submission has been sent. |

The remaining production work is documented in [SECURITY](docs/SECURITY.md): retention/deletion, organization switching/invites, distributed rate limiting, stricter CSP, authenticated CRE execution-artifact ingestion, signer isolation and nonce coordination, parser OS resource isolation, backups, observability and independent security/legal review. These are implementation gaps, not missing credentials.

The API validates typed request bodies; detailed response models do not yet cover every endpoint. Case creation/read/title-and-notes update are available; deletion is not implemented because an evidence-retention workflow still needs to be designed. No OCR, billing, notifications or multi-chain support is claimed.
