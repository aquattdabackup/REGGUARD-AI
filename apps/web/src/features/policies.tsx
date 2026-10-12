"use client";
import { useQuery } from "@tanstack/react-query";
import { History, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Policy } from "@/lib/types";
import { date } from "@/lib/utils";
import {
  Badge,
  ErrorMessage,
  JsonValue,
  Loading,
  PageTitle,
} from "@/components/ui/shared";
export function PoliciesPage() {
  const query = useQuery({
    queryKey: ["policies"],
    queryFn: () => api<Policy[]>("/policies"),
  });
  return (
    <>
      <PageTitle
        eyebrow="VERSIONED & DETERMINISTIC"
        title="Policy library"
        description="Know exactly which conditions define each readiness assessment."
      />
      <div className="policy-explainer">
        <History size={25} />
        <div>
          <h2>Same evidence. Different policy. Explainable change.</h2>
          <p>
            Version 2 requires wallet possession and reduces source freshness
            from 72 hours to 1 hour. Use Policy Time Machine inside a case to
            compare outcomes on one immutable snapshot.
          </p>
        </div>
      </div>
      <ErrorMessage error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        query.data?.map((p) => (
          <section className="panel policy-panel" key={p.id}>
            <div className="panel-heading">
              <div className="section-title">
                <span className="policy-icon">
                  <ShieldCheck size={23} />
                </span>
                <div>
                  <h2>{p.rules_json.title}</h2>
                  <p>
                    {p.policy_code} / Version {p.version} / Effective{" "}
                    {date(p.effective_at)}
                  </p>
                </div>
              </div>
              <Badge
                status={
                  p.version === "2.0" ? "STRICTER POLICY" : "BASELINE POLICY"
                }
              />
            </div>
            <div className="policy-description">
              <p>{p.rules_json.description}</p>
              <span>{p.jurisdiction}</span>
              <details>
                <summary>View canonical policy hash</summary>
                <code className="hash-block">{p.policy_hash}</code>
              </details>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>RULE</th>
                    <th>CONDITION</th>
                    <th>OPERATOR</th>
                    <th>SEVERITY</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rules_json.rules.map((rule) => (
                    <tr key={rule.code}>
                      <td>
                        <span className="rule-chip">{rule.code}</span>
                      </td>
                      <td>
                        <strong>{rule.title}</strong>
                        <JsonValue value={rule.expected} />
                      </td>
                      <td>
                        <code>{rule.operator}</code>
                      </td>
                      <td>
                        <Badge status={rule.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </>
  );
}
