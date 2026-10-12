import canonicalize from "canonicalize";
import { createPublicClient, http, decodeEventLog } from "viem";
import { sepolia } from "viem/chains";
export const registryAbi = [
  {
    type: "function",
    name: "getRecord",
    stateMutability: "view",
    inputs: [{ name: "recordKey", type: "bytes32" }],
    outputs: [
      { name: "reportCommitment", type: "bytes32" },
      { name: "policyHash", type: "bytes32" },
      { name: "timestamp", type: "uint64" },
      { name: "submitter", type: "address" },
    ],
  },
  {
    type: "event",
    name: "ReportAnchored",
    inputs: [
      { name: "recordKey", type: "bytes32", indexed: true },
      { name: "reportCommitment", type: "bytes32", indexed: false },
      { name: "policyHash", type: "bytes32", indexed: false },
      { name: "submitter", type: "address", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
];
const encoder = new TextEncoder();
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
function decodeHex(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
    throw new Error("Expected 32-byte lowercase hex value");
  return Uint8Array.from(value.match(/../g), (x) => parseInt(x, 16));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
export async function reportCommitment(report, salt) {
  const body = encoder.encode(canonicalize(report));
  const length = new Uint8Array(8);
  new DataView(length.buffer).setBigUint64(0, BigInt(body.length), false);
  return sha(
    concat(
      encoder.encode("REGGUARD:REPORT:v1\0"),
      length,
      body,
      decodeHex(salt),
    ),
  );
}
export async function policyHash(policy) {
  return sha(
    concat(
      encoder.encode("REGGUARD:POLICY:v1\0"),
      encoder.encode(canonicalize(policy)),
    ),
  );
}
export async function verifyLocal(pkg) {
  try {
    if (pkg.format !== "regguard-verification-v1")
      throw new Error("Unsupported format");
    const computed = await reportCommitment(pkg.report, pkg.salt);
    const valid =
      computed === pkg.commitment &&
      (await policyHash(pkg.report.policy)) === pkg.report.policy_hash;
    return {
      status: valid ? "ANCHOR_NOT_FOUND" : "INTEGRITY_MISMATCH",
      integrity_valid: valid,
      computed_commitment: computed,
      message: valid
        ? "Package contents match their commitment. An independently trusted registry is required to establish an on-chain anchor."
        : "The report, salt, or policy does not match the recorded commitment.",
    };
  } catch {
    return {
      status: "INTEGRITY_MISMATCH",
      integrity_valid: false,
      message: "Invalid or unsupported verification package.",
    };
  }
}
export async function verifyOnchain(pkg, rpcUrl, trustedRegistry) {
  const local = await verifyLocal(pkg);
  if (!local.integrity_valid) return local;
  if (!pkg.anchor || !pkg.anchor.tx_hash) return local;
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(trustedRegistry) ||
    pkg.anchor.registry_address.toLowerCase() !==
      trustedRegistry.toLowerCase() ||
    pkg.anchor.chain_id !== 11155111 ||
    pkg.anchor.record_key !== pkg.record_key
  )
    return {
      ...local,
      status: "INTEGRITY_MISMATCH",
      message:
        "The anchor does not match your independently trusted registry and Sepolia network.",
    };
  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl, { retryCount: 1, timeout: 15000 }),
    });
    if ((await client.getChainId()) !== 11155111)
      throw new Error("Wrong chain");
    const record = await client.readContract({
      address: trustedRegistry,
      abi: registryAbi,
      functionName: "getRecord",
      args: [pkg.record_key],
      blockTag: "finalized",
    });
    if (record[2] === 0n) return { ...local, status: "ANCHOR_NOT_FOUND" };
    const receipt = await client.getTransactionReceipt({
      hash: pkg.anchor.tx_hash,
    });
    const event = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== trustedRegistry.toLowerCase())
        return false;
      try {
        const parsed = decodeEventLog({
          abi: registryAbi,
          data: log.data,
          topics: log.topics,
        });
        return (
          parsed.eventName === "ReportAnchored" &&
          parsed.args.recordKey === pkg.record_key &&
          parsed.args.reportCommitment === "0x" + pkg.commitment &&
          parsed.args.policyHash === "0x" + pkg.report.policy_hash
        );
      } catch {
        return false;
      }
    });
    const valid =
      receipt.status === "success" &&
      record[0] === "0x" + pkg.commitment &&
      record[1] === "0x" + pkg.report.policy_hash &&
      event;
    return {
      ...local,
      status: valid ? "VERIFIED" : "INTEGRITY_MISMATCH",
      block_number: Number(receipt.blockNumber),
      message: valid
        ? "Report and policy commitments match the finalized registry state and the transaction event."
        : "The registry record or transaction event does not match.",
    };
  } catch {
    return {
      ...local,
      status: "VERIFICATION_UNAVAILABLE",
      message:
        "The RPC or finalized registry state could not be verified. No successful verification is claimed.",
    };
  }
}
