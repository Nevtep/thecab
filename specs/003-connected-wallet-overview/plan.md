# Implementation Plan: Connected Wallet Overview

**Branch**: `003-connected-wallet-overview` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-connected-wallet-overview/spec.md`

## Summary

Deliver the first full-stack connected dashboard for The Cab by implementing `/overview` as a server-owned, chain-aware wallet cockpit that reuses the existing design system and application plumbing. The active delivery stage is intentionally limited to a fast recent view backed by server-side Moralis balances/history plus Alchemy pricing, together with canonical analysis start/status scaffolding. The plan keeps Moralis and Alchemy strictly server-side, normalizes analysis status semantics, persists recent Overview artifacts for auditability, and completes the required EN/ES localization surface while explicitly deferring analyzed-history rendering and historical reconstruction to a follow-up stage.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Next.js, TanStack Query 5.x, wagmi 3.x, WalletConnect connectors, i18next/react-i18next, Drizzle ORM, pg, Trigger.dev SDK, Tamagui 2.0.0-rc.42, Recharts 3.x, Zod 4.x  
**Storage**: PostgreSQL via Drizzle ORM (`analysis_runs`, `raw_provider_records`, `price_points`, `coverage_reports`, `portfolio_snapshots`, `performance_snapshots`, `wallet_contexts`)  
**Testing**: ESLint 9, TypeScript `tsc --noEmit`, Next.js build, `pnpm i18n:check`, provider smoke script, focused route/query validation  
**Target Platform**: Web application on Next.js App Router with Vercel-style request handling and Trigger.dev background jobs  
**Project Type**: Full-stack web application feature inside `apps/web`  
**Performance Goals**: Connected shell renders immediately; recent Overview returns useful data without waiting for historical analysis; analysis polling updates in-session without blocking the screen  
**Constraints**: No browser-direct Moralis or Alchemy calls; Base mainnet only for v1 UX; chain-aware API/query/persistence contracts; reuse existing DS primitives; no hardcoded user-facing copy; keep current landing intact  
**Scale/Scope**: One connected route (`/overview`), one feature module under `src/features/overview`, one wallet-scoped Overview API, analysis status/start contract normalization, recent-view persistence/write path, and EN/ES namespace completion for Overview-adjacent copy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: **PASS**. Plan reuses the established DS shell and chart system and preserves the control-tower visual language defined in the brand spec.
- Localization gate: **PASS**. Overview, Navigation, Analysis, Coverage, Charts, and touched shared namespaces are explicitly included with EN/ES parity and no-hardcoded-copy enforcement.
- Chain-awareness gate: **PASS**. All route, API, persistence, and query-key work remains chain-scoped through the existing `src/chains/chains.ts` layer.
- Provider/API gate: **PASS**. Moralis remains wallet-centric discovery, Alchemy remains pricing source, and all third-party access stays server-side; long-running analysis remains on Trigger.dev.
- Explainability gate: **PASS**. Raw provider persistence, coverage artifacts, snapshot persistence, and analyzed-history selection are kept explicit and traceable.

## Project Structure

### Documentation (this feature)

```text
specs/003-connected-wallet-overview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── analysis-status-contract.md
│   ├── overview-api-contract.md
│   └── overview-source-selection-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── package.json
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── overview/
│   │   │   └── page.tsx                 # to be added
│   │   └── api/
│   │       ├── analysis/
│   │       │   ├── start/route.ts
│   │       │   └── status/route.ts
│   │       └── wallet/
│   │           └── overview/route.ts
│   ├── chains/
│   │   └── chains.ts
│   ├── design-system/
│   │   ├── charts/
│   │   ├── data-display/
│   │   └── layout/
│   ├── features/
│   │   └── overview/                     # to be added
│   │       ├── Overview.container.tsx
│   │       ├── Overview.component.tsx
│   │       ├── overview.queries.ts
│   │       ├── overview.mappers.ts
│   │       └── overview.types.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── formatters.ts
│   │   └── locales/
│   │       ├── en/
│   │       └── es/
│   ├── queries/
│   │   ├── apiClient.ts
│   │   ├── hooks.ts
│   │   └── keys.ts
│   ├── server/
│   │   ├── analysis/
│   │   ├── db/
│   │   ├── env.ts
│   │   ├── overview/                     # to be added
│   │   │   ├── getAnalyzedOverview.ts        # deferred follow-up stage
│   │   │   ├── getRecentOverview.ts
│   │   │   ├── overview.repository.ts
│   │   │   └── overview.types.ts
│   │   └── providers/
│   │       ├── alchemy/
│   │       └── moralis/
│   ├── stores/
│   └── wallet/
└── scripts/
   ├── check-ds-color-semantics.ts
   └── check-i18n-parity.ts
