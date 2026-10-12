"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  FileCheck2,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { api, ApiError, supabase } from "@/lib/api";
import type { Profile } from "@/lib/types";
import {
  Brand,
  ErrorMessage,
  Loading,
  ActionFeedback,
  useAction,
} from "@/components/ui/shared";
import { cn } from "@/lib/utils";
const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/cases", label: "Compliance cases", icon: Files },
  { href: "/analysis", label: "Evidence inspector", icon: Sparkles },
  { href: "/policies", label: "Policy library", icon: ShieldCheck },
  { href: "/reports", label: "Audit reports", icon: FileCheck2 },
  { href: "/audit", label: "Activity log", icon: Activity },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const action = useAction();
  const pathname = usePathname(),
    router = useRouter(),
    cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/me"),
    retry: false,
  });
  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.status === 401)
      router.replace("/login");
  }, [profile.error, router]);
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem("regguard_demo");
      await supabase()?.auth.signOut();
      cache.clear();
      router.push("/login");
    }
  }
  if (profile.isPending) return <Loading />;
  if (profile.error)
    return (
      <main className="auth-error">
        <ErrorMessage error={profile.error} />
        <Link href="/login">Return to sign in</Link>
      </main>
    );
  if (!profile.data.organization)
    return (
      <main className="auth-error">
        <h1>Create your organization</h1>
        <ActionFeedback action={action} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await action.run(async () => {
              await api("/organization", {
                method: "POST",
                body: JSON.stringify({ name: form.get("name") }),
              });
              await cache.invalidateQueries();
            }, "Organization created");
          }}
        >
          <label>
            Organization name
            <input name="name" minLength={2} required />
          </label>
          <button className="button button-primary" disabled={action.busy}>
            Create organization
          </button>
        </form>
      </main>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("sidebar", open && "sidebar-open")}>
        <Link href="/dashboard" className="sidebar-brand">
          <Brand />
        </Link>
        <button
          className="mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <Link href="/settings" className="org-switch">
          <span className="org-avatar">RG</span>
          <span>
            <strong>{profile.data.organization.name}</strong>
            <small>
              {profile.data.mode === "fixture"
                ? "Demo workspace"
                : "Organization workspace"}
            </small>
          </span>
          <ChevronsUpDown size={15} />
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((item) => (
            <Link
              onClick={() => setOpen(false)}
              className={cn(
                "nav-item",
                (pathname === item.href ||
                  (item.href === "/cases" && pathname.startsWith("/cases/"))) &&
                  "active",
              )}
              key={item.href}
              href={item.href}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {pathname === item.href && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-card">
            <ShieldCheck size={21} />
            <strong>Built on evidence.</strong>
            <p>
              Every decision has a source.
              <br />
              Every report has a fingerprint.
            </p>
            <Link href="/verify">
              Independent verifier <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className={cn("nav-item", pathname === "/settings" && "active")}
            href="/settings"
          >
            <Settings2 size={19} />
            Settings
          </Link>
          <button className="profile-control" onClick={logout}>
            <span className="user-avatar">
              {profile.data.role.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>
                {profile.data.mode === "fixture"
                  ? "Demo operator"
                  : "Workspace member"}
              </strong>
              <small>{profile.data.role}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="menu-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {nav.find((n) => pathname.startsWith(n.href))?.label ||
                "Settings"}
            </strong>
            <ChevronDown size={13} />
          </div>
          <div className="topbar-actions">
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/cases?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search cases"
                placeholder="Search cases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </form>
            <Link
              className="icon-link"
              href="/audit"
              aria-label="View activity"
            >
              <Bell size={19} />
            </Link>
            <span className="user-avatar small">RG</span>
          </div>
        </header>
        <main id="workspace" className="workspace">
          {profile.data.mode === "fixture" && (
            <div className="demo-banner">
              <span className="demo-dot" />
              <strong>Demo environment</strong>
              <span>
                Fictional evidence / simulated external sources / no live AI
                calls
              </span>
              <Link href="/settings">
                View connections <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {children}
          <footer className="workspace-footer">
            <span>RegGuard AI / Verifiable compliance intelligence</span>
            <span>Readiness assessment. Not legal certification.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
