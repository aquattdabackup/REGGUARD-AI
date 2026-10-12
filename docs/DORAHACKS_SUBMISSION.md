# DoraHacks submission draft ? not submitted

## Project name
RegGuard AI

## Tagline
Verifiable compliance intelligence for digital asset issuer onboarding.

## Problem
Onboarding teams need to connect document claims, current entity reference data, on-chain observations and the exact version of the policy being reviewed. A report without those references is hard to revisit when evidence or policy changes.

## Solution
RegGuard provides private case/evidence management, structured extraction with validated citations, immutable external-source snapshots, an eight-rule deterministic internal readiness policy, attributed human review, policy replay, source-change detection and finalized PDF/JSON reports. Independent browser and CLI tools recompute salted canonical commitments and compare them with trusted finalized registry state and transaction events.

## Technical implementation
Next.js/React/TypeScript UI, FastAPI/Pydantic/SQLAlchemy API, PostgreSQL/Supabase integration with RLS and private storage, durable worker, PyMuPDF/DOCX extraction, OpenAI Responses structured-output adapter, GLEIF and EVM connectors, Solidity/OpenZeppelin/Foundry contracts, Viem verification, and a Chainlink CRE TypeScript workflow using HTTP consensus and finalized EVM capabilities.

## What is demonstrated today
The complete local fixture workflow, responsive browser journeys, cited PDF inspection, reviews, report finalization/export/tamper detection, replay and source recheck are tested. Real read-only GLEIF and Sepolia calls succeeded. Actual contract deployment/anchor/verification transactions were exercised on local Anvil. PostgreSQL migration/RLS/immutability SQL ran in PGlite with emulated Supabase-owned schemas. The CRE workflow compiles to WASM.

## Explicit limits
The demo is fictional and uses a deterministic fixture extractor, not a paid live model. Supabase signup/reset/storage have no account-backed validation yet. No public Sepolia deployment or anchor is claimed. CRE CLI simulation is blocked by missing account/API-key authentication; no DON execution is claimed. The frontend is deployed on Vercel; hosted backend, video recording and official submission are incomplete. Policies are internal demonstration policies, not jurisdiction-specific legal advice or certification.

## Differentiation
Evidence can be inspected at its original page, replayed without changing source time, reviewed without rewriting the machine result and exported for verification without trusting the application database. Blockchain is used for report integrity rather than storing sensitive documents.

## Validation
See `docs/TEST_REPORT.md`, `docs/LIVE_READ_RESULTS.json`, `contracts/test`, `services/api/tests`, `apps/web/tests` and `docs/screenshots`. Validation counts and provenance must be updated if code changes before submission.

## Links and fields still required

- Repository URL: https://github.com/aquattdabackup/REGGUARD-AI (user-supplied target).
- Hosted frontend URL: https://regguard-ai.vercel.app (Supabase/Railway backend not yet connected).
- Demo video URL: NOT RECORDED.
- Public Sepolia contract/transaction: NOT DEPLOYED.
- CRE execution ID / simulation log: AUTHENTICATION BLOCKED.
- Team names, contact, jurisdiction, eligibility attestations: USER INPUT REQUIRED.
- Track/bounty selections, official submission deadline/timezone and video duration: UNVERIFIED.

Official event page: https://bli.tools/hackathon/ . Submission page referenced by the brief: https://dorahacks.io/hackathon/legal-hack-2026 . Review current rules before sending; judging dates are not a submission deadline. This document is prepared content, not organizer endorsement or evidence of entry.
