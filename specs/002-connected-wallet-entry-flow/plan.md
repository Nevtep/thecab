# Implementation Plan: Connected Wallet Live Reconstruction Entry Flow

**Branch**: `002-wallet-entry-flow` | **Date**: 2026-04-19 | **Spec**: `/specs/002-connected-wallet-entry-flow/spec.md`
**Input**: Feature specification from `/specs/002-connected-wallet-entry-flow/spec.md`

## Summary

Make The Cab genuinely usable from the browser by extending the existing wagmi-based wallet runtime, wallet analysis session API, reconstruction executor, and canonical ledger projection flow into a session-aware connected-wallet experience. The implementation will keep the canonical ledger as the source of truth, reuse deterministic wallet sessions on Base, navigate users into a session-backed ledger view immediately, run live reconstruction from the connected wallet context, show the latest accepted result while a fresh run is refreshing, and isolate fixture-backed discovery so tests and replay retain deterministic coverage without leaking into the production runtime path.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS  
**Primary Dependencies**: Next.js 15 App Router, React 19, wagmi 2, viem 2, TanStack Query 5, Zod, Drizzle ORM, PostgreSQL driver  
**Storage**: PostgreSQL 16 for analysis sessions, reconstruction runs, immutable raw observations, and canonical ledger outputs; client-side wallet/runtime state remains in browser memory only  
**Testing**: Vitest for unit, replay, contract, and integration tests; Playwright for browser wallet flow validation  
**Target Platform**: Next.js web application on the Node.js runtime with browser wallet connectivity, Base RPC access, and PostgreSQL persistence  
**Project Type**: Full-stack web application with client wallet runtime, server route handlers, and domain-centric services  
**Performance Goals**: Show wallet readiness immediately after connection, navigate into the session-backed ledger flow in under 2 seconds on a warm local environment, and produce a successful, empty, or failure outcome for a representative live wallet within 30 seconds; if a reusable session already has an accepted run, show that accepted result immediately while the refresh run is in progress  
**Constraints**: Exactly one connected wallet at a time, Base only, analytics-only boundary, connected wallet address is the only valid runtime wallet input, production flow must not use fixtures or hardcoded corpora, stale results must not be shown across wallet or chain switches, canonical outputs must preserve pool-first grouping and manual versus supported Mellow separation  
**Scale/Scope**: Small initial user base, one browser-connected wallet per session, representative wallets with up to roughly 1,000 candidate transactions, scope limited to Aerodrome manual activity plus the currently supported Mellow integration on Base

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Gate Result (Pre-Research)**: PASS

- **Ledger-First Truth**: PASS. The plan keeps the existing canonical ledger projection as the only trusted result shown to the user.
- **Pool-First Analysis**: PASS. The entry flow reuses the canonical ledger projection rather than introducing a parallel wallet-summary representation that would bypass pool grouping.
- **Strategy Isolation**: PASS. Manual and supported Mellow activity remain separated because the feature reads existing strategy-aware ledger outputs.
- **Deterministic Event Classification**: PASS. Live analysis continues to use the same deterministic classifier pipeline already defined for the ledger feature.
- **Automatic Classification and Source Immutability**: PASS. The feature only changes entry flow, session orchestration, and read contracts; immutable raw observations and append-only reconstruction outputs remain intact.
- **Explicit Handling of Untrusted Transactions**: PASS. Discarded activity remains reviewable but does not block the main flow.
- **Analytics-Only Boundary**: PASS. The feature adds connection and analysis orchestration only; no transaction submission or key management is introduced.
- **Scope Constraints**: PASS. The plan stays on Base, one wallet at a time, Aerodrome plus supported Mellow only.
- **Spec-Driven Delivery Discipline**: PASS. The plan is derived directly from the clarified feature specification and the current constitution.

## Project Structure

### Documentation (this feature)

```text
specs/002-connected-wallet-entry-flow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── connected-wallet-entry.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── page.tsx
├── ledger/
│   └── page.tsx
└── api/
    └── analysis-sessions/
        ├── route.ts
        └── [sessionId]/
            ├── route.ts
            ├── reconstructions/
            │   └── route.ts
            ├── ledger/
            │   ├── route.ts
            │   └── events/
            │       └── [ledgerRecordId]/route.ts
            └── discarded-activity/
                └── route.ts

src/
├── ui/
│   ├── providers/
│   │   └── app-providers.tsx
│   └── wallet/
│       ├── connected-wallet-ledger.tsx
│       ├── connected-wallet-analysis-view.tsx
│       └── use-connected-wallet-analysis.ts
├── domains/
│   ├── wallet-session/
│   │   ├── model/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── contracts/
│   └── ledger/
│       ├── contracts/
│       ├── projections/
│       ├── repositories/
│       └── services/
├── infrastructure/
│   ├── chain/
│   └── db/
└── lib/

tests/
├── contract/
├── integration/
├── replay/
└── e2e/
```

**Structure Decision**: Keep the single Next.js App Router application and extend the existing domain-centric layout. Wallet connectivity and browser-derived state stay in client components and hooks under `src/ui/wallet/`, while session orchestration, run-status summaries, and canonical ledger reads remain on server route handlers and domain services. No new service boundary or separate frontend/backend split is warranted for this feature.

## Phase 0 Research Outcomes

