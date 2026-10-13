# Executed verification report

Test date: 12 October 2026, Windows, Node 24.19.0, Python 3.12.10, pnpm 12.11.2. Tests ran against local code and an isolated fictional dataset. No production data, paid LLM requests or public blockchain writes were used. Counts below are observed results, not coverage estimates.

## Passing checks

| Area | Command executed | Observed result |
|---|---|---|
| Python workflow/security/edge cases | `.\.venv\Scripts\python.exe -m pytest services/api/tests scripts/tests -q` | 35 passed (33 API + 2 setup); one upstream Starlette TestClient deprecation warning |
| Python lint | `.\.venv\Scripts\ruff.exe check services/api scripts/local_setup.py scripts/tests` | All checks passed |
| Python format | `.\.venv\Scripts\ruff.exe format --check services/api scripts/local_setup.py scripts/tests` | 38 files already formatted (API and local setup utility/tests) |
| Web production build + TypeScript | `node apps/web/node_modules/next/dist/bin/next build apps/web` | Production build and strict TypeScript passed; 17 prerendering tasks completed; static and dynamic routes emitted |
| CRE TypeScript | `node node_modules/typescript/bin/tsc --noEmit -p cre/workflows/issuer-verification/tsconfig.json` | Passed |
| Source formatting | `node node_modules/prettier/bin/prettier.cjs --check apps/web/src apps/web/tests packages/shared-schemas/integrity.mjs packages/shared-schemas/integrity.d.ts cre/workflows/issuer-verification/main.ts scripts` | All matched files use Prettier code style |
| Web ESLint (from apps/web) | `node node_modules/eslint/bin/eslint.js .` | Passed |
| Cross-language commitments | `node --test scripts/integrity.test.mjs` | 5 passed; Python-generated package agrees with JavaScript |
| Standalone offline CLI | `node scripts/verify-report.mjs .data/sample-report.json` | Integrity true; ANCHOR_NOT_FOUND, correctly not an authenticity claim |
| PostgreSQL SQL/RLS | `node scripts/test-database.mjs` | Schema, tenant/storage isolation, browser DML denial, private-table denial and finalized-report immutability assertions passed in PGlite |
| Solidity (local installed binary) | `.\.tools\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test --root contracts -vv` | 16 passed, 0 failed; fuzz test ran 256 inputs |
| Actual local chain | `node scripts/test-local-chain.mjs` with Anvil on 127.0.0.1:8545 | 3 assertions passed: authentic finalized anchor, unrelated transaction rejection, modified report rejection |
| Functional browser journeys | `node apps/web/node_modules/@playwright/test/cli.js test --config apps/web/playwright.config.ts` | 4 passed in 41.9 seconds: 3 functional journeys and accessibility/keyboard regression |
| PDF export | Pytest export + PyMuPDF page rasterization | Three pages inspected visually. Font rendering, margins, readable hashes and heading continuation checked |

The final PDF layout change was additionally checked with `pytest services/api/tests/test_workflow.py::test_happy_path_finalize_export_and_tamper -q`: 1 passed. That is a repeat of one of the API tests, not an additional test count. Frontend builds were repeated after accessibility changes. No line/branch coverage measurement was collected.

The local Anvil run produced registry `0x5fbdb2315678afecb367f032d93f642f64180aa3` and transaction `0x3205158f3f77b1f2e8e86a1b46a26b28390e458627df97df943ab50a223efd69`. These identify the ephemeral local chain only. They must not be entered into a public Sepolia explorer or submission as deployed testnet evidence. The contract artifact was genuinely deployed and transacted on that local chain; it was not a mocked RPC success.

## What the tests establish

Python tests cover the valid eight-rule flow, report finalization idempotency, JSON/PDF export and tampering, mismatch review without rule override, policy replay with preserved snapshots, source changes, unavailable providers, cross-tenant cases/documents/runs/reports, role denial, malformed/unsupported uploads, real PDF parsing, citation grounding and injection-like output rejection, bounded DOCX/scanned-PDF behavior, allowed policy operators, wallet nonce replay/expiry, semantic idempotency conflicts, chunked request limits/CORS, exhausted leases, stale worker completion and bootstrap for a mocked verified identity.

Browser journeys exercise the real UI/API/worker: launch demo, evaluate Aurora, inspect its PDF citation, record review, finalize/export, verify JSON locally, detect a tampered copy, replay v2, recheck the lapsed-source fixture and observe changed results. A 390 x 844 mobile test creates a case and checks horizontal overflow. The third journey uploads a supported PDF to Meridian and waits for the worker's READY result. The main flow collects unhandled page errors and asserts none.

The final browser suite returned 4 passed, 0 failed. The upstream Python deprecation and Playwright NO_COLOR/FORCE_COLOR messages are warnings, not application exceptions.

PGlite executes PostgreSQL semantics against the actual schema/RLS SQL. Minimal auth/storage schemas emulate Supabase interfaces. This validates policy logic but not Supabase's hosted JWT, email, storage HTTP, connection pooling or service-role configuration.

Solidity tests cover access control, zero/duplicate rejection, record getters/verification/events and the CRE receiver's forwarder/workflow/owner/freshness/replay checks. These do not prove live CRE execution.

## Network and CRE evidence

Actual read-only connector results are in [LIVE_READ_RESULTS.json](LIVE_READ_RESULTS.json): the official GLEIF endpoint returned Bloomberg Finance L.P. for LEI 5493001KJTIIGC8Y1R12; a public Sepolia RPC returned finalized block 11896315 and no bytecode at the zero address. Those standalone smoke checks are separate from fictional issuer fixture cases. A successful reference lookup is not a legal compliance assessment.

