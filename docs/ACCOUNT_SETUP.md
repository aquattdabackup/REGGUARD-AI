# Account setup for RegGuard AI

Updated 12 October 2026. Complete the sections in order. Frontend: https://regguard-ai.vercel.app. Backend accounts and public contracts are not connected yet. The independent verifier is at https://regguard-ai.vercel.app/verify.

## 1. Supabase: database, identity and private files

1. Open https://supabase.com/dashboard and create a project named `regguard-ai`. Choose the organization, region and plan yourself. Keep the database password in your password manager.
2. In the project's SQL Editor, run [001_schema.sql](../infra/database/001_schema.sql) on the fresh database, then [002_supabase_rls.sql](../infra/database/002_supabase_rls.sql). Run each once; do not also run the initial Alembic migration. The first script stamps the migration revision. The second installs tenant policies and the private `evidence` storage bucket.
3. Copy the Project URL from Connect. Under Settings > API Keys, find the publishable key and secret key. The publishable key belongs in Vercel; the secret key belongs only in Railway. The application also accepts legacy anon/service-role keys. See [Supabase key documentation](https://supabase.com/docs/guides/getting-started/api-keys).
4. Open Connect and select **Session pooler**. Copy its actual host, port and username. Replace the password placeholder, percent-encode reserved password characters, replace the URI prefix `postgresql://` with `postgresql+psycopg://`, and append `?sslmode=require` (or `&sslmode=require` if a query already exists). Save the result as Railway `DATABASE_URL`. The persistent API and worker need session semantics. See [connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres).
5. Under Authentication URL Configuration, set Site URL to `https://regguard-ai.vercel.app`. Allow `https://regguard-ai.vercel.app/login` and `https://regguard-ai.vercel.app/reset-password`. For local live testing, separately add the corresponding localhost URLs.
6. In JWT signing settings, ensure the active signing key uses ES256 or RS256. This API verifies asymmetric JWKS and deliberately rejects legacy HS256. Follow [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys) if migration is needed.
7. Keep email confirmation enabled. Configure custom SMTP before testing signup with arbitrary external email addresses; Supabase's default sender is restricted to project team addresses. See [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
8. After Railway and Vercel variables are connected, register and confirm a test user, sign in, create the first organization, upload a fictional PDF and test password reset. Use another organization/account to check isolation. Do not upload real customer evidence during setup.

Safe to send back in chat: Project URL, project reference, and which steps completed. Enter the database password and secret key directly in Railway Variables, not in chat or GitHub.

## 2. Railway: API and background worker

Open https://railway.com/dashboard. Create a project and connect the GitHub repository `aquattdabackup/REGGUARD-AI`. Limit the GitHub installation to this repository when prompted. Select the plan/billing limits yourself; no paid Railway subscription was purchased in this session.

Create two services from that repository, both using branch `main` and repository root `/`. Configure these settings before deploying:

| Setting | `regguard-api` | `regguard-worker` |
|---|---|---|
| Dockerfile | `services/api/Dockerfile` | `services/api/Dockerfile` |
| Variable `RAILWAY_DOCKERFILE_PATH` | `services/api/Dockerfile` | `services/api/Dockerfile` |
| Start command | Leave empty to use Docker CMD | `python -m app.worker` |
| Health check | `/ready` | Empty / disabled |
| Replicas | 1 initially | 1 in one region |
| Public domain | Generate an HTTPS domain | None needed |
| Restart policy | On failure, 3 retries | On failure, 3 retries |

Railway's [Dockerfile documentation](https://docs.railway.com/builds/dockerfiles) describes custom paths. Its current [Config as Code migration notice](https://docs.railway.com/infrastructure-as-code) says new services use dashboard settings or IaC; legacy TOML configuration stops being read on 1 December 2026. Therefore, use the table above for new services. The repository's `railway.toml` and `infra/railway-worker.toml` are legacy references, not evidence that services exist.

Set the following in **Variables on both services**, using shared/reference variables if desired. Values in angle brackets must be replaced; do not enter the brackets.

```dotenv
APP_ENV=production
DEMO_MODE=false
APP_ORIGIN=https://regguard-ai.vercel.app
DATABASE_URL=<your postgresql+psycopg session-pooler URI>
SUPABASE_URL=<your project URL>
SUPABASE_SECRET_KEY=<your server-only secret key>
SUPABASE_STORAGE_BUCKET=evidence
CRE_MODE=unavailable
RAILWAY_DOCKERFILE_PATH=services/api/Dockerfile
```

The OpenAI and blockchain values can remain absent at this stage. Their features will report unavailable; the app must not silently substitute fixtures in live mode. Complete Supabase SQL setup first. Deploy the API, confirm `https://<api-domain>/ready` returns `status: ready` and `mode: live`, then deploy the worker and inspect its logs. Railway's [Variables guide](https://docs.railway.com/variables) explains edits and deployment of changes.

Copy the generated API URL, without a trailing slash or `/api/v1`, into Vercel `NEXT_PUBLIC_API_BASE_URL`. The frontend appends `/api/v1` itself.

## 3. Connect the existing Vercel website

Project dashboard: https://vercel.com/luong10/regguard-ai
Environment variables: https://vercel.com/luong10/regguard-ai/settings/environment-variables

Add these browser-safe values for Production, then redeploy:

```dotenv
NEXT_PUBLIC_APP_URL=https://regguard-ai.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://<your-railway-api-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

Never put the Supabase secret, database password, OpenAI key or wallet private key into a `NEXT_PUBLIC_` variable. Public variables are compiled into the browser bundle. The project already uses root `apps/web`, Node 24, access to workspace files, Corepack/pnpm 12.11.2 and `apps/web/vercel.json`. Its first deployment used a 52-file frontend-only bundle; Git-triggered Vercel deployment has not been connected.

Until these accounts are connected, the hosted auth screen explains the missing backend. The local fixture demo remains at http://localhost:3000/login while the managed demo processes are running.

## 4. OpenAI: enter the key later

- Create/manage a project key: https://platform.openai.com/api-keys
- Local entry form on this computer: http://127.0.0.1:8765/
- Hosted app entry point: https://railway.com/dashboard > your project > API and worker > Variables > `OPENAI_API_KEY`.

The local form writes only `OPENAI_API_KEY` into the ignored root `.env`, does not display it again, and makes no model request. The file is plaintext in this OneDrive project and may synchronize. It does not configure Railway. Restart local API/worker after saving; demo mode still uses labeled fixtures.

If the local link has stopped after restarting the computer, run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-setup.ps1
# Stop when finished:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-local-setup.ps1
```

For hosting, add the key to Railway and keep the model/budget settings below unless deliberately changing them:

```dotenv
OPENAI_MODEL=gpt-4.1-mini
OPENAI_MAX_OUTPUT_TOKENS=3000
AI_MONTHLY_BUDGET_USD=5
```

The application budget uses configured accounting rates; it is not a guaranteed provider billing cap. Set project controls on OpenAI as well. Saving a key does not authorize or run an automatic paid test. The existing model integration has not yet been validated against a paid request. See [OpenAI production guidance](https://developers.openai.com/api/docs/guides/production-best-practices).

## 5. Sepolia: prepare testnet access

1. Create a dedicated test wallet in your preferred Ethereum wallet. Keep its recovery phrase and private key private. Choose **Ethereum Sepolia**, chain ID `11155111`.
2. Request test ETH for its public address from a faucet listed on [Ethereum's Sepolia page](https://ethereum.org/developers/docs/networks/#sepolia). This application does not need mainnet ETH.
3. Create a Sepolia RPC endpoint with your chosen provider. Store its URL as `EVM_RPC_URL`; an authenticated provider URL may contain a secret, so do not publish it.
4. Choose public admin and operator addresses. The deployment script expects `REGISTRY_ADMIN_ADDRESS` and `ANCHOR_OPERATOR_ADDRESS`. Use a wallet/Foundry encrypted keystore to deploy; the reviewed command is in [DEPLOYMENT](DEPLOYMENT.md#sepolia-registry). Fund the transaction sender and operator with test ETH.
5. After an authorized deployment, record the actual contract address and Sepolia explorer receipt, then configure `AUDIT_REGISTRY_ADDRESS`, `EVM_CHAIN_ID=11155111`, `EVM_RPC_URL` and `ANCHOR_SIGNER_PRIVATE_KEY` on the privileged backend services. The current API checks signer presence before queueing, so both API and worker need that configuration; this must be replaced with a separate signing service before production. Keep one worker per signer.
6. Run a test anchor and check the finalized receipt/event with the independent verifier. Local Anvil addresses in test reports are not Sepolia deployments.

You can send the public wallet addresses and faucet completion status. Do not send a recovery phrase or private key in chat. No public contract deployment or testnet transaction has been performed yet.

## 6. Chainlink CRE: account, login and simulation

Create an account/organization at https://app.chain.link/. The CLI is already present locally. From the repository root:

```powershell
& .\.tools\cre\cre_v1.38.0_windows_amd64.exe login
& .\.tools\cre\cre_v1.38.0_windows_amd64.exe whoami
```

Complete authentication in the browser yourself. Alternatively, store an organization API key in `CRE_API_KEY` locally. The official [authentication reference](https://docs.chain.link/cre/reference/cli/authentication) describes both flows.

After a real Sepolia registry exists, copy `cre/workflows/issuer-verification/config.example.json` to `config.local.json`, replace the placeholder addresses, generate a random record seed, set `SEPOLIA_RPC_URL`, and leave `writeEnabled=false`. Follow [cre/README.md](../cre/README.md) for the read-only simulation command. Capture the actual execution output.

WASM compilation already passed; authenticated simulation and DON execution have not. A write additionally needs the correctly pinned receiver and forwarder/workflow identity. DON deployment depends on account access. The application's authenticated CRE execution-artifact ingestion is still incomplete; successful login alone must not change its CRE status to VERIFIED.

## Details to return for the next connection step

- Supabase Project URL and whether both SQL scripts and SMTP are configured.
- Railway project URL and generated API domain after both services are running.
- Whether secrets were saved in Variables, without pasting their values.
- Sepolia public wallet addresses and CRE login status when ready.

Start with Supabase and Railway. OpenAI, Sepolia and CRE can be enabled afterward without changing the website URL.
