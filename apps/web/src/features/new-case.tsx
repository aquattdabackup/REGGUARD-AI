"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileUp,
  Network,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Case, Profile } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ActionFeedback, PageTitle, useAction } from "@/components/ui/shared";
const schema = z.object({
  title: z.string().trim().min(3).max(160),
  legal_entity_name: z.string().trim().min(2).max(200),
  lei: z
    .string()
    .regex(/^[A-Z0-9]{18}[0-9]{2}$/, "Use a 20-character LEI")
    .or(z.literal("")),
  contract_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Use a valid EVM address"),
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Use a valid wallet address")
    .or(z.literal("")),
  policy_version: z.enum(["1.0", "2.0"]),
  notes: z.string().max(2000),
});
type Values = z.infer<typeof schema>;
export function NewCasePage() {
  const router = useRouter(),
    action = useAction();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/me"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      legal_entity_name: "",
      lei: "",
      contract_address: "",
      wallet_address: "",
      policy_version: "1.0",
      notes: "",
    },
  });
  function field(
    name: keyof Values,
    label: string,
    placeholder: string,
    optional = false,
  ) {
    return (
      <label className="field">
        <span>
          {label}
          {optional && <small>Optional</small>}
        </span>
        <input
          {...register(name)}
          placeholder={placeholder}
          aria-invalid={!!errors[name]}
        />
        {errors[name] && <em role="alert">{errors[name]?.message}</em>}
      </label>
    );
  }
  return (
    <>
      <Link className="back-link" href="/cases">
        <ArrowLeft size={15} />
        All compliance cases
      </Link>
      <PageTitle
        eyebrow="START A NEW WORKFLOW"
        title="New compliance case"
        description="Define the issuer and scope. Add supporting evidence in the next step."
      />
      <div className="form-layout">
        <form
          className="panel case-form"
          onSubmit={handleSubmit((values) =>
            action.run(async () => {
              const result = await api<Case>("/cases", {
                method: "POST",
                body: JSON.stringify({
                  ...values,
                  lei: values.lei || null,
                  wallet_address: values.wallet_address || null,
                  chain_id: 11155111,
                }),
              });
              router.push(`/cases/${result.id}`);
            }, "Case created"),
          )}
        >
          <div className="form-section">
            <div className="section-title">
              <Building2 size={20} />
              <div>
                <h2>Issuer details</h2>
                <p>Use the legal identity shown in your source documents.</p>
              </div>
            </div>
            {field("title", "Case name", "e.g. Aurora / Issuer onboarding")}
            <label className="field">
              <span>Organization</span>
              <input value={profile.data?.organization?.name || ""} readOnly />
            </label>
            <div className="form-grid">
              {field(
                "legal_entity_name",
                "Legal entity name",
                "Registered legal entity",
              )}
              {field(
                "lei",
                "Legal Entity Identifier",
                "20-character LEI",
                true,
              )}
            </div>
          </div>
          <div className="form-section">
            <div className="section-title">
              <Network size={20} />
              <div>
                <h2>Blockchain reference</h2>
                <p>
                  Contract existence is a technical check, not an endorsement.
                </p>
              </div>
            </div>
            <label className="field">
              <span>Blockchain network</span>
              <select disabled>
                <option>Ethereum Sepolia / Chain ID 11155111</option>
              </select>
            </label>
            {field("contract_address", "Smart contract address", "0x...")}
            {field("wallet_address", "Wallet address", "0x...", true)}
          </div>
          <div className="form-section">
            <div className="section-title">
              <ShieldCheck size={20} />
              <div>
                <h2>Policy & context</h2>
              </div>
            </div>
            <label className="field">
              <span>Readiness policy</span>
              <select {...register("policy_version")}>
                <option value="1.0">
                  RG-DAR-001 v1.0 / Standard readiness
                </option>
                <option value="2.0">
                  RG-DAR-001 v2.0 / Wallet proof + 1-hour freshness
                </option>
              </select>
            </label>
            <label className="field">
              <span>
                Case notes <small>Optional</small>
              </span>
              <textarea
                {...register("notes")}
                rows={3}
                placeholder="Context for your reviewers..."
              />
            </label>
          </div>
          <ActionFeedback action={action} />
          <div className="form-actions">
            <Button asChild variant="secondary">
              <Link href="/cases">Cancel</Link>
            </Button>
            <Button disabled={action.busy} type="submit">
              {action.busy ? "Creating..." : "Create case & add evidence"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </form>
        <aside className="form-aside">
          <div className="panel">
            <FileUp size={24} />
            <h3>Your next step: evidence</h3>
            <p>
              Upload PDF or DOCX files after creating the case. Every document
              receives a SHA-256 fingerprint and a private storage location.
            </p>
            <ul>
              <li>Maximum 10 MB per file</li>
              <li>Up to 5 files per case</li>
              <li>Text-based PDFs; scanned files need OCR</li>
            </ul>
          </div>
          <div className="subtle-note">
            A PASS result means a specific policy rule was met using recorded
            evidence. It does not establish legal compliance.
          </div>
        </aside>
      </div>
    </>
  );
}
