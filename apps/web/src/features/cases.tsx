"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowRight, Building2, Filter, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Case } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Badge,
  Empty,
  ErrorMessage,
  Loading,
  PageTitle,
} from "@/components/ui/shared";
const helper = createColumnHelper<Case>();
const columns = [
  helper.accessor("title", {
    header: "CASE / ENTITY",
    cell: (info) => (
      <Link className="case-cell" href={`/cases/${info.row.original.id}`}>
        <span className="entity-icon">
          <Building2 size={18} />
        </span>
        <span>
          <strong>{info.getValue()}</strong>
          <small>{info.row.original.legal_entity_name}</small>
        </span>
      </Link>
    ),
  }),
  helper.accessor("status", {
    header: "STATUS",
    cell: (info) => <Badge status={info.getValue()} />,
  }),
  helper.accessor("policy_version", {
    header: "POLICY",
    cell: (info) => (
      <span className="policy-tag">
        RG-DAR-001 <small>v{info.getValue()}</small>
      </span>
    ),
  }),
  helper.accessor("mode", {
    header: "EVIDENCE",
    cell: (info) => (
      <span className="provenance-label">
        <i />
        {info.getValue() === "fixture" ? "Simulated" : "Live"}
      </span>
    ),
  }),
  helper.display({
    id: "open",
    header: "",
    cell: (info) => (
      <Link
        className="row-open"
        href={`/cases/${info.row.original.id}`}
        aria-label={`Open ${info.row.original.title}`}
      >
        <ArrowRight size={17} />
      </Link>
    ),
  }),
];
export function CasesTable({
  data,
  compact = false,
}: {
  data: Case[];
  compact?: boolean;
}) {
  // React Compiler is disabled; TanStack Table intentionally returns dynamic accessors.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!data.length)
    return (
      <Empty title="No cases yet">
        Create a compliance case to start collecting evidence.
      </Empty>
    );
  return (
    <div className={`table-scroll ${compact ? "compact" : ""}`}>
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function CasesPage({
  initialQuery = "",
  inspector = false,
}: {
  initialQuery?: string;
  inspector?: boolean;
}) {
  const [search, setSearch] = useState(initialQuery),
    [status, setStatus] = useState("ALL"),
    [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["cases", search, offset],
    queryFn: () =>
      api<{ items: Case[]; total: number }>(
        `/cases?q=${encodeURIComponent(search)}&limit=25&offset=${offset}`,
      ),
  });
  const data =
    query.data?.items.filter((c) => status === "ALL" || c.status === status) ||
    [];
  return (
    <>
      <PageTitle
        eyebrow={inspector ? "EVIDENCE INTELLIGENCE" : "ISSUER ONBOARDING"}
        title={inspector ? "Evidence inspector" : "Compliance cases"}
        description={
          inspector
            ? "Choose a case to trace each finding back to its original evidence."
            : "Manage issuer readiness from first document to finalized audit."
        }
      >
        <Button asChild>
          <Link href="/cases/new">
            <Plus size={17} />
            New compliance case
          </Link>
        </Button>
      </PageTitle>
      <section className="panel">
        <div className="table-toolbar">
          <div className="filter-tabs">
            <button
              className={status === "ALL" ? "selected" : ""}
              onClick={() => setStatus("ALL")}
            >
              All cases <span>{query.data?.total || 0}</span>
            </button>
            <button
              className={status === "REVIEW_REQUIRED" ? "selected" : ""}
              onClick={() => setStatus("REVIEW_REQUIRED")}
            >
              Needs review
            </button>
            <button
              className={status === "DRAFT" ? "selected" : ""}
              onClick={() => setStatus("DRAFT")}
            >
              Drafts
            </button>
          </div>
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Filter cases"
              placeholder="Search case names..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </label>
        </div>
        <ErrorMessage error={query.error} />
        {query.isPending ? <Loading /> : <CasesTable data={data} />}
        <div className="table-footer">
          <span>
            {query.data?.total || 0} cases / Page {offset / 25 + 1}
          </span>
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={offset + 25 >= (query.data?.total || 0)}
              onClick={() => setOffset(offset + 25)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      <div className="inline-note">
        <Filter size={15} />
        Status filters apply to the current page. Source provenance is preserved
        with every evaluation.
      </div>
    </>
  );
}
