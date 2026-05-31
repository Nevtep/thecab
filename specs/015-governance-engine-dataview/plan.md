# Implementation Plan: Governance Engine Processing And Metrics DataView

**Branch**: `015-governance-engine-dataview` | **Date**: 2026-05-31 | **Spec**: [specs/015-governance-engine-dataview/spec.md](spec.md)
**Input**: Feature specification from `/specs/015-governance-engine-dataview/spec.md`

## Summary

Governance becomes the next connected, analysis-gated destination: a dense control-surface DataView for veAERO locks, lock lifecycle, votes by epoch, relays, governance rewards, estimated governance return, coverage/confidence, and selected evidence inspection. It closes the gap where Governance exists as a product promise but is not yet fully reconstructed, materialized, or surfaced.

The technical approach keeps request-time Governance APIs DB-only and moves classification into the historical analysis/materialization boundary. The engine will classify Aerodrome governance surfaces from explicit evidence across veAERO/voting escrow, voter, relay, bribe/fee/reward distributors, AERO movements, reward events, ledger events, asset movements, prices, raw provider records, and protocol log/contract evidence. Governance read models will serve the first-screen view model: KPI strip, persistent lock status, compact epoch timeline, governance rewards table, reward-type/value breakdown, and selected-detail rail. Unsupported, ambiguous, partial, excluded, and unresolved rows remain visible and do not inflate confident totals.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 16 App Router, React 19, TanStack Query, TanStack Table through the internal `DataTable`, Tamagui-based internal design system (`@/design-system`), Drizzle ORM, PostgreSQL, Trigger.dev v4, i18next + react-i18next, wagmi/WalletConnect via `useCabWallet`, Recharts through DS chart primitives where needed  
**Storage**: PostgreSQL via Drizzle; existing normalized analysis tables (`ledger_events`, `asset_movements`, `raw_provider_records`, `processed_txs`, `reward_events`, `price_points`, pools, strategies, deposits, protocol positions, `governance_events`) plus Governance read-model tables and indexes for first-screen summaries/details  
**Testing**: Node test runner with `tsx` and experimental module mocks for unit/service/route/mapper/materializer coverage; deterministic governance regression script for curated Base transactions; existing typecheck/unit/i18n/design-system checks; manual auth-gated UI signoff. Playwright, browser E2E, and automated browser/a11y suites are excluded by constitution v1.1.0.  
**Target Platform**: Browser clients on the existing Next.js web app; server route handlers backed by Postgres; Base mainnet (chainId 8453) for product v1  
**Project Type**: Web application monorepo with implementation under `apps/web/`  
**Performance Goals**: `GET /api/governance` p95 <= 300ms from DB only for a wallet with up to 1,000 governance events and 250 governance rewards; p95 <= 700ms for 5,000-event stress fixtures; zero provider/RPC/explorer calls in request flow; first desktop viewport shows mandatory Governance surfaces without a generic table-first layout  
**Constraints**: Analysis-gated until `ready`; stale `ready` data may remain visible during background refresh; request paths read only normalized/read-model persistence; every governance identity, route, query key, explorer link, product link, and regression fixture carries `chainId`; no hardcoded user-facing copy; no transaction execution; no pool/epoch association without explicit persisted or protocol-derived evidence; governance rewards reconcile with Rewards/Pools without double counting  
**Scale/Scope**: One connected wallet per request; Base-only product v1 expressed through chain config; one `/governance` DataView route; one DB-backed `/api/governance` route; one feature module; one server read layer; one analysis/read-model materialization extension; one deterministic regression script covering supported, partial, unresolved, unsupported, excluded/spam, and ambiguous governance cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. Governance is planned as a dashboard-first, dense, premium control surface with technical metrics, compact epoch cards, evidence rail, and restrained semantic accents. It explicitly avoids execution CTAs, raw explorer behavior, governance-news presentation, speculative APR language, and generic table-first layout.
- **Localization gate**: PASS. A `governance` namespace plus updates to `coverage`, `confidence`/shared status copy, `common`, `navigation`, and `errors` are required in English and Spanish. Labels, filters, enum values, row states, detail sections, reason codes, and empty states route through i18next and centralized formatters.
- **Chain-awareness gate**: PASS. Governance events, locks, votes, epochs, rewards, KPI summaries, evidence references, query keys, API contracts, links, and regression fixtures are chain-scoped. Product v1 remains Base mainnet without address-only or tx-hash-only identity.
- **Provider/API gate**: PASS. Governance routes are DB-only. Moralis remains wallet-history discovery, Alchemy Prices remains valuation, RPC/log/contract reads remain protocol evidence, explorer evidence remains supplemental background evidence, and Trigger.dev owns long-running reconstruction.
- **Explainability gate**: PASS. Raw-to-normalized traceability is preserved through raw provider records, ledger events, asset movements, reward rows, governance events, prices, evidence refs, coverage/confidence, and read-model rows. Unknowns remain visible.
- **Testing boundary gate**: PASS. Automated validation uses unit, route, service, mapper, materializer, integration, and deterministic regression checks. Auth-gated UI validation is manual. Browser automation is not a dependency or signoff gate.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/015-governance-engine-dataview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── governance-api.md
│   ├── governance-ui.md
│   └── i18n-namespaces.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── governance/
│   │   │   └── page.tsx                         # NEW - Governance DataView route
│   │   └── api/
│   │       └── governance/
│   │           └── route.ts                      # NEW - DB-backed Governance API
│   ├── features/
│   │   ├── governance/                           # NEW feature module
│   │   │   ├── Governance.container.tsx
│   │   │   ├── Governance.component.tsx
│   │   │   ├── GovernanceWorkspace.module.css
│   │   │   ├── governance.mappers.ts
│   │   │   ├── governance.navigation.ts
│   │   │   ├── governance.queries.ts
│   │   │   ├── governance.types.ts
│   │   │   ├── governance.urlState.ts
│   │   │   ├── governance.validation.ts
│   │   │   └── components/
│   │   │       ├── GovernanceKpiStrip.tsx
│   │   │       ├── GovernanceLockPanel.tsx
│   │   │       ├── GovernanceEpochTimeline.tsx
│   │   │       ├── GovernanceRewardsTable.tsx
│   │   │       ├── GovernanceRewardBreakdown.tsx
│   │   │       ├── SelectedGovernanceRail.tsx
│   │   │       ├── GovernanceCoverageNotes.tsx
│   │   │       ├── GovernanceFiltersBar.tsx
│   │   │       └── GovernanceEmptyState.tsx
│   │   ├── rewards/                              # UPDATE - link governance rewards to Governance
│   │   ├── pools/                                # UPDATE - link explicit pool-associated governance rewards
│   │   └── activity/                             # UPDATE - link governance rows/details
│   ├── queries/
│   │   ├── hooks.ts                              # UPDATE - enabled typed Governance query
│   │   └── keys.ts                               # UPDATE - wallet/chain/filter-aware Governance key
│   ├── server/
│   │   ├── governance/                           # NEW server read layer
│   │   │   ├── governance.contract.ts
│   │   │   ├── governance.repository.ts
│   │   │   ├── governance.route.ts
│   │   │   ├── governance.service.ts
│   │   │   └── governance.types.ts
│   │   ├── analysis/
│   │   │   ├── governance-classification.ts      # NEW - governance evidence/action classification
│   │   │   ├── governance-read-models.ts         # NEW - first-screen/read-detail materialization
│   │   │   ├── enginePersistence.ts              # UPDATE - persist governance events/read models
│   │   │   ├── txClassification.ts               # UPDATE - governance action/surface signals
│   │   │   └── rewardResolution.ts               # UPDATE/ASSERT - governance rewards stay separate
│   │   ├── db/
│   │   │   ├── schema.ts                         # UPDATE - governance read-model tables/indexes
│   │   │   └── migrations/                       # NEW migration
│   │   ├── trigger/tasks/
│   │   │   ├── phase-governance.task.ts          # NEW - background governance materialization
│   │   │   └── phase-rewards.task.ts             # UPDATE - governance reward links/reconciliation
│   │   └── scripts/
│   │       ├── rebuild-governance-read-models.ts # NEW
│   │       └── analysis-governance-regression.ts # NEW
│   └── i18n/
│       └── locales/
│           ├── en/governance.json                # UPDATE from placeholder
│           ├── es/governance.json                # UPDATE from placeholder
│           ├── en/coverage.json                  # UPDATE
│           ├── es/coverage.json                  # UPDATE
│           ├── en/navigation.json                # UPDATE
│           ├── es/navigation.json                # UPDATE
│           ├── en/errors.json                    # UPDATE
│           └── es/errors.json                    # UPDATE
├── src/server/governance/
│   ├── governance.repository.test.ts             # NEW
│   ├── governance.route.test.ts                  # NEW
│   └── governance.service.test.ts                # NEW
├── src/server/analysis/
│   ├── governance-classification.test.ts         # NEW
│   ├── governance-read-models.test.ts            # NEW
│   ├── enginePersistence.test.ts                 # UPDATE
│   └── rewardResolution.test.ts                  # UPDATE governance reward ownership
└── src/features/governance/
    ├── governance.mappers.test.ts                # NEW
    ├── governance.navigation.test.ts             # NEW
    ├── governance.urlState.test.ts               # NEW
    └── governance.validation.test.ts             # NEW
