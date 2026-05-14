# Quickstart: Connected Wallet Overview

## Objective

Implement the first connected full-stack dashboard stage for The Cab using the existing DS, provider modules, and background-analysis skeleton. This quickstart is intentionally limited to recent Overview delivery plus analysis start/status scaffolding; analyzed-history rendering and stale auto-refresh are deferred.

## Prerequisites

- Workspace root: `/Users/core/Code/The Cab`
- App path: `apps/web`
- Branch: `003-connected-wallet-overview`
- Server-only environment configured in `apps/web/.env.local`:
  - `MORALIS_API_KEY`
  - `ALCHEMY_API_KEY`
  - `ALCHEMY_BASE_RPC_URL`
  - `DATABASE_URL`
  - Trigger.dev variables already used by analysis routes

## Milestone A: Route, Feature Module, And Contracts

1. Add `src/app/overview/page.tsx`.
2. Add `src/features/overview/` with container/component/queries/mappers/types.
3. Normalize the connected-entry flow so successful connect lands in `/overview`.
4. Replace the Overview API scaffold with the contract in `contracts/overview-api-contract.md`, including block-level provenance metadata for summary, metrics, chart, distribution, assets, and activity.
5. Normalize analysis status/start payloads against `contracts/analysis-status-contract.md`.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`

## Milestone B: Recent View Backend

1. Add `src/server/overview/getRecentOverview.ts` and supporting types/repository helpers.
2. Use existing Moralis connectors for balances/history and optional DeFi hints.
3. Use existing Alchemy pricing connector for current and recent pricing.
4. Persist `RawProviderRecord`, `PricePoint`, `CoverageReport`, and `PortfolioSnapshot`.
5. Keep provider calls server-side only.

Checkpoint commands:

- `cd apps/web && pnpm provider:smoke`
- `cd apps/web && pnpm typecheck`

## Milestone C: Analysis Status And Freshness Read-Model

1. Normalize analysis status/start payloads against `contracts/analysis-status-contract.md`.
2. Wire Overview status polling and analysis CTA flows without adding historical reconstruction.
3. Persist or read wallet-scoped freshness metadata needed for recent-view status messaging.
4. Surface `stale` as a read-model state when prior analysis freshness metadata exists, without implementing automatic stale refresh in this stage.
5. Keep analyzed-history rendering, automatic transition, and `getAnalyzedOverview.ts` explicitly deferred.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`

## Milestone D: Frontend Overview Screen

1. Reuse `ConnectedShell`, `CabSidebar`, `CabTopNav`, `CabDashboardGrid`, `CabMetricCard`, `CabRangeSelector`, `CabAnalysisCta`, `CabAnalysisStatusBadge`, and existing feedback/chart wrappers.
2. Implement wallet summary, metrics, chart, distribution, assets, recent activity, and analysis prompt panels.
3. Wire overview queries and analysis polling through typed query hooks only.
4. Implement disconnected, wrong-chain, no-activity, partial-coverage, stale, failed, and manual-refresh states.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`
- `cd apps/web && pnpm build`

## Milestone E: Localization And Final Validation

1. Complete EN/ES copy for Overview, Navigation, Analysis, Coverage, Charts, and touched shared namespaces.
2. Use `formatUsd`, `formatPercent`, `formatDateTime`, `formatRelativeTime`, and `formatTokenAmount` for all user-facing values.
3. Verify there are no browser-direct provider calls.
4. Validate recent-view labels, coverage messaging, and deferred analyzed-history boundaries.

Final verification commands:

- `cd apps/web && pnpm i18n:check`
- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`
- `cd apps/web && pnpm build`

## Non-Goals Reminder

- Do not rebuild landing.
- Do not implement Pools, Deposits, Strategies, Rewards, Governance, or Activity detail pages as a prerequisite.
- Do not add frontend third-party provider integrations.
- Do not implement analyzed-history rendering, automatic transition into analyzed widgets, or stale auto-refresh in this stage.
- Do not treat Moralis as the canonical pricing source.