"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Fingerprint,
  History,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { sepolia } from "viem/chains";
import { api, download } from "@/lib/api";
import type { AuditEvent, Case, Profile, Run } from "@/lib/types";
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
const PdfViewer = dynamic(() => import("@/components/analysis/pdf-viewer"), {
  ssr: false,
  loading: () => <Loading />,
});
const tabs = [
  "Overview",
  "Documents",
  "Sources",
  "Analysis",
  "Findings",
  "Reviews",
  "History",
  "Reports",
];
export function CaseDetailPage({ id }: { id: string }) {
  const action = useAction(),
    input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("Overview"),
    [runId, setRunId] = useState(""),
    [findingIndex, setFindingIndex] = useState(0),
    [referenceIndex, setReferenceIndex] = useState(0),
    [page, setPage] = useState(1),
    [policy, setPolicy] = useState(""),
    [decision, setDecision] = useState("REQUEST_EVIDENCE"),
    [review, setReview] = useState("");
  const detail = useQuery({
    queryKey: ["case", id],
    queryFn: () => api<Case>(`/cases/${id}`),
    refetchInterval: (q) =>
      q.state.data?.runs?.some((r) =>
        ["QUEUED", "COLLECTING", "EXTRACTING", "EVALUATING"].includes(r.status),
      ) ||
      q.state.data?.documents?.some((d) =>
        ["QUEUED", "EXTRACTING"].includes(d.status),
      )
        ? 2000
        : false,
  });
  const currentId = runId || detail.data?.runs?.[0]?.id;
  const run = useQuery({
    queryKey: ["run", currentId],
    queryFn: () => api<Run>(`/runs/${currentId}`),
    enabled: !!currentId,
    refetchInterval: (q) =>
      q.state.data &&
      !q.state.data.completed_at &&
      q.state.data.status !== "FAILED"
        ? 2000
        : false,
  });
  const history = useQuery({
    queryKey: ["history", id],
    queryFn: () => api<AuditEvent[]>(`/cases/${id}/history`),
  });
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/me"),
  });
  if (detail.isPending) return <Loading />;
  if (detail.error) return <ErrorMessage error={detail.error} />;
  const c = detail.data,
    r = run.data,
    findings = r?.findings || [],
    finding = findings[findingIndex],
    docs = r?.snapshot?.documents || c.documents || [],
    activeRef =
      finding?.evidence_refs[referenceIndex]?.kind === "document"
        ? finding.evidence_refs[referenceIndex]
        : finding?.evidence_refs.find((e) => e.kind === "document"),
    doc = docs.find((d) => d.id === activeRef?.document_id) || docs[0];
  const evaluating = c.runs?.some((x) =>
    ["QUEUED", "COLLECTING", "EXTRACTING", "EVALUATING"].includes(x.status),
  );
  const canWrite = ["owner", "admin", "analyst"].includes(
      profile.data?.role || "",
    ),
    canReview = ["owner", "admin", "reviewer"].includes(
      profile.data?.role || "",
    );
  async function evaluate(replay = false, scenario?: string) {
    await action.run(async () => {
      const result = await api<{ run_id: string }>(
        `/cases/${id}/${scenario ? "recheck" : "analyze"}`,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            policy_version: policy || c.policy_version,
            ...(replay ? { replay_run_id: currentId } : {}),
            ...(scenario ? { scenario } : {}),
          }),
        },
      );
      setRunId(result.run_id);
      setTab("Findings");
    }, "Evaluation queued. The worker will report its actual stage.");
  }
  function selectFinding(index: number) {
    setFindingIndex(index);
    setReferenceIndex(0);
    setPage(
      findings[index]?.evidence_refs.find((e) => e.kind === "document")?.page ||
        1,
    );
  }
  async function proveWallet() {
    await action.run(async () => {
      const provider = (window as Window & { ethereum?: EIP1193Provider })
        .ethereum;
      if (!provider)
        throw new Error(
          "Open this page in a browser with an EVM wallet extension.",
        );
      const wallet = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      });
      const [account] = await wallet.requestAddresses();
      const nonce = await api<{ nonce_id: string; message: string }>(
        `/cases/${id}/wallet/nonce`,
        { method: "POST", body: JSON.stringify({ address: account }) },
      );
      const signature = await wallet.signMessage({
        account,
        message: nonce.message,
      });
      await api(`/cases/${id}/wallet/verify`, {
        method: "POST",
        body: JSON.stringify({ nonce_id: nonce.nonce_id, signature }),
      });
    }, "Wallet possession recorded");
  }
  return (
    <>
      <Link className="back-link" href="/cases">
        <ArrowLeft size={15} />
        All compliance cases
      </Link>
      <PageTitle
        eyebrow={`CASE ${id.slice(0, 8).toUpperCase()}`}
        title={c.title}
        description={`${c.legal_entity_name} / Ethereum Sepolia`}
      >
        <Button
          variant="secondary"
          disabled={action.busy || evaluating || !canWrite}
          onClick={() => evaluate(false, c.scenario)}
        >
          <RefreshCw size={16} />
          Recheck sources
        </Button>
        <Button
          disabled={action.busy || evaluating || !canWrite}
          onClick={() => evaluate()}
        >
          <Play size={16} />
          {evaluating ? "Evaluation in progress" : "Run evaluation"}
        </Button>
      </PageTitle>
      <ActionFeedback action={action} />
      <ErrorMessage error={run.error} />
      <div className="case-status-bar">
        <Badge status={c.status} />
        <span>Policy RG-DAR-001 v{r?.policy?.version || c.policy_version}</span>
        <span className="provenance-label">
          <i />
          {c.mode === "fixture" ? "Simulated evidence" : "Live evidence"}
        </span>
        <span className="push-right">
          Last completed:{" "}
          {date(c.runs?.find((x) => x.completed_at)?.completed_at)}
        </span>
      </div>
      <div className="case-tabs" role="tablist" aria-label="Case workspace">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`case-tab-${t}`}
            aria-controls="case-panel"
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(event) => {
              const index = tabs.indexOf(t);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(tabs[next]);
              const buttons =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                );
              buttons?.[next]?.focus();
            }}
            aria-selected={tab === t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Documents" && <small>{c.documents?.length || 0}</small>}
            {t === "Findings" && findings.length > 0 && (
              <small>{findings.length}</small>
            )}
          </button>
        ))}
      </div>
      <div
        id="case-panel"
        role="tabpanel"
        aria-labelledby={`case-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "Overview" && (
          <div className="detail-grid">
            <section className="panel padded">
              <h2>Issuer identity</h2>
              <dl className="detail-list">
                <dt>Legal entity</dt>
                <dd>{c.legal_entity_name}</dd>
                <dt>LEI</dt>
                <dd className="mono">{c.lei || "Not provided"}</dd>
                <dt>Network</dt>
                <dd>Ethereum Sepolia / {c.chain_id}</dd>
                <dt>Contract</dt>
                <dd className="mono wrap">{c.contract_address}</dd>
                <dt>Wallet</dt>
                <dd className="mono wrap">
                  {c.wallet_address || "Not provided"}
                </dd>
                <dt>Created</dt>
                <dd>{date(c.created_at)}</dd>
              </dl>
              {c.notes && <div className="case-note">{c.notes}</div>}
              {c.wallet_address && (
                <Button
                  variant="secondary"
                  disabled={action.busy || !canWrite}
                  onClick={proveWallet}
                >
                  <Wallet size={16} />
                  {c.wallet_proof?.verified
                    ? "Renew wallet proof"
                    : "Prove wallet possession"}
                </Button>
              )}
            </section>
            <section className="panel padded">
              <h2>Workflow readiness</h2>
              <div className="workflow-steps">
                {[
                  {
                    label: "Collect evidence",
                    sub: `${c.documents?.length || 0} documents in private storage`,
                    done: !!c.documents?.length,
                  },
                  {
                    label: "Evaluate policy",
                    sub: r?.completed_at
                      ? `8 checks / ${r.status.replaceAll("_", " ")}`
                      : "Queue an evidence-grounded evaluation",
                    done: !!r?.completed_at,
                  },
                  {
                    label: "Review & finalize",
                    sub: `${c.reports?.filter((x) => x.finalized_at).length || 0} finalized reports`,
                    done: !!c.reports?.some((x) => x.finalized_at),
                  },
                  {
                    label: "Anchor & verify",
                    sub: "Independent integrity verification",
                    done: !!c.reports?.some((x) => x.status === "ANCHORED"),
                  },
                ].map((step, i) => (
                  <div key={step.label} className={step.done ? "done" : ""}>
                    <span>
                      {step.done ? <CheckCircle2 size={19} /> : i + 1}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" onClick={() => setTab("Documents")}>
                <Upload size={16} />
                Manage evidence
              </Button>
            </section>
            <section className="panel padded">
              <div className="section-title">
                <History size={21} />
                <h2>Policy Time Machine</h2>
              </div>
              <p className="muted">
                Replay the exact immutable source snapshot under another policy
                version.
              </p>
              <label className="field">
                <span>Target policy</span>
                <select
                  value={policy || c.policy_version}
                  onChange={(e) => setPolicy(e.target.value)}
                >
                  <option value="1.0">v1.0 / 72-hour freshness</option>
                  <option value="2.0">
                    v2.0 / 1-hour freshness + wallet proof
                  </option>
                </select>
              </label>
              <Button
                variant="secondary"
                disabled={!r?.completed_at || action.busy || !canWrite}
                onClick={() => evaluate(true)}
              >
                <History size={16} />
                Replay snapshot
              </Button>
              {r?.diff?.length ? (
                <div className="diff-list">
                  {r.diff.map((d, i) => (
                    <div key={i}>
                      <strong>{d.rule_code || d.provider}</strong>
                      <JsonValue value={{ before: d.before, after: d.after }} />
                      {d.reason && <p>{d.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small-text">
                  Differences will appear here after replay or recheck.
                </p>
              )}
            </section>
            <section className="panel padded">
              <div className="section-title">
                <Fingerprint size={21} />
                <h2>CRE execution evidence</h2>
              </div>
              <Badge status={r?.cre_evidence?.status || "UNAVAILABLE"} />
              <p className="muted">
                {r?.cre_evidence?.reason ||
                  "No authenticated CRE execution artifact is attached to this case."}
              </p>
              <p className="small-text muted">
                Backend connector requests are recorded separately from
                Chainlink execution.
              </p>
              {c.mode === "fixture" && (
                <div className="fixture-controls">
                  <h3>Controlled source scenarios</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={action.busy || evaluating || !canWrite}
                    onClick={() => evaluate(false, "changed-source-case")}
                  >
                    Simulate lapsed registration
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={action.busy || evaluating || !canWrite}
                    onClick={() => evaluate(false, "api-failure")}
                  >
                    Simulate source outage
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
        {tab === "Documents" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Supporting evidence</h2>
                <p>PDF / DOCX / 10 MB per file / maximum 5 documents</p>
              </div>
              <Button
                variant="secondary"
                disabled={action.busy || evaluating || !canWrite}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                Upload document
              </Button>
              <input
                ref={input}
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                aria-label="Upload evidence"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    action.run(async () => {
                      const body = new FormData();
                      body.set("file", file);
                      await api(`/cases/${id}/documents`, {
                        method: "POST",
                        body,
                      });
                    }, "Document queued for extraction");
                  e.target.value = "";
                }}
              />
            </div>
            {c.documents?.length ? (
              <div className="document-list">
                {c.documents.map((d) => (
                  <div key={d.id}>
                    <span className="file-icon">
                      <FileText size={23} />
                    </span>
                    <div>
                      <strong>{d.filename}</strong>
                      <p>
                        {(d.size_bytes / 1024).toFixed(1)} KB / SHA-256{" "}
                        {short(d.sha256)}
                      </p>
                      {d.error_code && (
                        <p className="error-text">{d.error_code}</p>
                      )}
                      <small>
                        Extraction: {d.extraction.provider || "pending"}
                      </small>
                    </div>
                    <Badge status={d.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Download ${d.filename}`}
                      onClick={() =>
                        action.run(
                          () =>
                            download(`/documents/${d.id}/content`, d.filename),
                          "Document downloaded",
                        )
                      }
                    >
                      <Download size={17} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Add your first document">
                Upload an issuer declaration and a registration certificate to
                begin.
              </Empty>
            )}
          </section>
        )}
        {tab === "Sources" && (
          <div className="detail-grid">
            {r?.sources?.length ? (
              r.sources.map((s) => (
                <section className="panel padded" key={s.id}>
                  <div className="panel-heading flush">
                    <h2>{s.provider}</h2>
                    <Badge
                      status={String(s.normalized_data.status).toUpperCase()}
                    />
                  </div>
                  <p className="provenance-label">
                    <i />
                    {s.mode === "fixture"
                      ? "Simulated fixture"
                      : "Live connector response"}
                  </p>
                  <dl className="detail-list">
                    <dt>Fetched</dt>
                    <dd>{date(s.fetched_at)}</dd>
                    <dt>Source</dt>
                    <dd className="wrap">{s.source_identifier}</dd>
                    <dt>Snapshot hash</dt>
                    <dd className="mono wrap">{s.source_hash}</dd>
                  </dl>
                  <JsonValue value={s.normalized_data} />
                  <details>
                    <summary>Raw source response</summary>
                    <JsonValue value={s.raw_data} />
                  </details>
                </section>
              ))
            ) : (
              <Empty title="No sources collected">
                Run an evaluation to record immutable external-source snapshots.
              </Empty>
            )}
          </div>
        )}
        {(tab === "Analysis" || tab === "Findings") && (
          <>
            <div className="inspector-heading">
              <div>
                <Sparkles size={18} />
                <strong>Evidence inspector</strong>
                <span>
                  Facts, interpretations, and policy outcomes in context.
                </span>
              </div>
              <select
                aria-label="Evaluation run"
                value={currentId || ""}
                onChange={(e) => {
                  setRunId(e.target.value);
                  setFindingIndex(0);
                  setPage(1);
                }}
              >
                {c.runs?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {date(x.created_at)} / {x.status}
                  </option>
                ))}
              </select>
            </div>
            {evaluating && (
              <div className="stage-banner">
                <span className="pulse-dot" />
                Current stage: {r?.status || "QUEUED"}. Progress reflects the
                worker state.
              </div>
            )}
            {findings.length ? (
              <div className="inspector-layout">
                <div className="evidence-pane">
                  {doc ? (
                    <PdfViewer
                      key={doc.id}
                      document={doc}
                      page={page}
                      onPage={setPage}
                      excerpt={activeRef?.excerpt || ""}
                    />
                  ) : (
                    <Empty title="No document evidence">
                      This finding relies on external sources or missing
                      evidence.
                    </Empty>
                  )}
                </div>
                <div className="findings-pane">
                  <div className="finding-picker">
                    {findings.map((f, i) => (
                      <button
                        className={findingIndex === i ? "selected" : ""}
                        key={f.id}
                        onClick={() => selectFinding(i)}
                      >
                        <span>{f.rule_code}</span>
                        <i className={`status-dot ${f.status.toLowerCase()}`} />
                      </button>
                    ))}
                  </div>
                  {finding && (
                    <div className="finding-content">
                      <div className="finding-meta">
                        <span>
                          {finding.rule_code} / {finding.severity} SEVERITY
                        </span>
                        <Badge status={finding.status} />
                      </div>
                      <h2>{finding.title}</h2>
                      <div className="evidence-label">
                        <ShieldCheck size={14} />
                        DETERMINISTIC POLICY RESULT
                      </div>
                      <p className="finding-explanation">
                        {finding.explanation}
                      </p>
                      <div className="observed-expected">
                        <div>
                          <h4>Observed value</h4>
                          <JsonValue value={finding.observed_value.value} />
                        </div>
                        <div>
                          <h4>Expected value</h4>
                          <JsonValue value={finding.expected_value} />
                        </div>
                      </div>
                      <h3>Supporting references</h3>
                      {finding.evidence_refs.length ? (
                        finding.evidence_refs.map((ref, i) => (
                          <div className="evidence-reference" key={i}>
                            {ref.kind === "document" ? (
                              <>
                                <button
                                  onClick={() => {
                                    setReferenceIndex(i);
                                    setPage(ref.page || 1);
                                  }}
                                >
                                  <FileText size={15} />
                                  Page / section {ref.page} /{" "}
                                  {short(ref.document_id)}
                                </button>
                                <blockquote>{ref.excerpt}</blockquote>
                              </>
                            ) : (
                              <>
                                <span>{ref.provider || "Wallet proof"}</span>
                                <small className="wrap">
                                  {ref.source_identifier ||
                                    "Domain-bound signature"}
                                </small>
                                <span className="provenance-label">
                                  {ref.mode}
                                </span>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          No supporting evidence available. The outcome retains
                          this uncertainty.
                        </p>
                      )}
                      <div className="interpretation-note">
                        <Sparkles size={16} />
                        <div>
                          <strong>Extraction transparency</strong>
                          <p>
                            {doc?.extraction.provider === "fixture"
                              ? "Sample fields were read by the deterministic fixture adapter. No AI inference was performed."
                              : `Provider: ${doc?.extraction.provider || "unavailable"}. Model: ${doc?.extraction.model || "not available"}. Citations are validated against document text.`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setTab("Reviews")}
                      >
                        Review this finding <ArrowRight size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Empty
                title={
                  r?.status === "FAILED"
                    ? "Evaluation failed"
                    : "Ready when your evidence is"
                }
              >
                {r?.failure_code ||
                  "Run an evaluation to inspect policy findings and their supporting evidence."}
              </Empty>
            )}
          </>
        )}
        {tab === "Reviews" && (
          <div className="detail-grid">
            <section className="panel padded">
              <h2>Human review</h2>
              <p className="muted">
                Record a decision without rewriting the original rule outcome.
                Reviews after finalization are included only in a new report.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (finding)
                    action.run(async () => {
                      await api(`/findings/${finding.id}/review`, {
                        method: "POST",
                        body: JSON.stringify({ decision, explanation: review }),
                      });
                      setReview("");
                    }, "Review recorded in the audit trail");
                }}
              >
                <label className="field">
                  <span>Finding</span>
                  <select
                    value={findingIndex}
                    onChange={(e) => selectFinding(Number(e.target.value))}
                  >
                    {findings.map((f, i) => (
                      <option key={f.id} value={i}>
                        {f.rule_code} / {f.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Decision</span>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  >
                    <option value="REQUEST_EVIDENCE">
                      Request more evidence
                    </option>
                    <option value="ACCEPT">Accept evidence</option>
                    <option value="REJECT">Reject evidence</option>
                  </select>
                </label>
                <label className="field">
                  <span>Review rationale</span>
                  <textarea
                    minLength={10}
                    maxLength={2000}
                    required
                    rows={4}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Explain your decision and the evidence considered..."
                  />
                </label>
                <Button disabled={action.busy || !finding || !canReview}>
                  Record review
                </Button>
                {!canReview && (
                  <p className="muted">
                    Reviewer, Admin, or Owner role required.
                  </p>
                )}
              </form>
            </section>
            <section className="panel padded">
              <h2>Review history</h2>
              {r?.reviews?.length ? (
                r.reviews.map((v) => (
                  <div className="review-item" key={v.id}>
                    <Badge status={v.decision} />
                    <p>{v.explanation}</p>
                    <small>
                      {short(v.reviewer_id)} / {date(v.reviewed_at)}
                    </small>
                  </div>
                ))
              ) : (
                <Empty title="No reviews recorded" />
              )}
            </section>
          </div>
        )}
        {tab === "History" && (
          <section className="panel padded">
            <h2>Case audit trail</h2>
            {history.data?.length ? (
              <div className="timeline">
                {history.data.map((e) => (
                  <div className="timeline-event" key={e.id}>
                    <span className="timeline-node">
                      <History size={16} />
                    </span>
                    <div>
                      <strong>{e.event_type.replaceAll(".", " ")}</strong>
                      <p>
                        {date(e.created_at)} / actor {short(e.actor_id)}
                      </p>
                      <details>
                        <summary>Event details</summary>
                        <JsonValue value={e.event_payload} />
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No events yet" />
            )}
          </section>
        )}
        {tab === "Reports" && (
          <section className="panel padded">
            <h2>Audit reports</h2>
            <p className="muted">
              A draft is prepared for each completed evaluation. Finalization
              freezes its contents.
            </p>
            {c.reports?.length ? (
              c.reports.map((report) => (
                <Link
                  className="report-list-item"
                  href={`/reports/${report.id}`}
                  key={report.id}
                >
                  <FileText size={23} />
                  <div>
                    <strong>Readiness report / {short(report.id)}</strong>
                    <p>{date(report.created_at)}</p>
                  </div>
                  <Badge status={report.status} />
                  <ArrowRight size={18} />
                </Link>
              ))
            ) : (
              <Empty title="No reports yet">
                Complete an evaluation to prepare a report.
              </Empty>
            )}
          </section>
        )}
      </div>
    </>
  );
}
