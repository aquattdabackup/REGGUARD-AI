"use client";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { api } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { date, short } from "@/lib/utils";
import {
  Empty,
  ErrorMessage,
  JsonValue,
  Loading,
  PageTitle,
} from "@/components/ui/shared";
export function AuditPage() {
  const query = useQuery({
    queryKey: ["events"],
    queryFn: () => api<AuditEvent[]>("/audit-events?limit=100"),
  });
  return (
    <>
      <PageTitle
        eyebrow="ATTRIBUTABLE BY DESIGN"
        title="Activity log"
        description="The latest 100 recorded actions in your organization."
      />
      <section className="panel padded">
        <ErrorMessage error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : query.data?.length ? (
          <div className="timeline">
            {query.data.map((e) => (
              <div className="timeline-event" key={e.id}>
                <span className="timeline-node">
                  <Activity size={16} />
                </span>
                <div>
                  <strong>{e.event_type.replaceAll(".", " ")}</strong>
                  <p>
                    {date(e.created_at)} / Actor {short(e.actor_id)}
                  </p>
                  <details>
                    <summary>View event payload</summary>
                    <JsonValue value={e.event_payload} />
                  </details>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No activity recorded">
            Your case actions will appear here.
          </Empty>
        )}
      </section>
    </>
  );
}
