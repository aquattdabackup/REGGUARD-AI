# Five-minute demo script

Five minutes is an internal presentation target; the event's required video duration remains unverified. Use the local fixture workspace and state that it contains fictional evidence and simulated sources. Keep actual secrets, browser console tokens and private exports off screen.

| Time | Show | Narration |
|---|---|---|
| 0:00?0:30 | Landing and workspace overview | "Issuer onboarding scatters evidence across files, reference databases and blockchain explorers. RegGuard connects each readiness finding to the evidence and policy that produced it." |
| 0:30?1:20 | Aurora ? Run evaluation ? R03 | "The demo uses fictional documents and a labeled fixture extractor. In live mode, a configured model produces structured fields and exact citations. The rule engine, not the model, decides whether this internal policy passes." Show original PDF, highlighted line and observed/expected values. |
| 1:20?1:55 | Northstar ? evaluate ? R03 ? Reviews | "Conflicting entity names require human review. They are not an allegation of fraud." Record a rationale. Point out that the original outcome remains intact. |
| 1:55?2:30 | Aurora ? Overview ? v2.0 ? Replay snapshot | "What changes if the policy changes? This replay uses the exact old evidence and timestamp. The stricter freshness and wallet rules change the result without rewriting history." Show R05 and R08 differences. |
| 2:30?3:05 | Simulate lapsed registration / source outage | "A source change produces a new snapshot and audit event. An unavailable source remains UNKNOWN, rather than silently passing." Label both controls as simulated. |
| 3:05?4:05 | Reports ? Finalize ? JSON package ? independent verifier | "Finalization freezes the evidence, policy and review. Verification recomputes the canonical salted commitment locally." Show ANCHOR NOT FOUND for the unanchored export. Modify the report title in a copy and show INTEGRITY MISMATCH. |
| 4:05?4:40 | Local chain test result / CRE source and status | "The registry and verifier have been tested with actual transactions on local Anvil. Read-only GLEIF and Sepolia calls also succeeded. Public Sepolia anchoring and authenticated CRE simulation are not yet completed. The CRE workflow itself compiles and uses real HTTP and EVM capabilities." |
| 4:40?5:00 | Closing evidence inspector | "The product's contribution is traceable readiness: cited facts, reproducible policies, accountable review and verifiable report integrity. Human legal judgment remains essential." |

## Rehearsal checklist

Run the demo helper, confirm `/ready`, and launch a fresh workspace. Keep Aurora for the valid v1 flow. Each new report corresponds to a new evaluation; a finalized report cannot be edited. If an evaluation completes with UNKNOWN, inspect the source error instead of claiming success. Use `fixtures/documents` to demonstrate an additional upload in Meridian.

Browser screenshots in `docs/screenshots` come from automated tests and show actual UI states. Keep the fixture banner visible when recording. The sample entity documents are explicitly fictional; the live GLEIF smoke-test LEI refers to an unrelated public entity and is not evidence about Aurora.

## After external integrations are completed

Replace the local-chain segment with the actual Sepolia explorer receipt and independent verifier using the published trusted registry. Replace the CRE code/status segment with real CLI simulation output and its execution provenance. Show a live structured extraction only after configuring the paid service and validating its citations. Do not use placeholder receipts or simulated success badges.

Fallback: show the measured local tests and state the unavailable service precisely. No made-up customer traction, legal approval, accuracy percentage or time-saving claim is included.
