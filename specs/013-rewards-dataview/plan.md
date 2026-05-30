# Implementation Plan: Rewards DataView

**Branch**: `013-rewards-dataview` | **Date**: 2026-05-30 | **Spec**: [specs/013-rewards-dataview/spec.md](spec.md)
**Input**: Feature specification from `/specs/013-rewards-dataview/spec.md`

## Summary

Rewards becomes the next post-analysis connected destination: a dense DataView workspace for inspecting claimed value across manual Deposits, automated Strategies, Governance, Pools, and tokens. It adds `/rewards` and a DB-backed `/api/rewards` route that serves the mockup-aligned KPI strip, filter bar, rewards-over-time panel, source/pool/token breakdowns, reward events table, selected reward rail, and unresolved/excluded activity context.

The technical approach builds a Rewards feature module and server read layer on top of normalized analysis persistence (`reward_events`, `ledger_events`, `asset_movements`, `price_points`, `deposits`, `strategies`, `strategy_exposures`, `pools`, coverage reports, and related read models). Existing reward resolution remains the ownership source of truth, but the feature hardens display contracts around owner status, pool contribution, claim-time valuation coverage, unresolved/excluded reason codes, and cross-surface reconciliation. Request-time Rewards APIs remain DB-only; provider/RPC/log/contract reads stay inside the Trigger.dev analysis pipeline and persisted evidence.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 16 App Router, React 19, TanStack Query, TanStack Table patterns where useful, Tamagui-based internal design system (`@/design-system`), Drizzle ORM, PostgreSQL, Trigger.dev v4, i18next + react-i18next, wagmi/WalletConnect via `useCabWallet`, Recharts for DS chart primitives  
**Storage**: PostgreSQL via Drizzle; existing normalized analysis tables (`reward_events`, `ledger_events`, `asset_movements`, `price_points`, `deposits`, `strategies`, `strategy_exposures`, `pools`, coverage reports) plus reward-focused indexes or compact read-model helpers if query profiling requires them  
**Testing**: Node test runner with `tsx` and experimental module mocks for unit/service/route/mapper/materializer coverage; deterministic reward reconciliation regression scripts; manual auth-gated UI signoff for DataView behavior; existing lint/typecheck/i18n/design-system checks. Playwright and browser E2E suites are excluded by constitution v1.1.0.  
**Target Platform**: Browser clients on the existing Next.js web app; server route handlers backed by Postgres; Base mainnet (chainId 8453) for product v1  
**Project Type**: Web application monorepo with implementation under `apps/web/`  
**Performance Goals**: `GET /api/rewards` p95 <= 250ms from DB only for a wallet with up to 2,000 reward rows; p95 <= 500ms for 10,000 reward rows in stress fixtures; zero provider/RPC calls in request flow; desktop first screen shows five KPI cards, filters, over-time panel, three breakdown panels, selected reward rail, and at least five table rows when available without initial vertical scroll  
**Constraints**: Analysis-gated until `ready`; stale `ready` data may remain visible during background refresh; request paths read only normalized/read-model persistence; reward, wallet, owner, pool, token, API, query-key, and regression identities carry `chainId`; no hardcoded user-facing copy; claim-time valuation is required for confident USD totals; non-full coverage must surface reasoned states; unresolved/excluded values must be visually and textually distinct from resolved rewards; no owner inference by pool plus time window  
**Scale/Scope**: One connected wallet per request; one routed screen; one internal read API; one feature module; one server read layer; one query-key/filter state surface; reward history target envelope up to 2,000 rows per wallet with 10,000-row stress validation; source categories limited to manual deposits, strategies, governance, unresolved, excluded, and unavailable

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. The plan implements the supplied mockup as a premium control-tower DataView with layered dark panels, compact instrumentation, technical dividers, selected-row focus, confidence indicators, tabular numerics, and restrained cyan/gold/semantic accents. It avoids a landing page, generic admin-table styling, retail-trading language, and decorative chart clutter.
- **Localization gate**: PASS. New Rewards copy and expanded `rewards`, `charts`, `coverage`, `common`, `navigation`, and `errors` namespace content are required in English and Spanish. All KPI labels, filters, table headers, chart legends, panel labels, coverage notes, reason codes, and empty/locked/error states route through i18n resources and centralized formatters.
- **Chain-awareness gate**: PASS. Reward, owner, pool, token, API, query-key, regression, and cross-surface link identities are scoped by `chainId`. Product v1 remains Base mainnet, but no address-only identity is introduced.
- **Provider/API gate**: PASS. Rewards routes are DB-only. Moralis remains wallet-history and transfer discovery evidence, Alchemy Prices remains claim-time valuation, and RPC/log/contract reads remain reward surface and ownership evidence inside Trigger.dev analysis. No provider substitution or request-path reconstruction is planned.
- **Explainability gate**: PASS. Manual deposit, strategy exposure, governance, pool contribution, unresolved, excluded, and unavailable states remain separate. Ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity preserve raw-to-normalized traceability.
- **Testing boundary gate**: PASS. Automated validation uses unit, mapper, service, route, materializer, integration, and deterministic regression tests. Auth-gated UI behavior is manually signed off through quickstart evidence. Playwright, browser E2E, and automated browser/a11y suites are not plan dependencies or signoff gates.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/013-rewards-dataview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rewards-api.md
│   ├── rewards-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── rewards/
│   │   │   └── page.tsx                         # NEW - Rewards DataView route
│   │   └── api/
│   │       └── rewards/
│   │           └── route.ts                      # NEW - DB-backed rewards API
│   ├── features/
│   │   ├── rewards/                              # NEW feature module
│   │   │   ├── Rewards.container.tsx
│   │   │   ├── Rewards.component.tsx
│   │   │   ├── RewardsWorkspace.module.css
│   │   │   ├── rewards.filters.ts
│   │   │   ├── rewards.mappers.ts
│   │   │   ├── rewards.navigation.ts
│   │   │   ├── rewards.queries.ts
│   │   │   ├── rewards.types.ts
│   │   │   ├── rewards.urlState.ts
│   │   │   ├── rewards.validation.ts
│   │   │   └── components/
│   │   │       ├── RewardsKpiStrip.tsx
│   │   │       ├── RewardsFiltersBar.tsx
│   │   │       ├── RewardsOverTimePanel.tsx
│   │   │       ├── RewardsSourceBreakdown.tsx
│   │   │       ├── RewardsPoolContributionBreakdown.tsx
│   │   │       ├── RewardsTokenBreakdown.tsx
│   │   │       ├── RewardsEventsTable.tsx
│   │   │       ├── SelectedRewardRail.tsx
│   │   │       ├── RewardOwnershipTrace.tsx
│   │   │       ├── RewardPoolContribution.tsx
│   │   │       ├── RewardClaimDetails.tsx
│   │   │       ├── RewardCoverageNotes.tsx
│   │   │       ├── UnresolvedExcludedActivity.tsx
│   │   │       └── RewardsEmptyState.tsx
│   │   ├── pools/
│   │   │   └── components/                       # UPDATE - link/filter into Rewards
│   │   ├── deposits/
│   │   │   └── components/                       # UPDATE - link/filter into Rewards
│   │   └── strategies/
│   │       └── components/                       # UPDATE - link/filter into Rewards
│   ├── queries/
│   │   ├── hooks.ts                              # UPDATE - enable typed, filter-aware rewards query
│   │   └── keys.ts                               # UPDATE - chain/wallet/filter-aware rewards key
│   ├── server/
│   │   ├── analysis/
│   │   │   ├── rewardResolution.ts               # UPDATE - expose UI-grade reason/basis semantics
│   │   │   ├── rewardResolution.test.ts          # UPDATE - no pool/time-window ownership regression
│   │   │   ├── pool-read-models.ts               # ASSERT/UPDATE - pool totals reconcile rewards
│   │   │   ├── deposit-read-models.ts            # ASSERT/UPDATE - deposit totals exclude strategy/governance
│   │   │   ├── strategy-read-models.ts           # ASSERT/UPDATE - strategy totals include strategy-owned only
│   │   │   └── enginePersistence.ts              # UPDATE if reward display metadata needs persistence
│   │   ├── db/
│   │   │   ├── schema.ts                         # UPDATE only if indexes/display fields are needed
│   │   │   └── migrations/                       # NEW only for schema/index changes
│   │   ├── rewards/                              # NEW server read layer
│   │   │   ├── rewards.contract.ts
│   │   │   ├── rewards.repository.ts
│   │   │   ├── rewards.route.ts
│   │   │   ├── rewards.service.ts
│   │   │   └── rewards.types.ts
│   │   └── scripts/
│   │       └── analysis-rewards-regression.ts    # NEW - reward ownership/pool-total invariant check
│   └── i18n/
│       └── locales/
│           ├── en/rewards.json                   # UPDATE from placeholder
│           ├── es/rewards.json                   # UPDATE from placeholder
│           ├── en/charts.json                    # UPDATE
│           ├── es/charts.json                    # UPDATE
│           ├── en/coverage.json                  # UPDATE
│           ├── es/coverage.json                  # UPDATE
│           ├── en/navigation.json                # UPDATE
│           ├── es/navigation.json                # UPDATE
│           ├── en/errors.json                    # UPDATE
│           └── es/errors.json                    # UPDATE
├── src/server/rewards/
│   ├── rewards.repository.test.ts                # NEW
│   ├── rewards.route.test.ts                     # NEW
│   └── rewards.service.test.ts                   # NEW
├── src/features/rewards/
│   ├── rewards.mappers.test.ts                   # NEW
│   ├── rewards.navigation.test.ts                # NEW
│   ├── rewards.urlState.test.ts                  # NEW
│   └── rewards.validation.test.ts                # NEW
└── src/server/analysis/
    ├── rewardResolution.test.ts                  # UPDATE
    ├── pool-read-models.test.ts                  # UPDATE reward reconciliation
    ├── deposit-read-models.test.ts               # UPDATE exclusion regression
    └── strategy-read-models.test.ts              # UPDATE strategy reward regression
