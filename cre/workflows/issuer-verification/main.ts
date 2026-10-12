import {
  Runner,
  cre,
  consensusIdenticalAggregation,
  ok,
  text,
  bytesToHex,
  encodeCallMsg,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  hexToBase64,
  TxStatus,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import {
  decodeFunctionResult,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  sha256,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine((v) => v !== zeroAddress, "Configure a deployed address");
const configSchema = z.object({
  schedule: z.string(),
  lei: z.string().regex(/^[A-Z0-9]{20}$/),
  registryAddress: address,
  tokenAddress: address,
  recordSeed: z
    .string()
    .regex(/^0x[0-9a-f]{64}$/)
    .refine((v) => !/^0x0+$/.test(v)),
  writeEnabled: z.boolean(),
  receiverAddress: z.string(),
});
type Config = z.infer<typeof configSchema>;
type Issuer = {
  lei: string;
  legalName: string;
  registrationStatus: string;
  entityStatus: string;
};
const gleifSchema = z.object({
  data: z.object({
    attributes: z.object({
      lei: z.string(),
      entity: z.object({
        legalName: z.object({ name: z.string() }),
        status: z.string(),
      }),
      registration: z.object({ status: z.string() }),
    }),
  }),
});
const probeAbi = [
  {
    type: "function",
    name: "contractExists",
    stateMutability: "view",
    inputs: [{ name: "target", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function fetchIssuer(requester: HTTPSendRequester, config: Config): Issuer {
  const response = requester
    .sendRequest({
      url: `https://api.gleif.org/api/v1/lei-records/${config.lei}`,
      method: "GET",
    })
    .result();
  if (!ok(response))
    throw new Error(`GLEIF_UNAVAILABLE_${response.statusCode}`);
  const value = gleifSchema.parse(JSON.parse(text(response))).data.attributes;
  if (value.lei !== config.lei) throw new Error("GLEIF_IDENTIFIER_MISMATCH");
  return {
    lei: value.lei,
    legalName: value.entity.legalName.name,
    registrationStatus: value.registration.status,
    entityStatus: value.entity.status,
  };
}

function onCron(runtime: Runtime<Config>) {
  const config = runtime.config;
  const issuer = new cre.capabilities.HTTPClient()
    .sendRequest(
      runtime,
      fetchIssuer,
      consensusIdenticalAggregation<Issuer>(),
    )(config)
    .result();
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: "ethereum-testnet-sepolia",
    isTestnet: true,
  });
  if (!network) throw new Error("SEPOLIA_NETWORK_UNAVAILABLE");
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const call = evm
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: config.registryAddress as Address,
        data: encodeFunctionData({
          abi: probeAbi,
          functionName: "contractExists",
          args: [config.tokenAddress as Address],
        }),
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  const contractExists = decodeFunctionResult({
    abi: probeAbi,
    functionName: "contractExists",
    data: bytesToHex(call.data),
  });
  const observedAt = BigInt(Math.floor(runtime.now().getTime() / 1000));
  // A fixed-field ABI commitment avoids object-order ambiguity. Only hashes enter the receiver.
  const evidenceHash = sha256(
    encodeAbiParameters(
      parseAbiParameters(
        "string,string,string,string,string,uint256,address,bool,uint64",
      ),
      [
        "REGGUARD:CRE:PUBLIC-SOURCES:v1",
        issuer.lei,
        issuer.legalName,
        issuer.registrationStatus,
        issuer.entityStatus,
        11155111n,
        config.tokenAddress as Address,
        contractExists,
        observedAt,
      ],
    ),
  );
  const recordKey = sha256(
    encodeAbiParameters(parseAbiParameters("bytes32,bytes32,uint64"), [
      config.recordSeed as Hex,
      evidenceHash,
      observedAt,
    ]),
  );
  let transactionHash = "";
  if (config.writeEnabled) {
    const receiver = address.parse(config.receiverAddress);
    const payload = encodeAbiParameters(
      parseAbiParameters("bytes32,bytes32,uint64"),
      [recordKey, evidenceHash, observedAt],
    );
    const report = runtime.report(prepareReportRequest(payload)).result();
    const write = evm
      .writeReport(runtime, {
        receiver: hexToBase64(receiver),
        report,
        gasConfig: { gasLimit: "300000" },
      })
      .result();
    if (write.txStatus !== TxStatus.SUCCESS)
      throw new Error(`CRE_WRITE_FAILED_${write.txStatus}`);
    transactionHash = write.txHash ? bytesToHex(write.txHash) : "";
  }
  const result = {
    schemaVersion: "regguard-cre-source-v1",
    recordKey,
    evidenceHash,
    observedAt: observedAt.toString(),
    chainId: 11155111,
    issuer,
    contractExists,
    referenceStatus:
      issuer.registrationStatus === "ISSUED" && issuer.entityStatus === "ACTIVE"
        ? "PASS"
        : "FAIL",
    writeRequested: config.writeEnabled,
    transactionHash,
  };
  // This result is source evidence, not a legal conclusion or the application's final report.
  runtime.log(JSON.stringify(result));
  return result;
}
const initWorkflow = (config: Config) => [
  cre.handler(
    new cre.capabilities.CronCapability().trigger({
      schedule: config.schedule,
    }),
    onCron,
  ),
];
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
