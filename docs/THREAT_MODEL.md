# Threat model

| Threat / actor | Trust boundary and mitigation | Residual risk / verification |
|---|---|---|
| Another organization requests guessed IDs | UUID validation and tenant-filtered API queries; RLS and storage path membership | API cross-tenant tests and SQL role tests pass; real Supabase configuration untested |
| Viewer/Analyst tries to finalize or self-promote | Server role checks; membership DML revoked | Privileged administrators remain trusted; no self-service invitations |
| Document embeds model instructions or invented citations | No model tools; system task boundary; exact citation/value validation; deterministic rule engine | Live-model adversarial evaluation pending; contextual misinterpretation can survive literal grounding |
| Malicious PDF/DOCX exhausts resources | Request/file/page/text/archive limits; parser process deadline | Needs OS memory limits and malware controls |
| External source fails or returns a different identity | Fixed official endpoint, LEI match, chain-ID validation, error snapshots | Source authority and DNS/RPC provider remain trusted; UNKNOWN preserves failures |
| Duplicate API requests / crashed worker | Idempotency keys, locks, lease owner, heartbeat, bounded retries, immutable completion | Single signer; production concurrency/load tests pending |
| Report modified after review | RFC8785 salted hash; finalization trigger; append-only registry | A new self-consistent package is possible; only trusted registry can establish provenance |
| Forged anchor metadata / unrelated transaction | Independently selected registry, finalized state, matching event/key/hash/policy | RPC dishonesty and registry/admin trust remain; no light-client proof |
| Fake CRE / simulated evidence presented as real | Explicit fixture provenance; missing authenticated CRE artifact remains UNAVAILABLE | Simulator/account and DON execution not verified; artifact ingestion incomplete |
| Wallet signature replay | Domain/case/org/chain/expiry/nonce binding and one-time consumption | Wallet possession cannot prove corporate authority |
| Browser XSS steals a session | Escaped React text, safe PDF citation renderer, CSP and private API | Static CSP is not fully hardened; full security review pending |
| Database administrator changes historical inputs | Frozen app snapshots, report commitment, on-chain append-only state | Unanchored drafts and app audit logs rely on database administration |

The public commitment is an integrity mechanism, not a privacy guarantee for metadata that was voluntarily published elsewhere. No private document content is sent through CRE.