The official SDK 1.23.0 workflow compiled with Bun and Javy 8.1.0 using the SDK's `cre-compile.ts` entry point. The observed WASM size and SHA-256 are in [CRE_BUILD_RESULT.json](CRE_BUILD_RESULT.json). Equivalent reproducible command from the workflow directory: `bun x --no-install cre-compile main.ts dist/workflow.wasm`.

Official CRE CLI v1.38.0 was invoked with `workflow simulate`, the workflow directory, `--project-root cre`, `--target staging-settings`, the example config and prebuilt `--wasm`, `--trigger-index 0 --non-interactive`. It returned **Authentication required: not logged in and no CRE_API_KEY set** before any capability execution. Status: BLOCKED, not passed. The example addresses must also be replaced before an authenticated real run.

## Accessibility and visual review

Axe-core 4.14.0 checks passed with zero violations for the tested WCAG 2 A/AA and 2.1 AA rules on the landing page, verifier, login, dashboard, case creation, policies, reports, audit, settings, evidence inspector and seven additional case tabs. Keyboard skip-navigation and arrow-key tab switching also passed. Initial checks found low-contrast secondary text, an unlabelled readonly Organization input and an unfocusable PDF scroll region; those issues were corrected. Automated checks do not establish complete WCAG conformance, and manual assistive-technology testing remains outstanding. Screenshots in [screenshots](screenshots/) are produced by Playwright, not mockups. The PDF's full rendered pages were viewed after layout fixes.

## Failed attempts and resolved issues

Earlier iterations exposed a PDF blob/CSP issue, a deprecated parser import polluting the subprocess JSON protocol, an RLS trigger comparing PostgreSQL JSON using an unsupported equality operator, overly broad demo/preflight throttling, bootstrap without membership, a browser selector ambiguity and an inaccessible text palette. The corresponding code/test fixes and passing reruns are recorded above. A local-chain run failed when its Anvil process had stopped; starting the tracked local process and rerunning produced the passing transaction described above. These unsuccessful attempts are not counted as passing checks.

## Unexecuted or blocked checks

- Real Supabase registration/login/email confirmation/reset, private storage and hosted migration flows: public Project URL/key configured, but private backend configuration and test identities are still missing.
- Paid OpenAI Structured Outputs/accuracy/adversarial model evaluation: no approved key/budget; fixture extraction is not an AI accuracy evaluation.
- Public Sepolia deployment/anchor/finality, CRE simulation/DON execution: missing authorization/funding/accounts/configuration described in BLOCKERS.
- Docker image runtime: no available daemon. Railway deployment remains unconfigured. GitHub Actions hosted result is recorded separately when observed.
- Load/penetration/recovery testing, full manual assistive-technology review, mobile Safari/Firefox, production retention/legal-policy review: not performed.

The application CI configuration is supplied in `.github/workflows/ci.yml`. The successful hosted run is recorded below. Production limits and the remaining acceptance items are in [SECURITY](SECURITY.md), [FINAL_STATUS](FINAL_STATUS.md) and [BLOCKERS](../BLOCKERS.md).

## Hosted frontend and account configuration checks

Vercel deployment `dpl_HFTqffstsrgKHv2VCjEbz3K7wmY5` completed with READY status at https://regguard-ai.vercel.app. Linux installation with pinned pnpm 12.11.2, Next build and strict TypeScript passed. An explicit 52-file frontend/build bundle excluded private data, backend, policies and documentation. Public HTTP checks for `/`, `/login` and `/verify` returned 200. A Chromium smoke check confirmed the missing-backend explanation, no localhost requests and no unhandled page errors. The real hosted login screenshot is in `screenshots/hosted-login.png`. Supabase/Railway remain disconnected.

Four new API tests cover new/legacy Supabase storage key headers and missing-key refusal. Two setup tests cover preserving other environment settings, rejecting malformed keys, Host/Origin/CSRF guards and never returning saved key bytes. The loopback form returned 200 at http://127.0.0.1:8765/. No real key was submitted or paid extraction called. Full Python rerun: 35 passed in 6.18s; full browser rerun: 4 passed in 41.9s.

## GitHub CI verified on 13 October 2026

Commit `5f6531a95dc4b3a60a68e85630c8c6a43d586375` passed [GitHub Actions run 38264164335](https://github.com/aquattdabackup/REGGUARD-AI/actions/runs/38264164335): application and contracts-and-cre both completed successfully. The application job passed Python lint/format/tests, JavaScript integrity, PGlite, TypeScript/ESLint/Next build and Playwright. The contract job passed Foundry and CRE WASM compilation. This verifies Linux CI; it does not establish paid AI, account-backed storage, public-chain transactions or authenticated CRE execution.

The first hosted run exposed an incorrectly re-encoded UTF-8 byte-order marker in the initial SQL export. The export now starts with plain ASCII BEGIN; local PGlite and the full corrected hosted run passed. Supabase public auth-settings/JWKS checks returned HTTP 200 and ES256 for the user-supplied project; no test user was created and no private database or storage operation was performed.

On 13 October the frontend was rebuilt with the supplied Supabase public configuration: deployment `dpl_79T7MS9V8nvqdBULXPjbAnNLiMxw` reached READY at the same production URL. Browser smoke checks again passed all three public pages, confirmed the correct Supabase URL/key in downloaded JavaScript, and found no localhost requests or unhandled errors. Backend connectivity remains unavailable pending Railway.
