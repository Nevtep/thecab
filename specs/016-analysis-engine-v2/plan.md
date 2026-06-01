# Implementation Plan: Analysis Engine V2

**Branch**: `016-analysis-engine` | **Date**: 2026-06-01 | **Spec**: [spec.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/spec.md)
**Input**: Feature specification from `/specs/016-analysis-engine-v2/spec.md`

## Summary

Replace the current screen-phase analysis model with a DB-first historical transaction processor. The engine collects Moralis decoded wallet history, persists canonical transactions/logs/internal transactions/movements, decodes inputs and logs through a persisted ABI registry, classifies every transaction chronologically, creates domain events, plans and executes enrichment, runs accounting, and materializes DB-only read models for Activity, Deposits, Strategies, Pools, Rewards, and Governance.

The implementation must follow `docs/plan-refactor-engine-procesador-transacciones.md` first, then `docs/plan-refactor-engine-enrichment-accounting.md`. The Trigger task graph becomes the product pipeline. Existing helpers under `apps/web/src/server/analysis/decoded-history` must be reused and promoted into production services with DB repositories. The research scripts are references for how those helpers are composed and may remain fixture/regression harnesses; they are not runtime engine steps.

## Technical Context

**Language/Version**: TypeScript 5 on Next.js 16 / Node 20-compatible runtime  
**Primary Dependencies**: Trigger.dev v4, Drizzle ORM, PostgreSQL, viem, Moralis Data API, Alchemy Prices/RPC, BaseScan/Etherscan v2, Sourcify fallback, i18next, TanStack Query  
**Storage**: PostgreSQL through existing Drizzle schema and migrations; optional Redis/cache only behind persisted DB-first records  
**Testing**: Node test runner with `tsx`, service/unit/materializer/Trigger task tests, deterministic fixture regression scripts; no Playwright/browser E2E as a feature gate  
**Target Platform**: Next.js web app backend plus Trigger.dev background tasks on Base mainnet (`chainId=8453`)  
**Project Type**: Web application backend analysis pipeline plus DataView read-model materializers  
**Performance Goals**: Provider calls deduplicated and cached by natural key; wallet history collection paginates safely; request-time DataView APIs remain DB-only; repeated runs reuse canonical immutable data and persisted enrichment results  
**Constraints**: No request-time provider/explorer/RPC calls; no invented ownership/pool/reward/epoch heuristics; all identities chain-scoped; historical accounting processes oldest to newest; unsupported/partial/unresolved rows remain inspectable with reason codes  
**Scale/Scope**: One connected wallet on Base for v1; historical DataView analysis only; Overview refactor and transaction execution are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: PASS. This is backend/read-model work; any user-facing copy remains existing DataView/i18n surface copy and must keep the control-tower analytical tone.
- Localization gate: PASS with implementation requirement. New coverage/reason/error labels must be represented as stable machine codes and mapped through existing i18n namespaces; no hardcoded UI copy in DataViews.
- Chain-awareness gate: PASS. Every canonical row, ABI, token, pool, deposit, strategy, reward, governance lock, price point, enrichment need, domain event, read model row, API contract, and Trigger payload includes or derives `chainId`.
- Provider/API gate: PASS. Moralis is collection/discovery; Alchemy is prices/RPC/log backfills during analysis; BaseScan/Etherscan/Sourcify are ABI sources during analysis; request-time DataView APIs read persisted outputs only.
- Explainability gate: PASS. The plan adds raw provider records, canonical evidence, ABI provenance, classification traces, enrichment needs, coverage/confidence/reason codes, domain events, and read-model evidence links.
- Testing boundary gate: PASS. Validation uses unit/service/materializer/Trigger tests plus deterministic Moralis decoded-history fixtures and DB assertions; no Playwright/browser E2E/a11y automation.

## Project Structure

### Documentation (this feature)

```text
specs/016-analysis-engine-v2/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engine-v2-trigger-tasks.md
│   ├── engine-v2-read-models.md
│   └── engine-v2-cli-commands.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/server/analysis/
│   ├── decoded-history/              # Existing helper module to reuse
│   ├── engine-v2/
│   │   ├── collection/
│   │   ├── canonicalization/
│   │   ├── abi-registry/
│   │   ├── classification/
│   │   ├── enrichment/
│   │   ├── accounting/
│   │   ├── materializers/
│   │   ├── repositories/
│   │   └── regression/
│   ├── activity-read-models.ts
│   ├── deposit-read-models.ts
│   ├── strategy-read-models.ts
│   ├── pool-read-models.ts
│   ├── rewardResolution.ts
│   └── governance-read-models.ts
├── src/server/trigger/tasks/
│   ├── analysis-run.task.ts           # Orchestrates V2 after cutover
│   └── engine-v2-*.task.ts            # New task graph
├── src/server/db/
│   ├── schema.ts
│   └── migrations/
├── src/server/scripts/
│   ├── db-purge.ts
│   ├── analysis-engine-v2-regression.ts
│   └── analysis-engine-v2-run.ts
└── package.json

scripts/research/
├── analyze-decoded-history.ts         # Usage reference + fixture/regression harness
├── fetch-protocol-abis.ts             # Usage reference for ABI helper composition
└── match-abi-selectors.mjs

docs/api-research/
├── moralis/
└── abis/
```

