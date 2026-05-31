# Implementation Plan: Activity DataView

**Branch**: `014-activity-dataview` | **Date**: 2026-05-30 | **Spec**: [specs/014-activity-dataview/spec.md](spec.md)
**Input**: Feature specification from `/specs/014-activity-dataview/spec.md`

## Summary

Activity becomes the next post-analysis connected destination: a dense DataView workspace for inspecting the transaction-level interpreted ledger behind Overview, Pools, Deposits, Strategies, Rewards, and future Governance. It adds `/activity` and a DB-backed `/api/activity` route that serves summary instrumentation, filterable ledger rows, selected transaction detail, token movement evidence, coverage/confidence state, entity links, exclusion reasons, and rebalance/source-allocation explanations.

The technical approach extends the existing analysis activity phase and normalized persistence into an Activity read layer. Request-time Activity APIs remain DB-only. Moralis decoded history, wallet transfer data, existing raw provider records, supplemental chain explorer indexed evidence, Alchemy Prices, protocol metadata, and RPC/log/contract evidence all stay inside the Trigger.dev/background analysis boundary. Activity consumes persisted `ledger_events`, `asset_movements`, `raw_provider_records`, prices, residual attribution state, reward/governance/strategy/deposit links, and compact read-model projections. If evidence is incomplete, rows remain partial, unresolved, unsupported, malicious, ambiguous, discarded, or unavailable rather than being heuristically assigned.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 16 App Router, React 19, TanStack Query, TanStack Table through the internal `DataTable`, Tamagui-based internal design system (`@/design-system`), Drizzle ORM, PostgreSQL, Trigger.dev v4, i18next + react-i18next, wagmi/WalletConnect via `useCabWallet`, Recharts for DS chart primitives where needed  
**Storage**: PostgreSQL via Drizzle; existing normalized analysis tables (`ledger_events`, `asset_movements`, `raw_provider_records`, `processed_txs`, `price_points`, deposits, strategies, rewards, governance, pools, residual attribution state) plus Activity-focused read-model tables or indexes if query profiling requires them  
**Testing**: Node test runner with `tsx` and experimental module mocks for unit/service/route/mapper/materializer coverage; deterministic activity classification and explorer-evidence regression scripts; manual auth-gated UI signoff for DataView behavior; existing typecheck/unit/i18n/design-system checks. Playwright and browser E2E suites are excluded by constitution v1.1.0.  
**Target Platform**: Browser clients on the existing Next.js web app; server route handlers backed by Postgres; Base mainnet (chainId 8453) for product v1  
**Project Type**: Web application monorepo with implementation under `apps/web/`  
**Performance Goals**: `GET /api/activity` p95 <= 300ms from DB only for a wallet with up to 5,000 activity rows; p95 <= 700ms for 25,000-row stress fixtures; zero provider/RPC/explorer calls in request flow; desktop first screen shows KPI strip, filters, ledger table, and selected detail without a full-page reload during filters, pagination, or row selection  
**Constraints**: Analysis-gated until `ready` unless limited recent mode is explicitly enabled; stale `ready` data may remain visible during background refresh; request paths read only normalized/read-model persistence; activity, wallet, transaction, entity, API, query-key, and regression identities carry `chainId`; no hardcoded user-facing copy; all values expose coverage/confidence; supplemental explorer evidence can improve classification but cannot invent ownership; no transaction execution features  
**Scale/Scope**: One connected wallet per request; one routed screen; one internal read API; one feature module; one server read layer; one analysis/read-model materialization extension; activity history target envelope up to 5,000 rows per wallet with 25,000-row stress validation; classification coverage includes supported, unsupported, malicious/spam, ambiguous, discarded, partial, unresolved, and unavailable states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. The feature is a premium control-tower DataView with dense metrics, technical dividers, ledger rows, selected-row evidence, confidence indicators, tabular numerics, and restrained cyan/gold/semantic accents. It avoids landing-page treatment, casino/trading CTA language, and generic admin-table styling.
- **Localization gate**: PASS. New `activity` namespace content plus updates to `coverage`, `confidence`, `common`, `navigation`, and `errors` are required in English and Spanish. All labels, filters, action types, protocol surfaces, detail sections, empty states, exclusion reasons, and coverage notes route through i18next resources and centralized formatters.
- **Chain-awareness gate**: PASS. Activity events, transactions, asset movements, entity links, explorer paths, API contracts, query keys, and regression identities are scoped by `chainId`. Product v1 remains Base mainnet, but no address-only or tx-hash-only identity is introduced.
- **Provider/API gate**: PASS. Activity routes are DB-only. Moralis remains wallet-history and decoded-activity discovery, Alchemy Prices remains valuation, RPC/log/contract reads and supplemental explorer indexed evidence remain background evidence sources, and Trigger.dev owns long-running reconstruction. No request-path provider calls are planned.
- **Explainability gate**: PASS. The plan preserves raw-to-normalized traceability through ledger events, asset movements, raw provider records, price points, residual attribution, classification evidence, coverage/confidence, and linked product entities. Unknowns remain visible.
- **Testing boundary gate**: PASS. Automated validation uses unit, route, service, mapper, materializer, integration, and deterministic regression checks. Auth-gated UI validation is manual. Playwright, browser E2E, and automated browser/a11y suites are not dependencies or signoff gates.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/014-activity-dataview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── activity-api.md
│   ├── activity-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── activity/
│   │   │   └── page.tsx                         # NEW - Activity DataView route
│   │   └── api/
│   │       └── activity/
│   │           └── route.ts                      # NEW - DB-backed Activity API
│   ├── features/
│   │   ├── activity/                             # NEW feature module
│   │   │   ├── Activity.container.tsx
│   │   │   ├── Activity.component.tsx
│   │   │   ├── ActivityWorkspace.module.css
│   │   │   ├── activity.filters.ts
│   │   │   ├── activity.mappers.ts
│   │   │   ├── activity.navigation.ts
│   │   │   ├── activity.queries.ts
│   │   │   ├── activity.types.ts
│   │   │   ├── activity.urlState.ts
│   │   │   ├── activity.validation.ts
│   │   │   └── components/
│   │   │       ├── ActivityKpiStrip.tsx
│   │   │       ├── ActivityFiltersBar.tsx
│   │   │       ├── ActivityEventsTable.tsx
│   │   │       ├── SelectedActivityRail.tsx
│   │   │       ├── ActivityMovementList.tsx
│   │   │       ├── ActivityLinkedEntities.tsx
│   │   │       ├── ActivityClassificationEvidence.tsx
│   │   │       ├── ActivityRebalanceExplanation.tsx
│   │   │       ├── ActivityCoverageNotes.tsx
│   │   │       └── ActivityEmptyState.tsx
│   │   ├── overview/                             # UPDATE - deep link preview rows to Activity
│   │   ├── pools/                                # UPDATE - link metric evidence to Activity
│   │   ├── deposits/                             # UPDATE - link lifecycle/movement evidence to Activity
│   │   ├── strategies/                           # UPDATE - link strategy activity evidence to Activity
│   │   └── rewards/                              # UPDATE - link reward evidence to Activity
│   ├── queries/
│   │   ├── hooks.ts                              # UPDATE - enable typed activity query if needed
│   │   └── keys.ts                               # UPDATE - wallet/chain/filter-aware activity key
│   ├── server/
│   │   ├── activity/                             # NEW server read layer
│   │   │   ├── activity.contract.ts
│   │   │   ├── activity.repository.ts
│   │   │   ├── activity.route.ts
│   │   │   ├── activity.service.ts
│   │   │   └── activity.types.ts
│   │   ├── analysis/
│   │   │   ├── activity-read-models.ts           # NEW - materialize Activity summaries/detail rows
│   │   │   ├── txClassification.ts               # UPDATE - explorer evidence classification inputs
│   │   │   ├── enginePersistence.ts              # UPDATE - persist Activity evidence metadata
│   │   │   ├── canonicalInference.ts             # UPDATE - expose rebalance/source allocation evidence
│   │   │   └── rewardResolution.ts               # ASSERT - spam/airdrop stays excluded
│   │   ├── providers/
│   │   │   └── explorer/                         # NEW optional evidence provider wrapper
│   │   │       ├── client.ts
│   │   │       └── index.ts
│   │   ├── db/
│   │   │   ├── schema.ts                         # UPDATE only if read model/index changes are needed
│   │   │   └── migrations/                       # NEW only for schema/index changes
│   │   └── scripts/
│   │       ├── rebuild-activity-read-models.ts   # NEW
│   │       └── analysis-activity-regression.ts   # NEW - deterministic classification/evidence checks
│   └── i18n/
│       └── locales/
│           ├── en/activity.json                  # NEW
│           ├── es/activity.json                  # NEW
│           ├── en/coverage.json                  # UPDATE
│           ├── es/coverage.json                  # UPDATE
│           ├── en/confidence.json                # NEW/UPDATE if namespace exists
│           ├── es/confidence.json                # NEW/UPDATE if namespace exists
│           ├── en/navigation.json                # UPDATE
│           ├── es/navigation.json                # UPDATE
│           ├── en/errors.json                    # UPDATE
│           └── es/errors.json                    # UPDATE
├── src/server/activity/
│   ├── activity.repository.test.ts               # NEW
│   ├── activity.route.test.ts                    # NEW
│   └── activity.service.test.ts                  # NEW
├── src/server/analysis/
│   ├── activity-read-models.test.ts              # NEW
│   ├── txClassification.test.ts                  # UPDATE
│   ├── canonicalInference.test.ts                # UPDATE rebalance/source allocation cases
│   └── rewardResolution.test.ts                  # UPDATE phishing airdrop exclusion regression
└── src/features/activity/
    ├── activity.mappers.test.ts                  # NEW
    ├── activity.navigation.test.ts               # NEW
    ├── activity.urlState.test.ts                 # NEW
    └── activity.validation.test.ts               # NEW
