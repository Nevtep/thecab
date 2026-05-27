# Implementation Plan: Deposits Lifecycle

**Branch**: `010-deposits-lifecycle` | **Date**: 2026-05-27 | **Spec**: [specs/010-deposits-lifecycle/spec.md](spec.md)
**Input**: Feature specification from `/specs/010-deposits-lifecycle/spec.md`

## Summary

Deposits becomes the second fully unlocked post-analysis destination after Pools, scoped to manual Aerodrome positions only. It adds two routed screens (`/deposits` and `/deposits/[depositId]`) behind the analysis-ready gate already used by Pools, served exclusively by DB-backed internal APIs reading wallet-scoped read models materialized by the existing Trigger.dev analysis pipeline. The Deposits surface composes the existing The Cab design system primitives (`ConnectedShell`, `CabSidebar`, `CabSectionHeader`, `CabFilterBar`, `CabKpiStrip`, `CabMetricCard`, `CabImpactMetricCard`, `CabAreaChart`, `CabBarChart`, `DataTable`, `CabChartPanel`, `CabCoverageBadge`, `CabRewardTimeline`, `CabRebalanceMarker`, `CabPartialCoverageNotice`, `CabAccordion`, `CabBadge`, `CabTokenAmount`, `CabUsdValue`, `CabWalletAddress`, `CabTxHash`) around five feature-local compositions: a deterministic position-label cell, a lifecycle timeline panel, a per-event movement table, an event-anchored value chart, and a stacked horizontal performance-decomposition panel with an explicit `unattributed` bar. Navigation chrome is not modified.

