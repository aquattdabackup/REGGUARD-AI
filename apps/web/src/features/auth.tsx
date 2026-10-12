"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Fingerprint,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { api, supabase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ActionFeedback,
  Brand,
  ErrorMessage,
  useAction,
} from "@/components/ui/shared";
export function AuthPage({
  screen,
}: {
  screen:
    | "login"
    | "register"
    | "forgot-password"
    | "reset-password"
    | "verify-email";
}) {
  const router = useRouter(),
    action = useAction();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ demo_mode: boolean }>("/config"),
    retry: false,
  });
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && screen === "reset-password")
      supabase()?.auth.exchangeCodeForSession(code);
  }, [screen]);
  async function demo() {
    await action.run(async () => {
      const result = await api<{ access_token: string }>("/demo/session", {
        method: "POST",
      });
      sessionStorage.setItem("regguard_demo", result.access_token);
      router.push("/dashboard");
    }, "Demo workspace ready");
  }
  async function submit() {
    await action.run(
      async () => {
        const auth = supabase();
        if (!auth)
          throw new Error(
            "Supabase authentication is not configured. Use the local demo when enabled.",
          );
        let error;
        if (screen === "login") {
          ({ error } = await auth.auth.signInWithPassword({ email, password }));
          if (!error) {
            sessionStorage.removeItem("regguard_demo");
            router.push("/dashboard");
          }
        } else if (screen === "register") {
          ({ error } = await auth.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/login` },
          }));
          if (!error) router.push("/verify-email");
        } else if (screen === "forgot-password") {
          ({ error } = await auth.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          }));
        } else if (screen === "reset-password") {
          ({ error } = await auth.auth.updateUser({ password }));
          if (!error) router.push("/dashboard");
        }
        if (error) throw error;
      },
      screen === "forgot-password"
        ? "If an account exists, a password reset email has been requested."
        : "Request completed",
    );
  }
  const titles = {
    login: "Welcome back.",
    register: "Create your account.",
    "forgot-password": "Reset your password.",
    "reset-password": "Choose a new password.",
    "verify-email": "Check your inbox.",
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link href="/">
          <Brand />
        </Link>
        <div>
          <div className="eyebrow">A CLEARER STANDARD OF TRUST</div>
          <h1>
            From evidence
            <br />
            to confidence.
          </h1>
          <p>
            One connected workflow for issuer readiness, explainable decisions,
            and verifiable audits.
          </p>
          <div className="auth-proof">
            <Fingerprint size={80} />
            <span className="proof-orbit one" />
            <span className="proof-orbit two" />
          </div>
          <ul>
            <li>
              <Check size={16} />
              Evidence-grounded intelligence
            </li>
            <li>
              <Check size={16} />
              Deterministic, versioned policies
            </li>
            <li>
              <Check size={16} />
              Independent integrity verification
            </li>
          </ul>
        </div>
        <small>Readiness intelligence. Human judgment remains essential.</small>
      </aside>
      <main className="auth-main">
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          Back to RegGuard
        </Link>
        <div className="auth-form">
          <span className="auth-icon">
            {screen === "verify-email" ? (
              <Mail size={25} />
            ) : (
              <ShieldCheck size={25} />
            )}
          </span>
          <h1>{titles[screen]}</h1>
          <p>
            {screen === "login"
              ? "Sign in to your compliance workspace."
              : screen === "verify-email"
                ? "Follow the verification link sent by your identity provider, then sign in."
                : "Secure access to evidence and auditable decisions."}
          </p>
          <ActionFeedback action={action} />
          <ErrorMessage error={config.error} />
          {screen !== "verify-email" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {screen !== "reset-password" && (
                <label className="field">
                  <span>Work email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </label>
              )}
              {screen !== "forgot-password" && (
                <label className="field">
                  <span>
                    Password
                    {screen === "login" && (
                      <Link href="/forgot-password">Forgot password?</Link>
                    )}
                  </span>
                  <input
                    type="password"
                    minLength={screen === "login" ? 1 : 12}
                    autoComplete={
                      screen === "login" ? "current-password" : "new-password"
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      screen === "register"
                        ? "At least 12 characters"
                        : "Enter your password"
                    }
                  />
                </label>
              )}
              <Button
                className="full-width"
                disabled={action.busy}
                type="submit"
              >
                {screen === "login"
                  ? "Sign in"
                  : screen === "register"
                    ? "Create account"
                    : screen === "forgot-password"
                      ? "Send reset link"
                      : "Update password"}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          {screen === "verify-email" ? (
            <Button asChild>
              <Link href="/login">Return to sign in</Link>
            </Button>
          ) : (
            <p className="auth-switch">
              {screen === "login" ? (
                <>
                  New to RegGuard?{" "}
                  <Link href="/register">Create an account</Link>
                </>
              ) : (
                <Link href="/login">Return to sign in</Link>
              )}
            </p>
          )}
          {config.data?.demo_mode && (
            <>
              <div className="divider">
                <span>EXPLORE THE PRODUCT</span>
              </div>
              <Button
                variant="secondary"
                className="full-width"
                disabled={action.busy}
                onClick={demo}
              >
                Launch demo workspace <ArrowRight size={17} />
              </Button>
              <p className="auth-disclosure">
                An isolated workspace with fictional documents and simulated
                sources. No account or paid API call required.
              </p>
            </>
          )}
          <div className="auth-security">
            <LockKeyhole size={13} />
            Private evidence. Explicit access. Traceable decisions.
          </div>
        </div>
      </main>
    </div>
  );
}