- Keep the existing root-level wagmi and React Query provider placement in `app/layout.tsx` and `src/ui/providers/app-providers.tsx`, but tighten the connected-wallet flow around a Base-only runtime and session-aware client hooks instead of adding a second wallet runtime.
- Treat connected-wallet state as client-owned and ephemeral, while server-side analysis remains session-owned and persisted by wallet address plus Base chain.
- Reuse deterministic session identity on Base, navigate to the ledger view immediately after session bootstrap, and trigger the live reconstruction refresh from the ledger experience so a reusable session can show its latest accepted result while the new run is in progress.
- Add a session status read contract so the client can poll latest accepted run and latest live run state, which enables running, refreshing, empty, and failure UX states without inventing client-only truth.
- Keep the current request-driven reconstruction executor for this slice; do not add background queues yet. Use persisted run rows plus polling to surface in-progress status.
- Split fixture-backed replay discovery from production discovery so the browser user path can never source candidate transactions or observations from fixture files.
- Use a derived finite state model for the wallet entry experience: `not_connected`, `wrong_chain`, `ready`, `session_loading`, `reconstruction_running`, `refreshing_with_latest`, `success`, `empty`, and `failure`.

See `/specs/002-connected-wallet-entry-flow/research.md` for the complete decision log.

## Phase 1 Design Overview

### Architecture Flow

1. The app shell mounts the existing wagmi and React Query providers with Base-only runtime configuration.
2. The connected-wallet entry component derives browser wallet state from wagmi hooks and prevents analysis until one wallet is connected on Base.
3. Starting analysis posts the connected wallet address and Base chain to `POST /api/analysis-sessions`, which creates or reuses the deterministic wallet session.
4. The client navigates immediately to `/ledger?sessionId=...` and loads a session-aware ledger experience.
5. The ledger experience fetches a session status summary, verifies that the session wallet and chain still match the active connected context, and blocks stale cross-wallet rendering on mismatch.
6. If a latest accepted run exists, the client loads the canonical ledger projection immediately and displays it.
7. The ledger experience triggers `POST /api/analysis-sessions/{sessionId}/reconstructions` in the background, then polls the session status summary until the latest run settles.
8. On acceptance, the client refreshes the canonical ledger projection; on a zero-result accepted run it shows the empty state; on a failed run it shows the failure state while preserving any earlier accepted result when appropriate.
9. Review of discarded activity remains available through the existing discarded-activity contract without interrupting the main inspection path.
10. Replay tests and fixture-driven validation call explicit replay discovery paths only; production browser flow uses live discovery exclusively.

### Design Decisions

- **Wallet runtime**: Reuse the existing `WagmiProvider` setup and keep wallet connectivity entirely client-side; no server session or cookie-based wallet auth is introduced.
- **Provider placement**: Continue mounting providers at the root layout so both the home entry panel and the ledger experience share one wallet runtime and one query cache.
- **Client/server boundary**: The client supplies the connected wallet address only when creating or resuming a Base session; all later reconstruction and ledger reads derive authoritative wallet context from the persisted session.
- **Session reuse semantics**: `analysisSessionId` remains deterministic by `chainId + walletAddress`. A reused session can surface its latest accepted ledger immediately while a fresh live run updates persisted run status in the background.
- **Run orchestration**: Use a dedicated session-status read route rather than embedding all orchestration state inside the projection route. This keeps the canonical ledger contract stable while exposing the minimum data needed for wallet flow UX.
- **Fixture isolation**: Replace the current implicit fixture fallback in candidate discovery with explicit live and replay discovery adapters. Production routes must only invoke the live adapter; replay tests invoke the replay adapter.
- **Stale result prevention**: The ledger view compares the connected wallet and active chain against the session summary before rendering or refreshing; mismatches show an explicit guarded state instead of silently reusing the old session’s results.
- **UI state model**: The wallet experience is derived from wallet connection state, chain validation, session-summary data, run status, and projection contents. No separate persistence layer is needed for UI-only states.

### Implementation Slices For Task Generation

1. Add a session status summary API and corresponding domain service that exposes session identity, latest accepted run, latest run, and failure metadata.
2. Refactor the connected-wallet entry component into an explicit state-driven browser flow for not connected, wrong chain, ready, and session loading states.
3. Rework the ledger route into a session-aware experience that can load the latest accepted projection, trigger a refresh run after navigation, poll session status, and guard against stale wallet or chain context.
4. Split candidate discovery into live-only production discovery and replay-only fixture discovery; route production reconstruction through the live path exclusively.
5. Extend contracts, contract tests, integration tests, and Playwright browser validation to cover wrong-chain handling, session reuse, refresh-with-latest behavior, empty state, and failure state.

## Post-Design Constitution Check

**Gate Result (Post-Design)**: PASS

- Ledger-first truth remains intact because the browser flow still renders only canonical ledger projections and related run metadata.
- Pool-first analysis and strategy isolation remain intact because the plan adds session and view-state orchestration only, not alternative aggregation models.
- Deterministic classification and immutable raw observations remain intact because the feature explicitly isolates fixtures to replay/testing and continues to use the existing live ingestion and normalization pipeline.
- Analytics-only boundaries remain intact because wallet connection is used only to identify the wallet under analysis, not to sign or submit transactions.
- The plan respects scope constraints by remaining single-wallet, Base-only, and limited to Aerodrome plus the supported Mellow integration.

## Complexity Tracking

No constitution violations or exceptional complexity justifications are required at plan time.
