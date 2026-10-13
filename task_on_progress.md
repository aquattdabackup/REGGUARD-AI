# Task on progress

13 October 2026. Current account/deployment step: Vercel hosting and GitHub publication completed. User supplied Supabase Project URL/publishable key; they are configured in the deployed browser bundle. The overall live backend/public-testnet objective is incomplete. No new deployment permission or Vercel login is needed.

## Verified state

- Website https://regguard-ai.vercel.app; verifier /verify. Latest deployment dpl_79T7MS9V8nvqdBULXPjbAnNLiMxw reached READY on 13 October. Public HTTP 200 and Chromium smoke passed /, /login, /verify. Correct public Supabase settings confirmed in downloaded JS; no localhost requests/unhandled errors. Hosted screenshot retained.
- Supabase project nlhbzmympinzochztihf. Public auth-settings/JWKS reads succeeded (HTTP 200, ES256). Real signup/reset, SQL installation, private storage and database access are NOT verified. Public key is stored only in ignored .data/vercel-public-env.json and Vercel variables; do not copy it into memory/source.
- Vercel CLI 63.1.2: scope luong10, project regguard-ai, global config .data/vercel-auth (ignored, never print). CLI path C:/Users/luong/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/index.js. Deploy uses .data/vercel-frontend: 52 explicit frontend/build files; do not upload backend/policies/docs/data. A prior whole-repository upload was rejected, and the narrower upload succeeded. Git auto-deploy is not connected.
- Three production public variables are set: APP_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (all with NEXT_PUBLIC_ prefix). NEXT_PUBLIC_API_BASE_URL remains absent until Railway is running. Root apps/web, outside-root workspace files enabled, Corepack/pnpm 12.11.2.
- GitHub source pushed to aquattdabackup/REGGUARD-AI main. Implementation commit 0686c78, SQL encoding correction 5f6531a95dc4b3a60a68e85630c8c6a43d586375. GitHub Actions run 38264164335 passed BOTH application and contracts-and-cre. The initial run failed on a re-encoded SQL BOM; the actual SQL file was fixed and local PGlite plus hosted CI passed.
- Git push uses existing credentials: git -c credential.https://github.com.username=aquattdabackup push origin main. No login needed; never print credential values. Mutations require sandbox escalation.
- Local Python: 35 passed (33 API + 2 setup), Ruff/format passed 38 files. Browser 4 passed in 41.9s. Hosted CI additionally passed Python/JS/PGlite/Next/TypeScript/ESLint/Playwright, Foundry and CRE WASM build on Linux.
- No paid OpenAI call, public Sepolia write, authenticated CRE simulation/DON execution, hosted backend or Docker runtime is claimed.

## Live local processes

Restored and HTTP-checked on 13 October: demo localhost:3000/login, API localhost:8000/ready, OpenAI setup http://127.0.0.1:8765/. Helpers start-demo/stop-demo and start-local-setup/stop-local-setup manage hidden processes by PID/start time in .data. If the environment stops them, run the helpers again; preserve evidence. The OpenAI form is loopback-only, write-only, guarded by Host/Origin/CSRF, and writes only OPENAI_API_KEY in ignored root .env. It makes no external/model call, and does not configure Railway. Local files are plaintext under OneDrive.

## Pending user answers / next steps

The user was asked (async) whether both Supabase SQL scripts ran successfully and whether a Railway project exists (send its URL). Do not ask for the already-supplied Supabase URL/key again. Read their next reply as steering this task.

1. Supabase SQL: on a new database, 001_schema.sql then 002_supabase_rls.sql once each. Do not also run initial Alembic. Set Site URL/redirects and SMTP as in docs/ACCOUNT_SETUP.md.
2. Railway: user requested guidance, not purchase of a subscription. Create API + worker from repository root, Dockerfile services/api/Dockerfile. API /ready; worker python -m app.worker, no health endpoint, one replica. New services use dashboard settings (legacy TOML is deprecated). Private DATABASE_URL and SUPABASE_SECRET_KEY go into both services' Variables; no secrets in chat.
3. When Railway API URL is available, set NEXT_PUBLIC_API_BASE_URL (no /api/v1 suffix) in Vercel, redeploy the same frontend-only package, validate real auth and private files.
4. OpenAI key entry later: local form or hosted Railway Variables; no paid test requested yet. Sepolia requires dedicated funded signer/admin/operator and real deployment. CRE login/account/config/simulation pending; authenticated execution-artifact ingestion is still an implementation gap.

## Delivery and remaining scope

ACCOUNT_SETUP is the full English guide for Supabase/Railway/Vercel/OpenAI/Sepolia/CRE; user communication is Vietnamese. README, TEST_REPORT, FINAL_STATUS, HOSTED_DEPLOYMENT, BLOCKERS and architecture.md record evidence. Documentation-only follow-up records the verified deployment/CI state without changing tested application source. Production gaps include retention/deletion, team administration, signer isolation/nonce coordination, parser OS resource isolation, monitoring/backups and security review. Competition submission is not authorized or sent.
