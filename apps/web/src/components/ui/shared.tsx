"use client";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <ShieldCheck size={22} />
      </span>
      {!compact && (
        <span>
          regguard<span className="brand-ai">AI</span>
        </span>
      )}
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  const color = ["PASS", "READY", "VERIFIED", "CONFIRMED", "ANCHORED"].includes(
    status,
  )
    ? "green"
    : ["FAIL", "FAILED", "INTEGRITY_MISMATCH"].includes(status)
      ? "red"
      : ["REVIEW_REQUIRED", "UNKNOWN", "PENDING", "PENDING_FINALITY"].includes(
            status,
          )
        ? "amber"
        : "blue";
  return (
    <span className={cn("badge", color)}>
      <i />
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <CircleHelp size={28} />
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={20} /> Loading your workspace...
    </div>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error-message">
      <AlertCircle size={18} />
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState("");
  const client = useQueryClient();
  return {
    busy,
    error,
    message,
    run: async <T,>(action: () => Promise<T>, success = "Saved") => {
      setBusy(true);
      setError(null);
      setMessage("");
      try {
        const value = await action();
        await client.invalidateQueries();
        setMessage(success);
        return value;
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
  };
}
export function ActionFeedback({
  action,
}: {
  action: ReturnType<typeof useAction>;
}) {
  return (
    <>
      <ErrorMessage error={action.error} />
      {action.message && (
        <div className="success-message" role="status">
          <CheckCircle2 size={16} />
          {action.message}
        </div>
      )}
    </>
  );
}
export function JsonValue({ value }: { value: unknown }) {
  return <pre className="json-value">{JSON.stringify(value, null, 2)}</pre>;
}
