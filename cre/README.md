# RegGuard CRE public-source workflow

**Verified:** TypeScript project checks and WASM compilation using `@chainlink/cre-sdk` 1.23.0, Bun and Javy 8.1.0. **Blocked:** CRE CLI v1.38.0 simulation required an account session or `CRE_API_KEY`; none was supplied. **Not deployed:** no DON workflow, receiver or authenticated execution artifact is claimed.

## What runs in the workflow

Cron trigger -> GLEIF HTTP capability -> identical aggregation on normalized public issuer fields -> finalized EVM contractExists read -> fixed-ABI source commitment -> optional runtime-signed report and EVM writeReport to IssuerEvidenceReceiver. Errors stop the execution; there is no fixture fallback inside the CRE workflow.

This workflow attests public-source observations, not private documents or legal compliance. It is separate from the finalized-report AuditRegistry anchor. The UI deliberately retains UNAVAILABLE for CRE without authenticated evidence; backend HTTP calls are never labeled Chainlink execution. The execution-artifact ingestion/verification path is incomplete.

## Configure and run

1. Install the [official CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation), Bun, and workspace dependencies. Log in using `cre login` or provide an account-approved API key through the environment. Never commit credentials.
2. Deploy AuditRegistry to Sepolia after authorization and funding. Its `contractExists(address)` probe lets the capability check code existence at finalized state.
3. Copy `workflows/issuer-verification/config.example.json` to `config.local.json`. Replace registry/token addresses and generate a random 32-byte record seed. Placeholders intentionally fail schema validation. Set `SEPOLIA_RPC_URL` in your environment; `project.yaml` interpolates it.
4. Keep `writeEnabled=false` for the initial read-only simulation. To test writes, deploy IssuerEvidenceReceiver with the correct environment-specific forwarder, workflow ID and workflow owner. Simulator and production forwarders/metadata differ; consult current official docs and never remove identity checks.

```bash
cd cre/workflows/issuer-verification
bun x --no-install cre-compile main.ts dist/workflow.wasm
cd ../..
cre workflow simulate workflows/issuer-verification --target staging-settings --trigger-index 0 --non-interactive
```

For a reviewed write, enable the receiver and add `--broadcast`. Broadcasting sends a real testnet transaction; simulation without broadcast is not a confirmed chain anchor. Deployment to DON additionally requires account access approval. Preserve official execution ID, trigger/config hash, CLI/SDK versions, logs and explorer receipt for evaluation.

## Actual local attempt

The Windows CLI archive SHA-256 matched the official v1.38.0 release checksum. Compilation completed after exporting the SDK `main` entry point. CLI simulation with the prebuilt WASM and `--non-interactive` returned:

```text
Authentication required: not logged in and no CRE_API_KEY set
```

This failed before executing capabilities. No simulated outcome or on-chain CRE event is asserted. SDK docs: [HTTP capability](https://docs.chain.link/cre/reference/sdk/http-client-ts), [EVM capability](https://docs.chain.link/cre/reference/sdk/evm-client-ts), [consumer contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts), [write reports](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/writing-data-onchain).
