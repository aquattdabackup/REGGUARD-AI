"use client";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { request } from "@/lib/api";
import type { EvidenceDocument } from "@/lib/types";
import { ErrorMessage, Loading } from "@/components/ui/shared";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export default function PdfViewer({
  document,
  page,
  onPage,
  excerpt,
}: {
  document: EvidenceDocument;
  page: number;
  onPage: (n: number) => void;
  excerpt: string;
}) {
  const [file, setFile] = useState<{ data: Uint8Array } | null>(null),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    setFile(null);
    setError(null);
    if (document.mime_type !== "application/pdf") return;
    request(`/documents/${document.id}/content`)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        if (active) setFile({ data: new Uint8Array(buffer) });
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [document.id, document.mime_type]);
  const count = document.pages.length || 1;
  return (
    <div className="document-viewer">
      <div className="viewer-toolbar">
        <span>
          <FileText size={16} />
          {document.filename}
        </span>
        <div>
          <button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {document.mime_type === "application/pdf" ? "Page" : "Section"}{" "}
            {page} / {count}
          </span>
          <button
            aria-label="Next page"
            disabled={page >= count}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <ErrorMessage error={error} />
      <div
        className="document-canvas"
        tabIndex={0}
        role="region"
        aria-label="Document preview"
      >
        {document.mime_type === "application/pdf" ? (
          file ? (
            <Document file={file} loading={<Loading />} onLoadError={setError}>
              <Page
                pageNumber={Math.min(page, count)}
                width={510}
                renderAnnotationLayer={false}
                customTextRenderer={({ str }) =>
                  excerpt &&
                  str.trim().length > 3 &&
                  excerpt.includes(str.trim())
                    ? `<mark>${escape(str)}</mark>`
                    : escape(str)
                }
              />
            </Document>
          ) : (
            <Loading />
          )
        ) : (
          <pre className="document-text">
            {document.pages.find((p) => p.page === page)?.text ||
              "Text extraction pending"}
          </pre>
        )}
      </div>
      {excerpt && (
        <div className="located-excerpt">
          <span>LOCATED SOURCE EXCERPT</span>
          <blockquote>{excerpt}</blockquote>
        </div>
      )}
    </div>
  );
}
