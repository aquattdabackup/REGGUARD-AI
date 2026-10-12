"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Clock3,
  FileCheck2,
  Files,
  Fingerprint,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import type { AuditEvent, Case, Dashboard, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Empty,
  ErrorMessage,
  Loading,
  PageTitle,
} from "@/components/ui/shared";
import { date } from "@/lib/utils";
import { CasesTable } from "@/features/cases";
export function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
  });
  const cases = useQuery({
    queryKey: ["cases", "recent"],
    queryFn: () => api<{ items: Case[]; total: number }>("/cases?limit=5"),
  });
  const events = useQuery({
    queryKey: ["events", "recent"],
    queryFn: () => api<AuditEvent[]>("/audit-events?limit=4"),
  });
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/me"),
  });
  if (summary.isPending) return <Loading />;
  if (summary.error) return <ErrorMessage error={summary.error} />;
  const d = summary.data;
  const chart = [
    { name: "Passed", value: d.findings.PASS || 0, color: "#2563eb" },
    {
      name: "Review required",
      value: d.findings.REVIEW_REQUIRED || 0,
      color: "#f59e0b",
    },
    { name: "Failed", value: d.findings.FAIL || 0, color: "#ef4444" },
    { name: "Unknown", value: d.findings.UNKNOWN || 0, color: "#cbd5e1" },
  ];
  const checks = chart.reduce((sum, x) => sum + x.value, 0);
  return (
    <>
      <PageTitle
        eyebrow="YOUR COMPLIANCE WORKSPACE"
        title="Workspace overview"
        description="A clear view of your cases, evidence, and decisions."
      >
        <Button asChild variant="secondary">
          <Link href="/reports">
            <ArrowDownToLine size={16} />
            View reports
          </Link>
        </Button>
        <Button asChild>
          <Link href="/cases/new">
            <Plus size={17} />
            New compliance case
          </Link>
        </Button>
      </PageTitle>
      <div className="overview-callout">
        <div className="callout-icon">
          <Fingerprint size={32} />
        </div>
        <div>
          <div className="eyebrow">EVIDENCE FIRST. ALWAYS.</div>
          <h2>Confidence starts with a traceable decision.</h2>
          <p>
            Bring your documents, policy checks, and verification into one
            connected workflow.
          </p>
        </div>
        <Link href="/cases">
          Explore your cases <ArrowRight size={17} />
        </Link>
        <div className="callout-grid" />
      </div>
      <section className="metrics" aria-label="Workspace statistics">
        {[
          {
            label: "Total cases",
            value: d.total_cases,
            icon: Files,
            sub: `${d.evaluated_cases} evaluated`,
            tone: "blue",
          },
          {
            label: "Passing checks",
            value: d.findings.PASS || 0,
            icon: CheckCheck,
            sub: "Across latest completed runs",
            tone: "green",
          },
          {
            label: "Needs attention",
            value:
              (d.findings.REVIEW_REQUIRED || 0) + (d.findings.UNKNOWN || 0),
            icon: Clock3,
            sub: `${d.findings.FAIL || 0} failed checks`,
            tone: "amber",
          },
          {
            label: "Finalized reports",
            value: d.finalized_reports,
            icon: FileCheck2,
            sub: "Immutable evidence packages",
            tone: "purple",
          },
        ].map((m) => (
          <div className="metric" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className={`metric-icon ${m.tone}`}>
                <m.icon size={18} />
              </span>
            </div>
            <strong>{m.value.toString().padStart(2, "0")}</strong>
            <span className="metric-sub">{m.sub}</span>
          </div>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent compliance cases</h2>
              <p>Your latest issuer onboarding activity</p>
            </div>
            <Link className="text-link" href="/cases">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <ErrorMessage error={cases.error} />
          {cases.data && <CasesTable data={cases.data.items} compact />}
        </section>
        <section className="panel check-panel">
          <div className="panel-heading">
            <div>
              <h2>Policy check outcomes</h2>
              <p>Latest completed evaluation per case</p>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={
                    checks
                      ? chart
                      : [{ name: "No evaluations", value: 1, color: "#edf1f6" }]
                  }
                  dataKey="value"
                  isAnimationActive={false}
                  innerRadius={61}
                  outerRadius={78}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {(checks ? chart : [{ color: "#edf1f6" }]).map((x, i) => (
                    <Cell key={i} fill={x.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-label">
              <strong>{checks}</strong>
              <span>total checks</span>
            </div>
          </div>
          <div className="chart-legend">
            {chart.map((x) => (
              <div key={x.name}>
                <span>
                  <i style={{ background: x.color }} />
                  {x.name}
                </span>
                <strong>{x.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Activity timeline</h2>
              <p>An attributable record of your workflow</p>
            </div>
            <Link className="text-link" href="/audit">
              Full history <ArrowUpRight size={15} />
            </Link>
          </div>
          {events.data?.length ? (
            <div className="timeline">
              {events.data.map((e) => (
                <div className="timeline-event" key={e.id}>
                  <span className="timeline-node">
                    <CheckCheck size={15} />
                  </span>
                  <div>
                    <strong>{e.event_type.replaceAll(".", " ")}</strong>
                    <p>{date(e.created_at)}</p>
                  </div>
                  <Badge status="RECORDED" />
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Your audit trail starts here">
              Create or evaluate a case to record your first event.
            </Empty>
          )}
        </section>
        <section className="panel verification-card">
          <div className="verification-symbol">
            <Fingerprint size={28} />
          </div>
          <span className="eyebrow">INDEPENDENT VERIFICATION</span>
          <h2>
            Trust the evidence.
            <br />
            Verify the integrity.
          </h2>
          <p>
            Check an exported report in your browser. Your private evidence
            stays on your device.
          </p>
          <Button asChild variant="secondary">
            <Link href="/verify">
              Open report verifier <ArrowUpRight size={16} />
            </Link>
          </Button>
        </section>
      </div>
      <section className="connection-strip">
        <div>
          <Radio size={17} />
          <strong>Connected services</strong>
        </div>
        {Object.entries(profile.data?.integrations || {})
          .filter(([key]) =>
            ["GLEIF", "OpenAI", "Sepolia RPC", "CRE"].includes(key),
          )
          .map(([name, status]) => (
            <span key={name}>
              <i
                className={status === "unavailable" ? "muted-dot" : "live-dot"}
              />
              {name}
              <small>{status}</small>
            </span>
          ))}
        <Link href="/settings">
          Manage <ArrowRight size={14} />
        </Link>
      </section>
      <div className="inline-note">
        <Sparkles size={15} />
        AI extracts and explains. Versioned policy rules determine outcomes.
        Human reviewers resolve ambiguity.
      </div>
    </>
  );
}
