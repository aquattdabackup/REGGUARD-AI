export interface VerificationPackage {
  format: string;
  report: { policy: unknown; policy_hash: string; [key: string]: unknown };
  salt: string;
  commitment: string;
  record_key: `0x${string}`;
  anchor: {
    registry_address: `0x${string}`;
    chain_id: number;
    record_key: string;
    tx_hash: `0x${string}` | null;
  } | null;
}
export interface VerificationResult {
  status: string;
  integrity_valid: boolean;
  computed_commitment?: string;
  message?: string;
  block_number?: number;
}
export const registryAbi: readonly unknown[];
export function reportCommitment(
  report: unknown,
  salt: string,
): Promise<string>;
export function policyHash(policy: unknown): Promise<string>;
export function verifyLocal(
  pkg: VerificationPackage,
): Promise<VerificationResult>;
export function verifyOnchain(
  pkg: VerificationPackage,
  rpcUrl: string,
  trustedRegistry: string,
): Promise<VerificationResult>;