```

**Structure Decision**: Keep work inside `apps/web`, following Pools, Deposits, and Strategies: normalized analysis persistence -> server repository/service/route -> typed query hook -> feature container/component. The API aggregates from persisted reward rows and related read models; it does not create a separate analytics service or new app.

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves Rewards DataView architecture, reward ownership and source taxonomy, request-time read boundaries, claim-time valuation coverage, pool contribution reconciliation, filter/URL-state behavior, selected reward rail semantics, responsive behavior, i18n namespace impact, and deterministic regression validation.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/rewards-api.md](contracts/rewards-api.md), [contracts/rewards-ui.md](contracts/rewards-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), and [quickstart.md](quickstart.md).

Post-design Constitution re-check: PASS. The mockup-specific DataView contract is explicit; localization namespaces are enumerated; reward, owner, pool, token, and query identities are chain-aware; `/api/rewards` remains DB-only; ownership trace, coverage notes, and regression checks preserve explainability and no-heuristics constraints.

## Complexity Tracking

No constitutional violations to justify.

## Readiness Report

- **Branch**: `013-rewards-dataview`
- **Plan path**: [specs/013-rewards-dataview/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/013-rewards-dataview/research.md](research.md)
  - [specs/013-rewards-dataview/data-model.md](data-model.md)
  - [specs/013-rewards-dataview/contracts/rewards-api.md](contracts/rewards-api.md)
  - [specs/013-rewards-dataview/contracts/rewards-ui.md](contracts/rewards-ui.md)
  - [specs/013-rewards-dataview/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/013-rewards-dataview/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design
- **Outstanding `NEEDS CLARIFICATION`**: 0
- **Ready for**: `/speckit.tasks`
