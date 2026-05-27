# Implementation Plan: Analyzed Pools History

**Branch**: `009-pools-history` | **Date**: 2026-05-25 | **Spec**: [specs/009-pools-history/spec.md](spec.md)
**Input**: Feature specification from `/specs/009-pools-history/spec.md`

## Summary

The Pools feature becomes the first fully unlocked post-analysis destination in the connected shell. It adds routed screens at `/pools` and `/pools/[poolId]`, replaces the current post-analysis `comingSoon` placeholder for Pools with a real destination, and serves visually rich list and detail experiences from database-backed internal APIs only. The feature deliberately does not call Moralis, Alchemy, or Trigger.dev in request/response flow. Instead, the existing analysis engine is extended to materialize wallet-scoped pool read models from normalized protocol tables so the Pools UI can render up to one year of pool history, current and historical exposure segments, rewards, residual attribution, lifecycle and rebalance timelines, and coverage-aware metrics without recomputing heavy joins on every page load. Pools stays locked until analysis is `ready`; once unlocked, stale refreshes may continue serving the last successful analyzed data during background refreshes.

The key planning decision is to extend analysis output beyond the current `latestPoolTotals` pathway. Today `computeSnapshots()` writes `performance_snapshots(scope = 'pool')` and `pool_metrics_snapshots` using the same latest pool total for every day in the range, which is not sufficient for truthful historical pool charts. This plan therefore introduces dedicated wallet-scoped pool summary, history, and timeline read models written during analysis finalization and consumed by thin authenticated API routes.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 15 App Router, React 19, TanStack Query, Tamagui-based internal design system, Drizzle ORM, PostgreSQL, Trigger.dev v3, i18next + react-i18next  
**Storage**: PostgreSQL via Drizzle; existing normalized analysis tables plus new wallet-scoped pool read models  
**Testing**: Vitest for analysis materialization, pools repositories, routes, and mappers; Playwright for ready gating, stale retention after unlock, navigation unlock, and key Pools list/detail user flows; existing lint/typecheck/i18n parity gates  
**Target Platform**: Browser clients on the existing Next.js web app; serverless route handlers backed by Postgres; Base mainnet product-v1 chain only  
**Project Type**: Web application monorepo with primary implementation in `apps/web/`  
**Performance Goals**: `GET /api/pools` p95 <= 200ms from DB only; `GET /api/pools/:poolId` p95 <= 300ms for default range from DB only; no provider calls in Pools request flow; initial Pools shell renders with meaningful metrics and charts without synchronous background work  
**Constraints**: Pools remains analysis-gated until status is `ready`; after unlock it may stay available during `stale` refreshes using last-success data; all browser data access goes through typed internal APIs; routes must validate authenticated wallet + supported chain; query params must be bounded and whitelisted to avoid abusive scans; range selection capped at 365 days; no raw provider payloads exposed; visual density must remain legible on desktop and mobile  
**Scale/Scope**: One connected wallet at a time; up to one year of analyzed pool history; two routed screens (`/pools`, `/pools/[poolId]`); two internal read APIs; one new feature module; one analysis extension to materialize pool-specific read models

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. The plan uses The Cab's connected shell, dense KPI cards, chart frames, and control-surface styling rather than a generic CRUD screen. The provided visual reference is treated as hierarchy and density guidance only. No hype or execution-oriented language is introduced.
- **Localization gate**: PASS. The feature stays i18n-first using existing `pools`, `coverage`, `charts`, `common`, and `navigation` namespaces plus any additions needed for new screen states, legends, filters, timeline labels, and tooltips. No user-facing copy is planned inside route handlers or UI components.
- **Chain-awareness gate**: PASS. Pool identity, read models, query keys, and route validation remain scoped by `chainId`. Product v1 still accepts only Base mainnet, but read models and internal API contracts keep chain-aware identity.
- **Provider/API gate**: PASS. Browser code consumes only internal APIs. Pools request handlers read Postgres-backed read models and never call Moralis/Alchemy directly. Provider usage remains in the Trigger.dev analysis pipeline, where existing cache and in-flight coordination rules continue to apply.
- **Explainability gate**: PASS. Pool read models are derived from existing normalized entities (`Deposit`, `StrategyExposure`, `RewardEvent`, `LedgerEvent`, `AssetMovement`, `AttributionState`, `PerformanceSnapshot`) plus new pool projections. Coverage status, covered range, and partial attribution remain visible in both list and detail views.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/009-pools-history/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pools-api.md
│   ├── pools-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── pools/
│   │   │   ├── page.tsx                      # NEW — Pools list route
│   │   │   └── [poolId]/page.tsx             # NEW — Pool detail route
│   │   └── api/
│   │       └── pools/
│   │           ├── route.ts                  # NEW — DB-backed pools list API
│   │           └── [poolId]/route.ts         # NEW — DB-backed pool detail API
│   ├── features/
│   │   ├── overview/
│   │   │   └── overview.mappers.ts           # UPDATE — unlock Pools nav after analysis
│   │   ├── settings/
│   │   │   └── Settings.component.tsx        # UPDATE — shared nav reflects real Pools route
│   │   └── pools/                            # NEW feature module
│   │       ├── Pools.container.tsx
│   │       ├── Pools.component.tsx
│   │       ├── PoolDetail.container.tsx
│   │       ├── PoolDetail.component.tsx
│   │       ├── pools.mappers.ts
│   │       ├── pools.queries.ts
│   │       ├── pools.types.ts
│   │       └── components/
│   ├── queries/
│   │   ├── hooks.ts                          # UPDATE — enable Pools queries
│   │   └── keys.ts                           # UPDATE — list/detail filter keys if needed
│   ├── server/
│   │   ├── analysis/
│   │   │   ├── computeSnapshots.ts           # UPDATE — preserve generic pool snapshots without advertising `latestPoolTotals` as truthful Pools history
│   │   │   ├── pool-read-models.ts           # NEW — materialize wallet-scoped pool summaries/history/timeline
│   │   │   └── enginePersistence.ts          # UPDATE — persist pool read models per completed run
│   │   ├── db/
│   │   │   ├── schema.ts                     # UPDATE — new pool read-model tables
│   │   │   └── migrations/                   # NEW migration(s)
│   │   └── pools/                            # NEW server read layer
│   │       ├── pools.repository.ts
│   │       ├── pools.service.ts
│   │       ├── pools.route.ts
│   │       └── pools.types.ts
│   └── i18n/
│       ├── formatters.ts                     # UPDATE — centralized locale-aware formatting for Pools output
│       └── locales/
│           ├── en/pools.json                 # UPDATE
│           ├── en/charts.json                # UPDATE
│           ├── en/navigation.json            # UPDATE
│           ├── en/coverage.json              # UPDATE
│           ├── en/common.json                # UPDATE
│           ├── es/pools.json                 # UPDATE
│           ├── es/charts.json                # UPDATE
│           ├── es/navigation.json            # UPDATE
│           ├── es/coverage.json              # UPDATE
│           └── es/common.json                # UPDATE
├── src/server/analysis/
│   ├── computeSnapshots.test.ts              # UPDATE — guard pool snapshot semantics
│   └── enginePersistence.test.ts             # UPDATE — cover pool read-model writes
├── src/server/pools/
│   ├── pools.repository.test.ts              # NEW — list/detail query coverage
│   ├── pools.route.test.ts                   # NEW — route guard and contract coverage
│   └── pools.service.test.ts                 # NEW — response composition coverage
├── src/features/pools/
│   ├── pools.mappers.test.ts                 # NEW — view-model and formatting coverage
│   └── pools.validation.test.ts              # NEW — filter/range state coverage
└── e2e/
    └── pools-gated-and-history.spec.ts       # NEW — gating + routed screen coverage
