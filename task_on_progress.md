# Task on progress

12 October 2026. User requested Vercel hosting, GitHub source at aquattdabackup/REGGUARD-AI, setup instructions for Supabase/Railway/Sepolia/CRE, and a place to enter OpenAI later. Vercel login and deployment authorization are complete. Do not ask again. Overall live backend/public-testnet objective remains incomplete.

## Verified current state

- Frontend deployed READY: https://regguard-ai.vercel.app; deployment dpl_HFTqffstsrgKHv2VCjEbz3K7wmY5. Public HTTP 200 on /, /login, /verify. Chromium confirmed backend-unavailable message, no localhost requests, no unhandled page errors. Hosted login screenshot inspected.
- Vercel CLI 63.1.2, scope luong10, project regguard-ai; global config in ignored .data/vercel-auth. Never print/copy its secrets. Project root apps/web, sourceFilesOutsideRootDirectory enabled, Corepack/pnpm 12.11.2.
- Deployment used .data/vercel-frontend: 52 explicit frontend/build files. Automatic review refused a whole-repository Vercel upload; the narrower frontend-only upload succeeded. Do not upload backend/policies/docs/data to Vercel. Git auto-deployment is not connected.
- New Supabase publishable/secret key support has legacy fallback. Live account behavior remains untested. Hosted frontend no longer falls back to the visitor's localhost API.
- Local OpenAI entry form http://127.0.0.1:8765/ is running via scripts/start-local-setup.ps1, with a tracked hidden process. Host/Origin/CSRF guards, write-only .env update, no external call. Restart helper if the environment stops it. Hosted keys belong in Railway Variables.
- docs/ACCOUNT_SETUP.md contains exact dashboard settings and environment variables for all requested services. Railway Config as Code is deprecated for new services; dashboard setup is documented, legacy API and worker TOML examples are labeled.
- Regression: Python 35 passed (33 API + 2 setup) in 6.18s; Ruff/format passed 38 files; Playwright 4 passed in 41.9s. Next local/Vercel Linux production builds and strict TypeScript/ESLint pass. Prior Solidity 16 incl. 256 fuzz, integrity 5, Anvil 3 assertions, PGlite SQL/RLS and PDF visual checks passed. No changed contracts/CRE require rerunning those checks.
- No paid OpenAI call, public Sepolia transaction, authenticated CRE simulation/DON execution, hosted Supabase/Railway, or Docker runtime has been verified.

## Repository publication

Remote origin is the user-supplied GitHub URL. Remote HEAD still ca0e6019e6723dd81a025a125aa5c11b71a68a2e. Source scan found no credential patterns; .env.local/.data/.vercel are ignored. Vercel CLI added .env* ignore; explicit exceptions now retain empty .env.example templates. Local Markdown links resolve. Source awaits initial implementation commit/push and hosted CI inspection.

## Remaining next actions

1. Commit and push reviewed source normally (no force) to the user-supplied GitHub target; inspect Actions results if available. Git mutations need sandbox escalation. Preserve configured author identity.
2. Deliver real website, local OpenAI form, account setup guide and concise Vietnamese steps.
3. User has an asynchronous prompt to create Supabase and return only its public Project URL. No private credentials should be pasted in chat. Configure hosted secrets in dashboards, apply SQL/RLS, then connect API/worker and Vercel public variables.
4. Later: paid extraction with an approved key/budget; dedicated funded Sepolia signer and registry; CRE login/config/simulation. Authenticated CRE execution-artifact ingestion still needs implementation.

## Runtime and files

Managed local demo at localhost:3000/login; API localhost:8000/docs. scripts/start-demo.ps1 and stop-demo.ps1 track PID/start times under .data and preserve evidence. Helper scripts manage setup separately. Backend routes: services/api/app/api/v1/routes.py; storage: app/services/documents.py; key configuration: app/core/config.py. Architecture memory and docs/TEST_REPORT, FINAL_STATUS, HOSTED_DEPLOYMENT, BLOCKERS describe evidence and boundaries.
