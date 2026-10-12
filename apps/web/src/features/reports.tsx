"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { api, download } from "@/lib/api";
import type { Profile, Report } from "@/lib/types";
import { date, short } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ActionFeedback,
  Badge,
  Empty,
  ErrorMessage,
  JsonValue,
  Loading,
  PageTitle,
  useAction,
} from "@/components/ui/shared";
export function ReportsPage() {
  const query = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<Report[]>("/reports"),
  });
  return (
    <>
      <PageTitle
        eyebrow="IMMUTABLE AUDIT ARTIFACTS"
        title="Audit reports"
        description="Finalize the evidence. Preserve the decision. Verify the fingerprint."
      >
        <Button asChild variant="secondary">
          <Link href="/verify">
            <Fingerprint size={16} />
            Independent verifier
          </Link>
        </Button>
      </PageTitle>
      <section className="panel padded">
        <ErrorMessage error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : query.data?.length ? (
          query.data.map((r) => (
            <Link
              className="report-list-item"
              href={`/reports/${r.id}`}
              key={r.id}
            >
              <span className="file-icon">
                <FileCheck2 size={24} />
              </span>
              <div>
                <strong>Issuer readiness report / {short(r.id)}</strong>
                <p>
                  Version {r.version} / {date(r.created_at)}
                </p>
              </div>
              <Badge status={r.status} />
              <ArrowRight size={18} />
            </Link>
          ))
        ) : (
          <Empty title="No reports prepared">
            Complete a case evaluation to create a report draft.
          </Empty>
        )}
      </section>
    </>
  );
}
export function ReportPage({ id }: { id: string }) {
  const action = useAction(),
    report = useQuery({
      queryKey: ["report", id],
      queryFn: () => api<Report>(`/reports/${id}`),
      refetchInterval: (q) =>
        q.state.data?.anchor &&
        ["PENDING", "QUEUED", "SIGNED", "PENDING_FINALITY"].includes(
          q.state.data.anchor.status,
        )
          ? 5000
          : false,
    }),
    profile = useQuery({
      queryKey: ["me"],
      queryFn: () => api<Profile>("/me"),
    });
  if (report.isPending) return <Loading />;
  if (report.error) return <ErrorMessage error={report.error} />;
  const r = report.data,
    p = r.payload,
    canFinalize = ["owner", "admin", "reviewer"].includes(
      profile.data?.role || "",
    );
  return (
    <>
      <Link className="back-link" href="/reports">
        <ArrowLeft size={15} />
        All audit reports
      </Link>
      <PageTitle
        eyebrow="AUDIT REPORT"
        title={p?.case?.title || "Issuer readiness report"}
        description={`Report ${id} / Version ${r.version}`}
      >
        <Button
          variant="secondary"
          disabled={!r.finalized_at || action.busy}
          onClick={() =>
            action.run(
              () =>
                download(
                  `/reports/${id}/download?format=pdf`,
                  `regguard-${id}.pdf`,
                ),
              "PDF downloaded",
            )
          }
        >
          <Download size={16} />
          PDF report
        </Button>
        <Button
          variant="secondary"
          disabled={!r.finalized_at || action.busy}
          onClick={() =>
            action.run(
              () => download(`/reports/${id}/download`, `regguard-${id}.json`),
              "Private verification package downloaded",
            )
          }
        >
          <Download size={16} />
          JSON package
        </Button>
      </PageTitle>
      <ActionFeedback action={action} />
      <div className="detail-grid">
        <section className="panel padded">
          <div className="section-title">
            <LockKeyhole size={22} />
            <h2>Report integrity</h2>
          </div>
          <Badge status={r.status} />
          <p className="muted">
            Finalization freezes the case snapshot, policy, findings, and
            recorded reviews. A correction requires a new evaluation and report.
          </p>
          <dl className="detail-list">
            <dt>Finalized</dt>
            <dd>{date(r.finalized_at)}</dd>
            <dt>Commitment</dt>
            <dd className="mono wrap">
              {r.report_hash || "Created at finalization"}
            </dd>
            <dt>Policy hash</dt>
            <dd className="mono wrap">{r.policy_hash}</dd>
          </dl>
          {!r.finalized_at && (
            <Button
              disabled={action.busy || !canFinalize}
              onClick={() =>
                action.run(
                  () => api(`/reports/${id}/finalize`, { method: "POST" }),
                  "Report finalized and cryptographically committed",
                )
              }
            >
              <LockKeyhole size={16} />
              Finalize report
            </Button>
          )}
          {r.finalized_at && (
            <Button asChild variant="secondary">
              <Link href="/verify">
                <Fingerprint size={16} />
                Open independent verifier
              </Link>
            </Button>
          )}
        </section>
        <section className="panel padded">
          <div className="section-title">
            <ShieldCheck size={22} />
            <h2>Blockchain commitment</h2>
          </div>
          <Badge status={r.anchor?.status || "NOT_ANCHORED"} />
          <p className="muted">
            Only the random record key and cryptographic commitments are written
            on-chain.
          </p>
          <dl className="detail-list">
            <dt>Network</dt>
            <dd>Ethereum Sepolia / 11155111</dd>
            <dt>Registry</dt>
            <dd className="mono wrap">
              {r.anchor?.registry_address || "Not configured"}
            </dd>
            <dt>Transaction</dt>
            <dd>
              {r.anchor?.tx_hash ? (
                <a
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://sepolia.etherscan.io/tx/${r.anchor.tx_hash}`}
                >
                  {short(r.anchor.tx_hash)}
                </a>
              ) : (
                "Not submitted"
              )}
            </dd>
            <dt>Block</dt>
            <dd>{r.anchor?.block_number || "Awaiting confirmed anchor"}</dd>
          </dl>
          <Button
            disabled={
              action.busy || !r.finalized_at || !canFinalize || !!r.anchor
            }
            onClick={() =>
              action.run(
                () => api(`/reports/${id}/anchor`, { method: "POST" }),
                "Anchoring job queued",
              )
            }
          >
            <Fingerprint size={16} />
            Anchor on Sepolia
          </Button>
          <p className="small-text muted">
            Requires configured RPC, registry and an authorized signer with test
            ETH. A pending transaction is not a confirmed anchor.
          </p>
        </section>
      </div>
      {p?.findings && (
        <section className="panel padded report-content">
          <div className="eyebrow">
            RG-DAR-001 v{p.policy.version} / {p.mode.toUpperCase()} EVIDENCE
          </div>
          <h2>Evaluation findings</h2>
          <p className="muted">{p.disclaimer}</p>
          {p.findings.map((f) => (
            <div className="report-finding" key={f.id}>
              <div>
                <span className="rule-chip">{f.rule_code}</span>
                <h3>{f.title}</h3>
                <Badge status={f.status} />
              </div>
              <p>{f.explanation}</p>
              <details>
                <summary>Evidence references</summary>
                <JsonValue value={f.evidence_refs} />
              </details>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