**Structure Decision**: Implement Engine V2 as server-side analysis modules under `apps/web/src/server/analysis/engine-v2`, using existing `decoded-history` helpers as the decoding/classification starting point. Trigger tasks under `apps/web/src/server/trigger/tasks` call these services. Existing DataView APIs keep their route/UI contracts but must read materialized DB outputs produced by Engine V2.

## Phase 0 Research

See [research.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/research.md).

Resolved decisions:

- Collection must call Moralis decoded address history first and persist raw + canonical data before analysis.
- Runtime ABI lookup must be DB-first, with explorer/Sourcify calls only from analysis/enrichment tasks.
- The transaction classifier must process oldest to newest and emit domain events, not screen-phase outputs.
- Multicall and batch semantics require `canonical_calls` and parent/child domain events.
- Missing evidence becomes deduplicated `enrichment_needs`; it is not filled by heuristics.
- Accounting runs after classification and required enrichment planning, preserving chronological inventory/lifecycle state.
- Read models are DB-only projections from domain events, accounting, and persisted enrichment.
- Clean-slate development reset is useful but must be guarded/local-only and never implicit in production.

## Phase 1 Design

See [data-model.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/data-model.md) and contracts:

- [engine-v2-trigger-tasks.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/contracts/engine-v2-trigger-tasks.md)
- [engine-v2-read-models.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/contracts/engine-v2-read-models.md)
- [engine-v2-cli-commands.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/contracts/engine-v2-cli-commands.md)

Design outputs define:

- Canonical transaction/log/internal transaction/movement/call tables.
- Contract ABI, selector/event, protocol registry, token metadata, price point, and enrichment queues.
- Domain event store, event links, accounting lots, residual inventory, governance locks, managed-lock links, claim items, and DataView read models.
- Trigger task DAG and idempotency keys.
- DB-only request contracts for Activity, Deposits, Strategies, Pools, Rewards, and Governance.
- Local/dev clean-slate and regression commands.

## Phase 1 Constitution Re-check

- Brand: PASS. No new UI composition; read models expose evidence/status for existing branded surfaces.
- Localization: PASS with task requirement to add reason-code/status translations only where UI exposes new codes.
- Chain-awareness: PASS. Data model and Trigger contracts are chain-scoped.
- Provider boundaries: PASS. Provider calls are isolated in collection/enrichment tasks; DataView request paths are explicitly DB-only.
- Explainability: PASS. Every output row must link to canonical evidence, domain event, enrichment/accounting source, and coverage/confidence.
- Testing boundary: PASS. Plan requires deterministic regression fixtures and unit/integration tests, not browser automation.

## Implementation Sequencing For `/speckit.tasks`

1. Schema/migration foundation: add canonical store, ABI registry, domain event store, enrichment queues, accounting tables, governance managed links, read-model support fields, indexes, and unique constraints.
2. Helper promotion: reuse `decoded-history` helpers behind production repositories for address normalization, Moralis page parsing, chronological sorting/deduping, ABI fetch/registry, selector indexing, input/log decode, and preliminary classification. Use `scripts/research/analyze-decoded-history.ts` and `scripts/research/fetch-protocol-abis.ts` only as reference examples for helper composition and fixture/regression harnesses.
3. Collection Trigger tasks: implement decoded history collection, raw page persistence, canonicalization, retry/idempotency, and collection finalization.
4. ABI/protocol registry tasks: implement DB-first ABI fetch, verified-source persistence, selector/event registry, contract-kind discovery, and selector regression coverage.
5. Canonical call/log/movement decoding: populate `canonical_calls`, direct calls, nested `multicall(bytes[])` child calls, batch/router target-specific child calls, logs, internal transactions, ERC20/ERC721/native movements.
6. Chronological classifier: implement protocol classifiers for failed tx, approvals, cash-in/out, swaps, manual deposits, Mellow strategies, governance locks/votes/pokes/managed deposits/claims/rebases, unsupported/excluded rows, and unresolved ABI gaps.
7. Edgecase fixes: implement lock-origin backfill, protocol known-address provenance, managed/relay helper snapshot persistence, claimBribes child items, claimFees in multicall or batch/router child calls, non-liquid rebase relock, distributor-to-pool mapping via `Voter.GaugeCreated`, and partial shells for missing origins.
8. Enrichment planner/workers: implement deduped needs for ABI, token metadata, historical/current prices, pool definitions, lock identity, distributor links, strategy state, LpSugar/current state, and log/tx backfills.
9. Accounting: implement chronological cash inventory, residual lots, deposit/strategy/pool/reward/governance accounting, historical valuation, current valuation separation, and no-double-count rules.
10. Read-model materializers: generate Activity, Deposits, Strategies, Pools, Rewards, and Governance from domain events/accounting only, then cut over each existing DataView repository/service to those DB outputs with no request-time provider calls, keeping Overview out of scope.
11. Trigger deploy and orchestration: update `analysis-run.task.ts`, add `engine-v2-*` tasks, configure `trigger.config.ts` task discovery if needed, and retain old phases only behind an explicit rollback/legacy mode until cutover.
12. Tooling: add guarded local/dev clean-slate DB reset flow, Engine V2 run command, fixture regression command, provider queue audit, and migration verification.
13. Validation/signoff: run typecheck, focused unit tests, regression fixtures from Moralis decoded-history captures, DB-only request-path checks, no-provider-at-request assertions, and manual UI smoke notes for existing DataViews.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