The plan extends the analysis engine with three wallet-scoped deposit projections (`deposit_wallet_summaries`, `deposit_lifecycle_events`, `deposit_performance_decompositions`), reusing the existing canonical surfaces (`deposits`, `ledger_events`, `asset_movements`, `reward_events`, `inferred_actions`, `attribution_states`, `attribution_source_lots`, `protocol_contracts`, `pools`, `strategies`, `strategy_exposures`, `price_points`) as authoritative inputs. URL query state, exact reconciliation of the performance decomposition (FR-011a), transfer-in handling (FR-002a), CL range exposure (FR-021), and net-vs-gross capital presentation (FR-022) are wired through the materializer once, so the request path stays a thin read.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode
**Primary Dependencies**: Next.js 15 App Router (apps/web), React 19, TanStack Query, Tamagui-based internal design system (`@/design-system`), Drizzle ORM, PostgreSQL, Trigger.dev v3, i18next + react-i18next, wagmi/WalletConnect via `useCabWallet`
**Storage**: PostgreSQL via Drizzle; reuses existing analysis tables plus three new wallet-scoped deposit read models
**Testing**: Vitest for materializer, service/route, mappers, and validation; Playwright for analysis-gated routing, URL-derived state, list→detail navigation, and reconciliation rendering; existing lint/typecheck/i18n parity gates
**Target Platform**: Browser clients on the Next.js web app; serverless route handlers backed by Postgres; Base mainnet (chainId 8453) for product v1
**Project Type**: Web application monorepo with primary implementation in `apps/web/`
**Performance Goals**: `GET /api/deposits` p95 ≤ 200ms from DB only; `GET /api/deposits/:depositId` p95 ≤ 300ms from DB only; zero provider calls in request flow; SC-001 ten-second locate target met for ≤50 positions through URL-driven filters and indexed reads
**Constraints**: Analysis-gated until `ready` (FR-001); read-models only — no Moralis/Alchemy/RPC in request flow (CA-005); chain-scoped identity (FR-016/CA-004); per-deposit coverage visible inline; no duplicate top-of-page coverage banner (FR-023); URL-derived filter/sort/page/selection state (FR-024); 365-day max covered range; performance decomposition MUST reconcile exactly with `unattributed` residual (FR-011a); position labels deterministic and non-editable (FR-003a); no hardcoded user-facing copy (CA-002)
**Scale/Scope**: One connected wallet per request; up to fifty manual positions per wallet target envelope; two routed screens (`/deposits`, `/deposits/[depositId]`); two internal read APIs; one new feature module; one analysis materialization extension; three new read-model tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. Layout composes existing The Cab DS primitives in a control-tower density pattern (FR-L01–FR-L07). Cab Gold reserved for the primary `View in explorer` CTA. Signal Teal reserved for positive deltas, in-range, and `OPEN ACTIVE` status. Performance decomposition is rendered as instrumentation (stacked bars + explicit reconciliation row), not as a retail-trading chart.
- **Localization gate**: PASS. New `deposits` namespace under `apps/web/src/i18n/locales/{en,es}/deposits.json` plus extensions to `coverage`, `charts`, `common`, and `navigation`. Position labels (FR-003a) are deterministic identifiers, not translated copy; pool-kind tokens (`stable`/`volatile`/`<tickSpacing>`) are technical identifiers preserved in canonical form. Numbers, dates, percentages, and ranges go through `@/i18n/formatters`.
- **Chain-awareness gate**: PASS. Deposit identity stays `(chainId, contractAddress, tokenId)` for NFT-backed positions; read-model rows carry `chain_id`; TanStack query keys include `chainId`; API contracts require `chainId` query param and validate against `SUPPORTED_CHAINS`.
- **Provider/API gate**: PASS. Browser path reads only internal APIs; APIs read only the new and existing analysis-owned tables. Provider work (Moralis history pagination, Alchemy price hydration, RPC reads) remains in the Trigger.dev pipeline. Stable machine error codes mirror the Pools route (`wallet_not_authenticated`, `chain_unsupported`, `analysis_not_ready`, `deposit_not_found`, `invalid_request`, `internal_error`).
- **Explainability gate**: PASS. Every metric is derivable from `deposits`, `ledger_events`, `asset_movements`, `reward_events`, `inferred_actions`, `attribution_states`, and `price_points`. The `unattributed` residual is a first-class persisted column with a reason-code set; transfer-in positions carry `opened_by_transfer_in` and a degraded confidence; CL range data is sourced from `protocol_positions` outputs (`rangeLowerPrice`/`rangeUpperPrice`/`tickLower`/`tickUpper`/`isInRange`).

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/010-deposits-lifecycle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── deposits-api.md
│   ├── deposits-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── deposits/
│   │   │   ├── page.tsx                                # NEW — list route
│   │   │   └── [depositId]/page.tsx                    # NEW — detail route (mobile full-screen, desktop deep-link into pane)
│   │   └── api/
│   │       └── deposits/
│   │           ├── route.ts                            # NEW — DB-backed list API
│   │           └── [depositId]/route.ts                # NEW — DB-backed detail API
│   ├── features/
│   │   ├── overview/
│   │   │   └── overview.mappers.ts                     # UPDATE — unlock Deposits nav after analysis
│   │   ├── settings/
│   │   │   └── Settings.component.tsx                  # UPDATE — shared nav reflects real Deposits route (no other chrome change)
│   │   └── deposits/                                   # NEW feature module
│   │       ├── Deposits.container.tsx
│   │       ├── Deposits.component.tsx
│   │       ├── DepositDetail.container.tsx
│   │       ├── DepositDetail.component.tsx
│   │       ├── deposits.mappers.ts
│   │       ├── deposits.queries.ts
│   │       ├── deposits.types.ts
│   │       ├── deposits.urlState.ts                    # NEW — URL ↔ filter/sort/page/selection (FR-024)
│   │       └── components/
│   │           ├── DepositsKpiStrip.tsx                # composes CabKpiStrip + CabMetricCard
│   │           ├── DepositsFiltersBar.tsx              # composes CabFilterBar + CabRangeSelector
│   │           ├── DepositsTable.tsx                   # composes DataTable + PositionLabelCell
│   │           ├── PositionLabelCell.tsx               # NEW — deterministic FR-003a label cell
│   │           ├── DepositDetailHeader.tsx             # composes CabSectionHeader + CabBadge + CabCoverageBadge
│   │           ├── DepositLifecycleTimeline.tsx       # composes CabRewardTimeline + CabRebalanceMarker
│   │       │   ├── DepositEventMovementsTable.tsx     # NEW — per-event movement table (FR-010)
│   │       │   ├── DepositValueChart.tsx              # NEW — event-anchored value chart (FR-009)
│   │       │   ├── DepositPerformanceDecomposition.tsx # NEW — stacked bar w/ unattributed residual (FR-011a)
│   │       │   ├── DepositRangeIndicator.tsx           # NEW — CL price band + in/out-of-range (FR-021)
│   │       │   ├── DepositStrategiesCrossLink.tsx      # FR-012a placeholder/live link
│   │       │   ├── DepositCoveredRangeNote.tsx         # NEW — covered-range disclosure (FR-015)
│   │           └── DepositsEmptyState.tsx              # composes CabEmptyState
│   ├── queries/
│   │   ├── hooks.ts                                    # UPDATE — enable deposits queries
│   │   └── keys.ts                                     # UPDATE — list/detail filter keys
│   ├── server/
│   │   ├── analysis/
│   │   │   ├── deposit-read-models.ts                  # NEW — materialize deposit summaries/lifecycle/decomposition
│   │   │   ├── enginePersistence.ts                    # UPDATE — persist deposit read models per run
│   │   │   └── computeSnapshots.ts                     # UPDATE — share helpers (price hydration, reward USD backfill)
│   │   ├── db/
│   │   │   ├── schema.ts                               # UPDATE — three new read-model tables
│   │   │   └── migrations/                             # NEW migration
│   │   ├── scripts/
│   │   │   └── db-purge.ts                             # UPDATE — FK-safe purge for new tables
│   │   └── deposits/                                   # NEW server read layer
│   │       ├── deposits.repository.ts
│   │       ├── deposits.service.ts
│   │       ├── deposits.route.ts
│   │       └── deposits.types.ts
│   └── i18n/
│       ├── formatters.ts                               # UPDATE — signed PnL helpers if missing
│       └── locales/
│           ├── en/deposits.json                        # NEW
│           ├── en/charts.json                          # UPDATE — decomposition + range legend
│           ├── en/navigation.json                      # UPDATE — Deposits item
│           ├── en/coverage.json                        # UPDATE — `openedByTransferIn`, `unattributedResidual`
│           ├── en/common.json                          # UPDATE — shared chips
│           ├── es/deposits.json                        # NEW
│           ├── es/charts.json                          # UPDATE
│           ├── es/navigation.json                      # UPDATE
│           ├── es/coverage.json                        # UPDATE
│           └── es/common.json                          # UPDATE
├── src/server/analysis/
│   └── deposit-read-models.test.ts                     # NEW — materializer coverage
├── src/server/deposits/
│   ├── deposits.repository.test.ts                     # NEW
│   ├── deposits.route.test.ts                          # NEW
│   └── deposits.service.test.ts                        # NEW
├── src/features/deposits/
│   ├── deposits.mappers.test.ts                        # NEW
│   ├── deposits.urlState.test.ts                       # NEW
│   └── deposits.validation.test.ts                     # NEW
└── e2e/
    └── deposits-gated-and-lifecycle.spec.ts            # NEW
```

**Structure Decision**: Reuse the established Pools pattern — feature module in `apps/web/src/features/deposits/`, server read layer in `apps/web/src/server/deposits/`, DB-backed read models materialized inside the existing analysis run, and route handlers in `apps/web/src/app/api/deposits/`. No new packages, no DS package changes (all UI composes existing DS exports).

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves: request flow boundary (DB-only), reuse vs new tables, reconciliation strategy for FR-011a, transfer-in handling (FR-002a), label derivation (FR-003a), URL-derived state (FR-024), CL range exposure (FR-021), net-vs-gross capital (FR-022), and DS composition strategy.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/deposits-api.md](contracts/deposits-api.md), [contracts/deposits-ui.md](contracts/deposits-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), and [quickstart.md](quickstart.md).

Post-design Constitution re-check: PASS. Layered separation preserved (analysis materializer → read models → repository → service → route → query hook → container/component); explainability path documented end-to-end; i18n namespaces enumerated with en/es parity; chain-scoped identities and query keys preserved; brand-token usage codified per region.

## Complexity Tracking

No constitutional violations to justify.
