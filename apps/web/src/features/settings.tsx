"use client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Link2, LockKeyhole, Users } from "lucide-react";
import { api, supabase } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  ActionFeedback,
  Badge,
  ErrorMessage,
  Loading,
  PageTitle,
  useAction,
} from "@/components/ui/shared";
export function SettingsPage() {
  const query = useQuery({
      queryKey: ["me"],
      queryFn: () => api<Profile>("/me"),
    }),
    action = useAction();
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorMessage error={query.error} />;
  const p = query.data;
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE PREFERENCES"
        title="Settings"
        description="Organization, access, and integration transparency."
      />
      <ActionFeedback action={action} />
      <div className="detail-grid">
        <section className="panel padded">
          <div className="section-title">
            <Building2 size={20} />
            <h2>Organization</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              action.run(
                () =>
                  api("/organization", {
                    method: "PATCH",
                    body: JSON.stringify({ name: form.get("name") }),
                  }),
                "Organization updated",
              );
            }}
          >
            <label className="field">
              <span>Organization name</span>
              <input
                name="name"
                defaultValue={p.organization?.name}
                minLength={2}
                maxLength={160}
                required
              />
            </label>
            <Button
              disabled={action.busy || !["owner", "admin"].includes(p.role)}
            >
              Save organization
            </Button>
          </form>
          <dl className="detail-list">
            <dt>Your role</dt>
            <dd>{p.role}</dd>
            <dt>User ID</dt>
            <dd className="mono wrap">{p.user_id}</dd>
          </dl>
        </section>
        <section className="panel padded">
          <div className="section-title">
            <Users size={20} />
            <h2>Team & roles</h2>
          </div>
          {p.members.map((m) => (
            <div className="member-row" key={m.id}>
              <span className="user-avatar">{m.role[0].toUpperCase()}</span>
              <code>{m.user_id.slice(0, 18)}...</code>
              <Badge status={m.role.toUpperCase()} />
            </div>
          ))}
          <p className="muted small-text">
            Membership changes are administered through the database by an
            authorized operator. Analysts cannot grant review permissions.
          </p>
        </section>
        <section className="panel padded">
          <div className="section-title">
            <Link2 size={20} />
            <h2>Connected services</h2>
          </div>
          {Object.entries(p.integrations).map(([name, state]) => (
            <div className="service-row" key={name}>
              <strong>{name}</strong>
              <Badge status={state.toUpperCase().replaceAll(" ", "_")} />
            </div>
          ))}
          <p className="muted small-text">
            Configured means a setting is present. It does not claim a
            successful live connection or deployment.
          </p>
        </section>
        <section className="panel padded">
          <div className="section-title">
            <LockKeyhole size={20} />
            <h2>Security & usage</h2>
          </div>
          <dl className="detail-list">
            <dt>AI reservations</dt>
            <dd>${p.ai_usage_reserved_usd.toFixed(4)} this month</dd>
            <dt>Monthly hard ceiling</dt>
            <dd>${p.ai_budget_usd.toFixed(2)}</dd>
            <dt>Authentication</dt>
            <dd>
              {p.mode === "fixture"
                ? "Temporary demo bearer token"
                : "Supabase signed session"}
            </dd>
            <dt>Document storage</dt>
            <dd>Private, authorization required</dd>
          </dl>
          <p className="muted small-text">
            AI reservations are conservative spending ceilings, not provider
            invoices.
          </p>
          <h3>Data retention</h3>
          <p className="muted small-text">{p.retention}</p>
          {p.mode !== "fixture" && (
            <Button
              variant="secondary"
              onClick={() =>
                action.run(async () => {
                  const auth = supabase();
                  if (!auth) throw new Error("Supabase is not configured");
                  const { data } = await auth.auth.getUser();
                  if (!data.user?.email)
                    throw new Error("No email on this account");
                  const result = await auth.auth.resetPasswordForEmail(
                    data.user.email,
                    { redirectTo: `${window.location.origin}/reset-password` },
                  );
                  if (result.error) throw result.error;
                }, "Password reset email requested")
              }
            >
              Request password reset
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