```

**Structure Decision**: Keep all work inside the existing `apps/web` application. Extend the background analysis pipeline to produce DB-backed pool read models, then add a first-class Pools feature module, routes, and thin internal APIs that read only from Postgres. This preserves the repo's existing container/component pattern, query-hook usage, and connected-shell architecture.

## Complexity Tracking

> No constitutional violations require justification. Section intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

## Phase 0 — Outline & Research

**Status**: COMPLETE. See [research.md](research.md).

Phase 0 resolved the main planning questions:

1. Whether Pools should read directly from provider-backed logic at request time: **No**. The route layer remains DB-only.
2. Whether current analysis output already supports truthful one-year Pools history: **No**. The engine must be extended to materialize wallet-scoped pool history and timeline read models.
3. How routing and gating should behave: Pools becomes the first unlocked deep route when analysis is `ready`, and direct pre-ready visits render a gated state rather than leaking partially implemented data. Once unlocked, stale refresh behavior can continue serving the last successful analyzed data.
4. How UI richness should be expressed safely: through explicit UI contracts and bounded data series, not through unbounded chart queries or provider-side fanout.

## Phase 1 — Design & Contracts

**Status**: COMPLETE. Artifacts generated by this command:

1. **`data-model.md`** — Defines three wallet-scoped pool read-model tables (`pool_wallet_summaries`, `pool_history_snapshots`, `pool_timeline_events`) plus the write rules that extend analysis finalization without changing browser/provider boundaries.
2. **`contracts/pools-api.md`** — Defines DB-backed `GET /api/pools` and `GET /api/pools/:poolId` contracts, authenticated wallet inference, bounded range/filter params, and anti-abuse rules.
3. **`contracts/pools-ui.md`** — Defines routing, gating, list/detail layout, visual-density expectations, responsive behavior, and the relationship between KPIs, charts, and coverage states.
4. **`contracts/i18n-namespaces.md`** — Defines namespace impact and the key categories needed for filters, tabs, cards, chart labels, legends, coverage explanations, and gated states.
5. **`quickstart.md`** — Documents how to prepare analysis data locally, rebuild pool read models, run the app, and validate the new routed Pools screens against DB-backed responses.
6. **Agent context** — `.github/copilot-instructions.md` updated between the `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers to point at `specs/009-pools-history/plan.md`.

## Phase 2 — Re-Evaluation Of Constitution Check (Post-Design)

After Phase 1 design, every constitutional gate still evaluates to **PASS**:

- **Brand**: The UI contract preserves the dense, premium control-surface presentation and explicitly avoids generic admin-table layouts.
- **Localization**: Every new Pools surface routes through existing i18n namespaces with en/es parity requirements.
- **Chain-awareness**: New read models and API contracts remain keyed by `chainId`; no address-only identities are introduced.
- **Provider/API discipline**: Pools routes read only from database projections and do not invoke provider clients in request flow.
- **Explainability**: Coverage state, covered window, partial attribution, and share-level strategy accounting remain explicit in the read models and response contracts.

## Readiness Report

- **Branch**: `009-pools-history`
- **Plan path**: [specs/009-pools-history/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/009-pools-history/research.md](research.md)
  - [specs/009-pools-history/data-model.md](data-model.md)
  - [specs/009-pools-history/contracts/pools-api.md](contracts/pools-api.md)
  - [specs/009-pools-history/contracts/pools-ui.md](contracts/pools-ui.md)
  - [specs/009-pools-history/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/009-pools-history/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design
- **Outstanding `NEEDS CLARIFICATION`**: 0
- **Ready for**: `/speckit.tasks`