```

**Structure Decision**: Keep work inside `apps/web`, following the established DataView path: analysis classification/materialization -> read-model persistence -> server repository/service/route -> typed query hook -> feature container/component. Governance does not introduce a new package, new execution surface, new provider path, or raw explorer.

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves governance protocol surface detection, reward ownership/association, epoch grouping, lock lifecycle modeling, selected-detail evidence, first-screen read-model architecture, cross-surface links, double-counting prevention, coverage/confidence propagation, and regression validation.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/governance-api.md](contracts/governance-api.md), [contracts/governance-ui.md](contracts/governance-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), and [quickstart.md](quickstart.md).

Post-design Constitution re-check: PASS. The Governance view model is explicit and dashboard-first; localization namespaces are enumerated; governance identities, query keys, links, API contracts, read models, and regression fixtures are chain-aware; `/api/governance` remains DB-only; protocol/provider evidence stays in background analysis; coverage/confidence and evidence refs preserve explainability and no-heuristics constraints.

## Complexity Tracking

No constitutional violations to justify.

## Readiness Report

- **Branch**: `015-governance-engine-dataview`
- **Plan path**: [specs/015-governance-engine-dataview/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/015-governance-engine-dataview/research.md](research.md)
  - [specs/015-governance-engine-dataview/data-model.md](data-model.md)
  - [specs/015-governance-engine-dataview/contracts/governance-api.md](contracts/governance-api.md)
  - [specs/015-governance-engine-dataview/contracts/governance-ui.md](contracts/governance-ui.md)
  - [specs/015-governance-engine-dataview/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/015-governance-engine-dataview/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design
- **Outstanding `NEEDS CLARIFICATION`**: 0
- **Ready for**: `/speckit.tasks`
