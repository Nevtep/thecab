# Implementation Plan: Strategies Lifecycle

**Branch**: `012-strategies-lifecycle` | **Date**: 2026-05-29 | **Spec**: [specs/012-strategies-lifecycle/spec.md](spec.md)
**Input**: Feature specification from `/specs/012-strategies-lifecycle/spec.md`

## Summary

Strategies becomes the next post-analysis connected destination: a dense DataView analysis workspace for Mellow automated Aerodrome exposure. It activates the route currently represented by disabled strategy hooks and Deposits cross-link placeholders, adds `/strategies` and `/strategies/[strategyId]`, and serves a KPI strip, filterable master list, selected-strategy analysis panel, lifecycle timeline, rewards summary, and coverage note from DB-backed internal APIs only.

The technical approach extends the existing analysis finalization layer with wallet-scoped strategy read models derived from normalized analysis tables (`strategies`, `strategy_exposures`, `ledger_events`, `asset_movements`, `reward_events`, `price_points`, pool and deposit read models). Strategy rewards stay resolved through `strategy_exposure_id`, manual deposit rewards stay resolved through deposit identity, and pool totals are regression-checked as the sum of resolved deposit rewards plus resolved strategy rewards. The UI composes the existing connected shell, DataTable, KPI, chart, badge, coverage, and domain primitives so the mockup's control-tower look and feel lands without freezing exact column layout.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 16 App Router, React 19, TanStack Query, Tamagui-based internal design system (`@/design-system`), Drizzle ORM, PostgreSQL, Trigger.dev v4, i18next + react-i18next, wagmi/WalletConnect via `useCabWallet`, Recharts for DS chart primitives  
**Storage**: PostgreSQL via Drizzle; existing normalized analysis tables plus three new wallet-scoped strategy read models  
**Testing**: Node test runner with `tsx` and experimental module mocks for unit/service/route/materializer coverage; deterministic regression scripts for DB/reward ownership invariants; manual auth-gated UI signoff for DataView behavior; existing lint/typecheck/i18n/design-system checks. Playwright and browser E2E suites are excluded by constitution v1.1.0.
**Target Platform**: Browser clients on the existing Next.js web app; server route handlers backed by Postgres; Base mainnet (chainId 8453) for product v1  
**Project Type**: Web application monorepo with implementation under `apps/web/`  
**Performance Goals**: `GET /api/strategies` p95 <= 200ms from DB only; `GET /api/strategies/:strategyId` p95 <= 300ms from DB only; zero provider/RPC calls in request flow; desktop first screen shows KPI strip, at least five rows when available, and selected analysis panel without initial vertical scroll  
**Constraints**: Analysis-gated until `ready`; stale `ready` data may remain visible during background refresh; request paths read only normalized/read-model persistence; all identities, APIs, and query keys carry `chainId`; no hardcoded user-facing copy; DataView must preserve master-detail behavior on narrow screens; coverage note required for non-full coverage; strategy rewards cannot inflate manual deposit rewards; pool rewards must aggregate resolved manual and strategy rewards without double counting  
**Scale/Scope**: One connected wallet per request; up to fifty strategy exposures per wallet target envelope; two routed screens; two internal read APIs; one feature module; one server read layer; one analysis materialization extension; regression path for DB rows vs source blockchain transactions after analysis

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. The plan implements the mockup as a premium control-tower DataView with dense metrics, technical dividers, selected-row focus, coverage instrumentation, and restrained cyan/gold/semantic accents. It avoids a landing page, generic admin table, retail-trading language, and decorative chart clutter.
- **Localization gate**: PASS. New `strategies` namespace content plus updates to `coverage`, `charts`, `common`, `navigation`, and `errors` are required in English and Spanish. All filters, status badges, KPI labels, lifecycle labels, coverage notes, tooltips, and error states route through i18n resources and centralized formatters.
- **Chain-awareness gate**: PASS. Strategy, strategy exposure, rewards, pools, API contracts, query keys, regression scripts, and read-model indexes are scoped by `chainId`. Product v1 remains Base mainnet, but no address-only identity is introduced.
- **Provider/API gate**: PASS. Strategies routes are DB-only. Moralis remains wallet-history discovery evidence, Alchemy Prices remains valuation, and RPC/log/contract reads remain wrapper/staking/share evidence inside the Trigger.dev analysis flow.
- **Explainability gate**: PASS. The feature preserves manual Deposits, automated Strategies, and Pools as separate analytical units. Coverage states and reason codes explain share-level, partial, unknown, and unavailable values. Regression artifacts require DB rows to trace back to blockchain transactions and normalized source rows.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/012-strategies-lifecycle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── strategies-api.md
│   ├── strategies-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── strategies/
│   │   │   ├── page.tsx                         # NEW - Strategies DataView route
│   │   │   └── [strategyId]/page.tsx             # NEW - direct/mobile strategy detail
│   │   └── api/
│   │       └── strategies/
│   │           ├── route.ts                      # NEW - DB-backed strategies list API
│   │           └── [strategyId]/route.ts         # NEW - DB-backed strategy detail API
│   ├── features/
│   │   ├── strategies/                           # NEW feature module
│   │   │   ├── Strategies.container.tsx
│   │   │   ├── Strategies.component.tsx
│   │   │   ├── StrategyDetail.container.tsx
│   │   │   ├── StrategyDetail.component.tsx
│   │   │   ├── StrategiesWorkspace.module.css
│   │   │   ├── strategies.mappers.ts
│   │   │   ├── strategies.navigation.ts
│   │   │   ├── strategies.queries.ts
│   │   │   ├── strategies.types.ts
│   │   │   ├── strategies.urlState.ts
│   │   │   ├── strategies.validation.ts
│   │   │   └── components/
│   │   │       ├── StrategiesKpiStrip.tsx
│   │   │       ├── StrategiesFiltersBar.tsx
│   │   │       ├── StrategiesTable.tsx
│   │   │       ├── StrategyIdentityCell.tsx
│   │   │       ├── StrategySelectedPanel.tsx
│   │   │       ├── StrategyExposureSummary.tsx
│   │   │       ├── StrategyRewardsTable.tsx
│   │   │       ├── StrategyLifecycleTimeline.tsx
│   │   │       ├── StrategyCoverageNote.tsx
│   │   │       └── StrategiesEmptyState.tsx
│   │   ├── deposits/
│   │   │   └── deposits.navigation.ts            # UPDATE - enable Strategies links
│   │   └── pools/
│   │       └── components/                       # UPDATE - link pool automated exposure to Strategies
│   ├── queries/
│   │   ├── hooks.ts                              # UPDATE - enable typed strategy queries
│   │   └── keys.ts                               # UPDATE - filter-aware strategy keys
│   ├── server/
│   │   ├── analysis/
│   │   │   ├── strategy-read-models.ts           # NEW - materialize strategy summaries/history/lifecycle
│   │   │   ├── pool-read-models.ts               # UPDATE - pool totals include resolved strategy rewards
│   │   │   ├── deposit-read-models.ts            # UPDATE/ASSERT - deposit totals exclude strategy rewards
│   │   │   └── enginePersistence.ts              # UPDATE - persist strategy read models per run
│   │   ├── db/
│   │   │   ├── schema.ts                         # UPDATE - strategy read-model tables
│   │   │   └── migrations/                       # NEW migration
│   │   ├── scripts/
│   │   │   ├── rebuild-strategy-read-models.ts   # NEW
│   │   │   ├── analysis-strategy-regression.ts   # NEW - DB rows vs tx source checks
│   │   │   └── db-purge.ts                       # UPDATE - FK-safe purge
│   │   └── strategies/                           # NEW server read layer
│   │       ├── strategies.contract.ts
│   │       ├── strategies.repository.ts
│   │       ├── strategies.route.ts
│   │       ├── strategies.service.ts
│   │       └── strategies.types.ts
│   └── i18n/
│       └── locales/
│           ├── en/strategies.json                # UPDATE from placeholder
│           ├── es/strategies.json                # UPDATE from placeholder
│           ├── en/coverage.json                  # UPDATE
│           ├── es/coverage.json                  # UPDATE
│           ├── en/charts.json                    # UPDATE
│           ├── es/charts.json                    # UPDATE
│           ├── en/navigation.json                # UPDATE
│           ├── es/navigation.json                # UPDATE
│           ├── en/errors.json                    # UPDATE
│           └── es/errors.json                    # UPDATE
├── src/server/analysis/
│   ├── strategy-read-models.test.ts              # NEW
│   ├── pool-read-models.test.ts                  # UPDATE reward aggregation regression
│   ├── deposit-read-models.test.ts               # UPDATE exclusion regression
│   └── rewardResolution.test.ts                  # UPDATE strategy ownership cases
├── src/server/strategies/
│   ├── strategies.repository.test.ts             # NEW
│   ├── strategies.route.test.ts                  # NEW
│   └── strategies.service.test.ts                # NEW
├── src/features/strategies/
│   ├── strategies.mappers.test.ts                # NEW
│   ├── strategies.navigation.test.ts             # NEW
│   ├── strategies.urlState.test.ts               # NEW
│   └── strategies.validation.test.ts             # NEW
```

**Structure Decision**: Keep work inside `apps/web`, following the existing Pools and Deposits pattern: analysis materializer -> read-model tables -> server repository/service/route -> query hooks -> feature container/component. No new packages or separate app are introduced.

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves DataView architecture, read-model boundaries, strategy reward ownership, pool/deposit reward reconciliation, navigation behavior from Deposits/Pools, coverage-note semantics, responsive master-detail behavior, and the regression validation approach.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/strategies-api.md](contracts/strategies-api.md), [contracts/strategies-ui.md](contracts/strategies-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), and [quickstart.md](quickstart.md).

Post-design Constitution re-check: PASS. Brand-specific DataView behavior is explicit; localization namespaces are enumerated; chain-aware identities and query keys are documented; routes remain DB-only; strategy coverage, reward ownership, and regression traceability are modeled through read models and validation steps.

## Complexity Tracking

No constitutional violations to justify.

## Readiness Report

- **Branch**: `012-strategies-lifecycle`
- **Plan path**: [specs/012-strategies-lifecycle/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/012-strategies-lifecycle/research.md](research.md)
  - [specs/012-strategies-lifecycle/data-model.md](data-model.md)
  - [specs/012-strategies-lifecycle/contracts/strategies-api.md](contracts/strategies-api.md)
  - [specs/012-strategies-lifecycle/contracts/strategies-ui.md](contracts/strategies-ui.md)
  - [specs/012-strategies-lifecycle/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/012-strategies-lifecycle/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design
- **Outstanding `NEEDS CLARIFICATION`**: 0
- **Ready for**: `/speckit.tasks`
