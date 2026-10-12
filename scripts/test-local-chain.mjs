// Local Anvil integration ONLY. This never submits to a public RPC.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createPublicClient, createWalletClient, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { verifyOnchain } from "../packages/shared-schemas/integrity.mjs";
const rpc = "http://127.0.0.1:8545";
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
assert.match(
  await client.request({ method: "web3_clientVersion" }),
  /anvil/i,
  "Refuse any non-Anvil node",
);
// Public Anvil development mnemonic; never use for real funds or public networks.
const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
);
const wallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpc),
});
const artifact = JSON.parse(
  await fs.readFile(
    "contracts/out/AuditRegistry.sol/AuditRegistry.json",
    "utf8",
  ),
);
const deployment = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [account.address, account.address],
});
const { contractAddress: registry } = await client.waitForTransactionReceipt({
  hash: deployment,
});
const pkg = JSON.parse(await fs.readFile(".data/sample-report.json", "utf8"));
const hash = await wallet.writeContract({
  address: registry,
  abi: artifact.abi,
  functionName: "anchor",
  args: [pkg.record_key, "0x" + pkg.commitment, "0x" + pkg.report.policy_hash],
});
await client.waitForTransactionReceipt({ hash });
// Anvil tags finalized blocks behind head by its configured depth. Mine to finality locally.
await client.request({ method: "anvil_mine", params: ["0x50"] });
pkg.anchor = {
  tx_hash: hash,
  registry_address: registry,
  chain_id: 11155111,
  record_key: pkg.record_key,
};
assert.equal((await verifyOnchain(pkg, rpc, registry)).status, "VERIFIED");
const wrongTx = structuredClone(pkg);
wrongTx.anchor.tx_hash = deployment;
assert.equal(
  (await verifyOnchain(wrongTx, rpc, registry)).status,
  "INTEGRITY_MISMATCH",
);
const changed = structuredClone(pkg);
changed.report.case.title = "tampered";
assert.equal(
  (await verifyOnchain(changed, rpc, registry)).status,
  "INTEGRITY_MISMATCH",
);
await fs.writeFile(
  ".data/local-chain-report.json",
  JSON.stringify(pkg, null, 2),
);
console.log(
  JSON.stringify(
    {
      environment: "local Anvil (NOT public Sepolia)",
      checks: 3,
      registry,
      transaction: hash,
      status: "PASSED",
    },
    null,
    2,
  ),
);