```

**Structure Decision**: Keep implementation inside the existing `apps/web` Next.js app. Add a new App Router entry at `src/app/overview/page.tsx`, a dedicated feature module under `src/features/overview`, and a server-owned Overview module under `src/server/overview` to isolate provider orchestration, persistence, and mode selection logic from route handlers and UI containers.

## Phase 0: Outline & Research

Research completed for:

1. **Connected route and feature module pattern**: keep `/` as landing and add `/overview` with a feature module under `src/features/overview` to match the product spec’s container/component/mappers/types pattern.
2. **Server-only provider integration**: use existing Moralis connectors (`getWalletTokens`, `getWalletHistory`) and existing Alchemy pricing connector (`getCurrentTokenPricesByAddress`) behind a new `src/server/overview` aggregation layer; do not call third-party APIs from frontend code.
3. **Analysis status normalization**: keep `analysis_runs` for queued/running/ready/failed lifecycle, and derive `stale` from wallet freshness metadata so stale remains a read-model concern rather than a long-lived persisted run state.
4. **Persistence strategy for the active stage**: recent view writes `RawProviderRecord`, `PricePoint`, `CoverageReport`, `PortfolioSnapshot`, and wallet-scoped freshness metadata; analyzed-view persistence remains deferred follow-up scope.
5. **DS and i18n reuse boundary**: reuse existing shell, top-nav, metric-card, range-selector, analysis CTA, status badge, empty/loading/error, and chart wrappers; add only Overview-specific presentational panels and copy resources.

Output is captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design outputs in this phase:

1. **Data model** for Overview request/response blocks, source-selection state, and persistence touchpoints in [data-model.md](./data-model.md).
2. **Contracts** for the Overview HTTP API, analysis status/start payloads, and source-selection rules in [contracts](./contracts).
3. **Quickstart** for milestone execution, local validation, and implementation sequencing in [quickstart.md](./quickstart.md).
4. **Agent context update** in `.github/copilot-instructions.md` to point planning-aware agents at this feature’s plan.

Post-design constitution re-check:

- Brand consistency gate: **PASS**
- Localization gate: **PASS**
- Chain-awareness gate: **PASS**
- Provider/API gate: **PASS**
- Explainability gate: **PASS**

## Phase 2: Implementation Planning Approach

Execution sequence for `/speckit.tasks`:

1. **Connected route and shell wiring**
  - Add `/overview` route and redirect/entry behavior from the landing connect flow.
  - Build connected navigation and lock states using existing DS layout primitives.
2. **Overview server module and API contract**
  - Implement `src/server/overview/getRecentOverview.ts` now and leave `getAnalyzedOverview.ts` as deferred follow-up scope.
  - Replace the `/api/wallet/overview` scaffold with wallet-scoped, range-scoped, chain-scoped logic.
  - Return page-level coverage plus block-level provenance metadata for summary, metrics, chart, distribution, assets, and activity blocks.
3. **Recent-view provider aggregation**
  - Fetch Moralis balances/history and optional DeFi hints.
  - Fetch current and recent pricing from Alchemy.
  - Map provider data into Overview response blocks without exposing provider payloads to the frontend.
4. **Analysis status and freshness read-model flow**
  - Normalize the Trigger.dev-backed analysis start/status payloads used by Overview.
  - Surface `stale` as an honest read-model state when existing wallet freshness metadata indicates an older prior analysis, without adding automatic stale refresh in this stage.
  - Keep deeper historical reconstruction and analyzed Overview rendering deferred to the next stage.
5. **Persistence and freshness flow**
  - Persist `RawProviderRecord`, `PricePoint`, `CoverageReport`, and `PortfolioSnapshot` for recent view.
  - Persist or update wallet-scoped freshness metadata needed for recent-view status messaging and manual refresh decisions.
6. **Analysis status and stale normalization**
  - Normalize status enum to `not_analyzed | queued | running | ready | stale | failed` at the API/UI boundary.
  - Extend status read-model behavior to derive `stale` from wallet freshness metadata when prior analysis metadata exists, without automatic refresh in this stage.
7. **Frontend Overview feature module**
  - Implement `src/features/overview/*` container/component/types/mappers/queries.
  - Reuse current `queries/hooks.ts` patterns and migrate Overview into the feature module without frontend provider calls.
8. **Localization and formatting completion**
  - Fill `overview`, `navigation`, `analysis`, `coverage`, `charts`, and touched shared namespaces in EN/ES.
  - Apply centralized formatting helpers for all values.
9. **Validation and hardening**
  - Validate disconnected, wrong-chain, no-activity, missing-price, partial-coverage, stale, failed, and manual-refresh states.
  - Run lint, typecheck, build, i18n parity, and provider smoke checks.

Delivery boundaries:

- Included: connected Overview route, server-side Moralis/Alchemy connectors for Overview, persistence writes for recent view, canonical analysis start/status normalization, honest stale-state read-model messaging, manual refresh for current recent data, EN/ES copy, and DS-based page composition.
- Excluded: analyzed-history rendering, automatic transition into analyzed widgets, stale auto-refresh, historical protocol reconstruction for analyzed Overview, standalone Pools/Deposits/Strategies/Governance detail-page delivery, and frontend direct third-party provider access.

## Complexity Tracking

No constitution violations requiring exception tracking.
