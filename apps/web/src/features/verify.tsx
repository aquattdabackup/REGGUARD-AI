"use client";
import Link from "next/link";
import { useState } from "react";
import {
  FileUp,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import {
  verifyLocal,
  verifyOnchain,
  type VerificationPackage,
  type VerificationResult,
} from "@regguard/integrity";
import { Button } from "@/components/ui/button";
import { Badge, Brand, ErrorMessage } from "@/components/ui/shared";
export function VerifyPage() {
  const [pkg, setPackage] = useState<VerificationPackage | null>(null),
    [result, setResult] = useState<VerificationResult | null>(null),
    [rpc, setRpc] = useState(""),
    [registry, setRegistry] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [filename, setFilename] = useState("");
  async function check(chain = false) {
    if (!pkg) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        chain
          ? await verifyOnchain(pkg, rpc, registry)
          : await verifyLocal(pkg),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="verifier-page">
      <header className="public-nav">
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/dashboard">
          <ArrowLeft size={16} />
          Back to workspace
        </Link>
      </header>
      <main className="verifier-main">
        <div className="verify-hero-icon">
          <Fingerprint size={42} />
        </div>
        <div className="eyebrow">INDEPENDENT REPORT VERIFIER</div>
        <h1>Evidence you can verify.</h1>
        <p>
          Recompute a report&apos;s fingerprint on your device.
          <br />
          Then compare it with a registry you independently trust.
        </p>
        <div className="private-note">
          <LockKeyhole size={14} />
          Your report and private salt never leave this browser.
        </div>
        <section className="panel verifier-panel">
          <label className="drop-zone">
            <FileUp size={30} />
            <strong>{filename || "Choose a verification package"}</strong>
            <span>Exported RegGuard JSON / maximum 10 MB</span>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Verification package"
              onChange={async (e) => {
                setError(null);
                setResult(null);
                setPackage(null);
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 10 * 1024 * 1024)
                    throw new Error("File is larger than 10 MB");
                  const parsed = JSON.parse(
                    await f.text(),
                  ) as VerificationPackage;
                  setPackage(parsed);
                  setFilename(f.name);
                  setResult(await verifyLocal(parsed));
                } catch (err) {
                  setError(err);
                }
              }}
            />
          </label>
          <ErrorMessage error={error} />
          {result && (
            <div className="verification-result" aria-live="polite">
              <Badge status={result.status} />
              <h2>
                {result.integrity_valid
                  ? "Local commitment matches"
                  : "Integrity check failed"}
              </h2>
              <p>{result.message}</p>
              {result.computed_commitment && (
                <code className="hash-block">{result.computed_commitment}</code>
              )}
              {result.block_number && (
                <p>Confirmed block: {result.block_number}</p>
              )}
            </div>
          )}
          <details className="chain-verification" open={!!pkg?.anchor}>
            <summary>
              <ShieldCheck size={17} />
              Check a trusted Sepolia anchor
            </summary>
            <p className="muted">
              Obtain the registry address independently from the report sender.
              A self-consistent package alone cannot prove authenticity.
            </p>
            <label className="field">
              <span>Sepolia RPC endpoint</span>
              <input
                type="url"
                value={rpc}
                onChange={(e) => setRpc(e.target.value)}
                placeholder="https://your-sepolia-rpc"
              />
            </label>
            <label className="field">
              <span>Independently trusted registry</span>
              <input
                value={registry}
                onChange={(e) => setRegistry(e.target.value)}
                placeholder="0x..."
              />
            </label>
            {pkg?.anchor && (
              <div className="subtle-note">
                Package network: {pkg.anchor.chain_id}
                <br />
                Package registry:{" "}
                <span className="mono wrap">{pkg.anchor.registry_address}</span>
                {pkg.anchor.tx_hash && (
                  <p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${pkg.anchor.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction <ExternalLink size={13} />
                    </a>
                  </p>
                )}
              </div>
            )}
            <Button
              disabled={!pkg || !rpc || !registry || busy}
              onClick={() => check(true)}
            >
              {busy ? "Checking registry..." : "Verify against public registry"}
              <ShieldCheck size={17} />
            </Button>
          </details>
        </section>
        <p className="verifier-disclaimer">
          Integrity verification proves that a committed artifact has not
          changed.
          <br />
          It does not establish the truth of its contents or legal compliance.
        </p>
      </main>
    </div>
  );
}