```

**Structure Decision**: Keep work inside `apps/web`, following the existing Pools, Deposits, Strategies, and Rewards pattern: analysis materialization -> read-model persistence -> server repository/service/route -> typed query hook -> feature container/component. Explorer evidence is centralized as a provider wrapper used only by background analysis, never by request-time Activity routes.

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves Activity DataView architecture, read-model strategy, supplemental explorer evidence boundaries, classification taxonomy, source allocation and rebalance explainability, URL/filter state, selected detail semantics, i18n namespace impact, and deterministic regression validation.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/activity-api.md](contracts/activity-api.md), [contracts/activity-ui.md](contracts/activity-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), and [quickstart.md](quickstart.md).

Post-design Constitution re-check: PASS. The Activity DataView contract is explicit; localization namespaces are enumerated; activity identities, transaction references, entity links, explorer paths, API contracts, and query keys are chain-aware; `/api/activity` remains DB-only; explorer evidence is background-only; coverage/confidence and source evidence preserve explainability and no-heuristics constraints.

## Complexity Tracking

No constitutional violations to justify.

## Readiness Report

- **Branch**: `014-activity-dataview`
- **Plan path**: [specs/014-activity-dataview/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/014-activity-dataview/research.md](research.md)
  - [specs/014-activity-dataview/data-model.md](data-model.md)
  - [specs/014-activity-dataview/contracts/activity-api.md](contracts/activity-api.md)
  - [specs/014-activity-dataview/contracts/activity-ui.md](contracts/activity-ui.md)
  - [specs/014-activity-dataview/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/014-activity-dataview/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design
- **Outstanding `NEEDS CLARIFICATION`**: 0
- **Ready for**: `/speckit.tasks`
