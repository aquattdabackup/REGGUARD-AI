# Security, privacy and operational limits

This is a tested hackathon implementation, not a completed security audit. No real customer records were used. Report contents can contain private evidence; protect exported JSON and its salt as carefully as the source files.

## Controls implemented

- Server-side JWT verification against Supabase JWKS; issuer, audience, expiration and subject validation. Membership and role checks are independent of frontend visibility. Demo tokens are opaque, hashed in storage, isolated by organization, expire after eight hours and are refused outside development mode.
- Tenant-constrained resource lookups return 404 across organizations. Roles: Owner/Admin/Analyst write cases and evidence; Owner/Admin/Reviewer review, finalize and anchor; Viewer reads only. Organization edits require Owner/Admin. User-supplied organization IDs never grant authority.
- Supabase RLS covers private tables and storage paths. Browser DML is revoked, membership self-grants are prohibited, salts/signed transactions are API-only. SQL tests use PostgreSQL WASM with emulated auth/storage schemas; hosted Supabase behavior still needs verification.
- Uploads: 10 MB, five per case, MIME/extension/signature checks, normalized filenames, generated private paths, digest validation, limited DOCX ZIP inflation/entries/path traversal, macro/external-relationship rejection and parser subprocess timeout. Complete request streaming is capped before multipart parsing, including requests without Content-Length. Scanned PDFs produce unavailable evidence; there is no fabricated OCR.
- AI treats documents as untrusted input, has no tools, must return structured fields and exact citations, and cannot assign policy outcomes. Missing/uncertain evidence is not promoted to PASS. Cost reservations precede requests under an organization lock. Only metadata/error codes are logged; complete prompts/documents are not application log messages.
- Finalized reports freeze payload, reviews, policy hash, salt, version and record key. The database trigger permits lifecycle status changes only. New information requires a new evaluation/report. App audit events are attributable, but are not a separate tamper-proof ledger against a database administrator.
- Wallet nonces bind domain, organization, case, address, chain, expiry and one-time use. Signatures prove key possession, not a person's identity or legal authority.
- AuditRegistry restricts anchoring by role and rejects zero/duplicate keys. Receiver pins forwarder/workflow/owner and enforces freshness. Public writes contain commitments and an opaque key; source names, LEIs, documents and salt are not written to the registry.
- Independent verification recomputes the canonical payload and policy, checks trusted registry/network, finalized state and the matching transaction event. It cannot attest that source evidence is true. Browser verification does not upload the report to RegGuard.

## Remaining production controls

The Python parser is a separate process but is not a full sandbox. Deploy with non-root containers, OS memory/CPU limits, restricted egress and malware scanning. Uploaded evidence can be hostile. Windows demo mode does not impose an OS memory ceiling on a parser process.

The rate limiter is per API process, not distributed, and is not a DDoS perimeter. Configure trusted proxy handling and an edge limiter before exposing the app. CSP still permits inline scripts/styles required by the current static Next.js setup and eval for development compatibility; tighten with nonces in a production-hardening pass. Supabase browser sessions are stored by its SDK; XSS would endanger them. React text escaping and safe citation rendering are not a substitute for a full XSS review.

A single worker is required for one transaction signer. Nonce coordination across replicas, replacement transactions, signer/HSM service isolation and operational key rotation are not implemented. Pending finality polls can remain pending indefinitely until an operator investigates. Registry admin keys remain a trust boundary.

Live JWT/email/password-reset/storage flows have no account-backed test yet. The first membership is the active organization; organization switching, team invitation/role-management UI, account deletion and automatic evidence deletion are incomplete. Demo logout expires the session; it does not erase the workspace. Do not upload confidential production data until a retention/deletion process and provider data-processing terms are approved.

OpenAI `store=False` is requested, but provider retention/account terms still govern transmitted document text. No guarantee of zero data retention is made. Prompt-injection defenses and citation validation have deterministic tests; resistance against a live model has not been measured. Unicode PDFs use Noto Sans (Latin/Greek/Cyrillic); not every world script is covered. Original files and JSON preserve Unicode data.

Dependency locks improve reproducibility but do not constitute a supply-chain audit. CI definitions are supplied; a hosted CI run has not been observed. Backups, disaster recovery, load testing, observability alerts, penetration testing and legal policy validation are not complete.

## Retention and incident handling

Define an organization retention schedule before production. Include evidence storage, snapshots, reports, exports, AI-provider data and backups. The current API exposes no deletion endpoint to avoid silently erasing audit evidence; an administrator must implement the approved lifecycle and legal-hold procedure. A salted on-chain commitment is persistent; destroying a salt may prevent later proof but does not remove an on-chain transaction.

If a signer is compromised, revoke its ANCHOR_ROLE using the separate registry administrator, stop anchoring and reconcile finalized events. If a Supabase/service key is compromised, rotate it, terminate affected sessions, restrict access and review tenant/audit logs. Keep incident logs free of raw document content.
