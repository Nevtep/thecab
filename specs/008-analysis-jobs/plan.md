# Implementation Plan: Analysis Engine (Background Jobs Pipeline)

**Branch**: `008-analysis-jobs` (target feature branch; planning and task generation are complete, and the current local working branch may still be `007-settings-screen` until implementation starts)  
**Date**: 2026-05-24  
**Spec**: [specs/008-analysis-jobs/spec.md](spec.md)  
**Input**: Feature specification from `specs/008-analysis-jobs/spec.md`; Phase 0 research already captured in [specs/008-analysis-jobs/research.md](research.md)

## Summary

The v1 Analysis Engine is a chain-aware, Trigger.dev v3 background pipeline that reconstructs a connected wallet's Aerodrome + Mellow portfolio history on Base mainnet (`chainId = 8453`) and writes the normalized domain data that Overview, Pools, Deposits, Strategies, Rewards, Activity, and Settings already consume. A run partitions the 365-day window into 90-day slices walking backward from `triggeredAtUtc` (research.md §R3), short-circuits already-processed days through a two-layer cache (`ProcessingCursor` + `ProcessedTx`, research.md §R5), executes the phase DAG `analysis.run → analysis.slice (phase.deposits → phase.rewards) → phase.activity → phase.pools → phase.finalize` (research.md §R6), and exposes `POST /api/analysis/start`, `GET /api/analysis/status`, `POST /api/analysis/cancel` mapped to the canonical analysis status vocabulary owned by [specs/007-settings-screen](../007-settings-screen/spec.md) R1. Postgres (Drizzle) is the sole source of truth; Trigger.dev `metadata.set()` is a UI hint only (research.md §R12). The plan delivers schema deltas (new `analysis_slices`, `processing_cursors`, `processed_txs`, `strategy_exposures`, `pool_metrics_snapshots` tables plus identity/coverage column additions to existing tables), three external API contracts, a Trigger.dev task topology contract, a provider client contract, an i18n namespace contract, and a developer quickstart. No new product-facing copy is introduced; every machine code resolves through the `analysis`, `coverage`, and `errors` i18next namespaces.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 15 (App Router) + React 19, Trigger.dev v3 SDK (`@trigger.dev/sdk`), Drizzle ORM + `postgres` driver, Moralis SDK (REST via internal client), Alchemy SDK + Alchemy Prices REST, viem/wagmi for ABI decoding and address utilities, zod for input validation, i18next + react-i18next, Tamagui (UI surfaces downstream)  
**Storage**: PostgreSQL via Drizzle (primary source of truth for `AnalysisRun`, `AnalysisSlice`, `ProcessingCursor`, `ProcessedTx`, all domain tables, `RawProviderRecord`); Upstash Redis as serverless cache backend for provider responses (already in place per `provider-cache-coordination.md`); Trigger.dev managed run state (UI hint only, research.md §R12)  
**Testing**: `vitest` for unit/contract tests against the engine repositories and route handlers, `@playwright/test` for E2E coverage of the start/status/cancel flow under canonical statuses, Trigger.dev `@trigger.dev/sdk/v3` dev-mode harness for local task execution  
**Target Platform**: Vercel serverless runtime for Next.js routes; Trigger.dev Cloud (with self-host fallback documented per research.md §R14.4) for durable task execution; browser clients run only the public Next.js bundle  
**Project Type**: Web application monorepo (`apps/web/` is the primary surface; no second app introduced by this feature)  
**Performance Goals**: First-time full-history run for a validation wallet (~5 slices × Phase A+B + D + E + F) completes within the chosen Trigger.dev plan's run-minute budget; incremental re-run one week later issues zero provider calls for slices fully behind `lastProcessedDayUtc`; per-provider RPS stays under configured plan limits via Trigger.dev `concurrencyKey`s (research.md §R8); `GET /api/analysis/status` p95 ≤ 200ms reading from Postgres only  
**Constraints**: No hardcoded user-facing copy anywhere in the engine; every persisted row, idempotency key, job payload, query key, and provider call carries `chainId`; Postgres is the sole source of truth for run state (Trigger.dev metadata loss MUST NOT corrupt persisted state, research.md §R12); per-task retry policy fixed at 5 attempts with exponential backoff + jitter on 429/5xx/network (research.md §R8); soft reorg window fixed at 32 blocks (research.md §R5); v1 stores only `PricePoint.resolution = "daily"` (research.md §R4); v1 wires only Base mainnet but schema/API stay chain-aware (research.md §R13); factory and gauge addresses MUST be discovered dynamically and persisted in `ProtocolContract`, never hardcoded (research.md §R7, protocol research §4.3)  
**Scale/Scope**: Single connected wallet per run; up to 5 backward slices × 90 days per full-history run; 14 settled research decisions (R1–R14); 16 entities (4 new engine-control tables + 12 existing/extended domain tables); 7 Trigger.dev task types; 3 provider queues (`moralis`, `alchemy-prices`, `alchemy-rpc`); 3 new/updated API routes; 3 new i18n namespaces (`analysis`, `coverage`, `errors`) in en + es parity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate (Principle I)** — PASS. The engine emits only machine codes; no user-facing English strings are returned from any route. Sample labels in the spec preserve the control-tower brand tone (spec FR-056). No casino, meme, or retail-trading language is introduced.
- **Localization gate (Principle II)** — PASS. New i18n namespaces `analysis`, `coverage`, `errors` are required in both `en/` and `es/`. The `i18n-namespaces.md` contract enumerates every key; the existing `pnpm i18n:check` parity gate will catch additions without translations. No engine code emits or formats user-facing strings (FR-054, FR-055, FR-058).
- **Chain-awareness gate (Principle III)** — PASS. Every new table is keyed with `chainId` as part of its uniqueness predicate; every Trigger.dev `idempotencyKey` prepends `{chainId}`; every API route carries or derives `chainId` and rejects unsupported chains via `assertSupportedChain` (research.md §R5, §R10; spec FR-006, FR-041, CA-004). No address-only or hash-only unique constraint is added.
- **Provider/API gate (Principle IV)** — PASS. Provider responsibilities follow research.md §R8 exactly: Moralis = discovery only, Alchemy Prices = daily prices (address-based preferred, symbol fallback marked lower confidence in `PricePoint.source`), Alchemy RPC = `eth_getLogs`/`eth_getTransactionReceipt`/`eth_call`, `alchemy_getAssetTransfers` = wallet-history fallback. All provider responses are persisted as `RawProviderRecord` before normalization (FR-029). API routes return stable machine error codes only (FR-042, FR-043). Long analysis runs execute on Trigger.dev, never inside an HTTP request handler (FR-044, FR-045). Browser code never calls a provider directly (FR-060, SC-009).
- **Explainability gate (Principle V)** — PASS. Raw provider responses persist before normalization (FR-029). Coverage reasons use a controlled vocabulary (`missingPrices | partialDecoded | providerError | providerThrottled | reorgSuspect | decodeError | pricingPartial | unknownError`) surfaced via the status API (FR-031). `ProcessingCursor` advances only to the latest fully-`complete` UTC day, preserving the cache invariant (FR-017, FR-023, CA-006). Manual Deposits, Automated Strategies, and Pools remain distinct analytical units; Mellow exposure is modeled as `Strategy` + `StrategyExposure`, never as an NFT deposit (FR-021, research.md §R7).

No principle requires justification under the Complexity Tracking section. The plan adds no new project, no new framework, and no parallel data-store; it extends the existing Drizzle schema and adds a Trigger.dev task topology that the project has already committed to (research.md §R1).

## Project Structure

### Documentation (this feature)

```text
specs/008-analysis-jobs/
├── plan.md                          # This file (/speckit.plan command output)
├── spec.md                          # Feature spec (already finalized)
├── research.md                      # Phase 0 — 14 settled decisions (already finalized)
├── data-model.md                    # Phase 1 output (this command)
├── quickstart.md                    # Phase 1 output (this command)
├── contracts/                       # Phase 1 output (this command)
│   ├── analysis-api.md
│   ├── trigger-tasks.md
│   ├── provider-clients.md
│   └── i18n-namespaces.md
└── checklists/                      # Pre-existing
```

### Source Code (repository root)

The engine extends the existing Next.js app at `apps/web/`. No new app or package is introduced.

```text
apps/web/
├── src/
│   ├── analysis/
│   │   └── analysisStatus.ts                 # EXISTING — canonical status enum (007-settings-screen R1). Reused as-is.
│   ├── chains/
│   │   └── chains.ts                         # EXISTING — chain registry; consumed by every engine module.
│   ├── i18n/
│   │   └── locales/
│   │       ├── en/
│   │       │   ├── analysis.json             # NEW — status / phase / slice labels.
│   │       │   ├── coverage.json             # NEW — coverage reason vocabulary.
│   │       │   └── errors.json               # NEW — engine machine error codes.
│   │       └── es/
│   │           ├── analysis.json             # NEW — Spanish parity.
│   │           ├── coverage.json             # NEW — Spanish parity.
│   │           └── errors.json               # NEW — Spanish parity.
│   ├── server/
│   │   ├── analysis/                         # EXISTING — extended in this feature.
│   │   │   ├── analysis-run.repository.ts    # EXISTING — extended for new columns and `AnalysisSlice` writes.
│   │   │   ├── analysis-slice.repository.ts  # NEW
│   │   │   ├── processing-cursor.repository.ts # NEW
│   │   │   ├── processed-tx.repository.ts    # NEW
│   │   │   ├── coverage.ts                   # NEW — coverage reason vocabulary helpers.
│   │   │   ├── orchestrator.ts               # NEW — start/cancel orchestration entry point.
│   │   │   └── status-projection.ts          # NEW — maps internal status → canonical 007 vocabulary.
│   │   ├── chains/                           # EXISTING.
│   │   ├── db/
│   │   │   ├── schema.ts                     # EXTENDED — see data-model.md.
│   │   │   └── migrations/                   # NEW migration files generated by drizzle-kit.
│   │   ├── providers/
│   │   │   ├── alchemy/                      # EXISTING — extended with historical-price address-batch client.
│   │   │   ├── moralis/                      # EXISTING — extended with chain-aware history paging.
│   │   │   └── provider-cache.repository.ts  # EXISTING — Redis-first cache surface, extended for engine request-hash and in-flight coordination.
│   │   └── trigger/
│   │       ├── client.ts                     # REPLACED — real `@trigger.dev/sdk` wiring.
│   │       ├── tasks/                        # NEW directory.
│   │       │   ├── analysis-run.task.ts
│   │       │   ├── analysis-slice.task.ts
│   │       │   ├── phase-deposits.task.ts
│   │       │   ├── phase-rewards.task.ts
│   │       │   ├── phase-activity.task.ts
│   │       │   ├── phase-pools.task.ts
│   │       │   └── phase-finalize.task.ts
│   │       └── queues.ts                     # NEW — per-provider concurrency keys.
│   └── app/
│       └── api/
│           └── analysis/
│               ├── start/route.ts            # EXTENDED — once-per-UTC-day cap + mode defaulting.
│               ├── status/route.ts           # EXTENDED — canonical status + per-phase/slice projection.
│               └── cancel/route.ts           # NEW — POST cancel.
├── drizzle.config.ts                         # EXISTING.
└── trigger.config.ts                         # NEW — Trigger.dev v3 project config.
```

**Structure Decision**: Single-application web layout under `apps/web/`. The engine is wired entirely inside the existing Next.js app; durable execution is delegated to Trigger.dev v3 tasks under `apps/web/src/server/trigger/tasks/`. No new package, app, or service is introduced. This honors the constitutional "layered architecture" principle (Fast API → Protocol reconstruction → Localization) without inflating the monorepo footprint.

## Complexity Tracking

> No constitutional violations require justification. Section intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

## Phase 0 — Outline & Research

**Status**: COMPLETE. See [research.md](research.md). Fourteen decisions (R1–R14) are accepted and authoritative. No new `NEEDS CLARIFICATION` markers were introduced during planning; all open verification items (`R14.1`–`R14.5`) are scoped as implementation-time validations, not blockers to design. The Phase 0 document is not regenerated by this command.

## Phase 1 — Design & Contracts

**Status**: COMPLETE. Artifacts generated by this command:

1. **`data-model.md`** — Drizzle schema deltas for `AnalysisRun` (extended), `AnalysisSlice` (new), `ProcessingCursor` (new), `ProcessedTx` (new), `StrategyExposure` (new), `PoolMetricsSnapshot` (new), plus chain-aware identity and coverage column additions to existing tables (`Deposit`, `Strategy`, `LedgerEvent`, `AssetMovement`, `RewardEvent`, `PerformanceSnapshot`, `Pool`, `AttributionState`, `AttributionSourceLot`, `RawProviderRecord`, `PricePoint`, `ProtocolContract`). Documents indexes, unique constraints, FK relations, and state-transition rules. Honors the `mint()` vs `increaseLiquidity(existing tokenId)` rule for `Deposit` identity (research.md §R7, protocol research §3.3) and the Mellow `Strategy + StrategyExposure` rule (FR-021, research.md §R7).

2. **`contracts/analysis-api.md`** — Request/response shapes, error codes, and idempotency behavior for `POST /api/analysis/start`, `GET /api/analysis/status`, `POST /api/analysis/cancel`. Status responses return only the canonical 007-settings-screen vocabulary (`not_analyzed | queued | running | ready | stale | failed`) plus per-phase progress (A/B/D/E/F), per-slice progress, `coverageReasons[]`, `lastSuccessfulRunAt`, `runId`. Machine codes only; UI resolves through i18n namespaces.

3. **`contracts/trigger-tasks.md`** — Trigger.dev v3 task topology: `analysis.run`, `analysis.slice`, `phase.deposits`, `phase.rewards`, `phase.activity`, `phase.pools`, `phase.finalize`. Payload schemas, explicit `maxDuration` budgets, per-task `idempotencyKey` patterns (research.md §R10), per-provider queue `concurrencyKey`/`concurrencyLimit` (research.md §R8), and `metadata.set()` progress channels.

4. **`contracts/provider-clients.md`** — Hard boundary between Moralis (discovery), Alchemy Prices (daily prices, address-first), Alchemy RPC (`eth_getLogs`/`eth_getTransactionReceipt`/`eth_call`), and `alchemy_getAssetTransfers` (wallet-history fallback). Retry policy (5 attempts, exponential backoff + jitter on 429/5xx/network), rate-budget rules, and the universal `RawProviderRecord` write-before-normalize contract.

5. **`contracts/i18n-namespaces.md`** — Required new namespaces (`analysis`, `coverage`, `errors`) with the full key catalog skeleton for status labels, phase labels, coverage reason labels, and engine error envelopes. English + Spanish parity is enforced by `pnpm i18n:check`.

6. **`quickstart.md`** — Developer runbook to trigger a local analysis run: required environment variables (Moralis, Alchemy, Trigger.dev secrets), Postgres + `pnpm db:migrate` setup, Trigger.dev `dev` server invocation, sample wallet address per `overview-provider-smoke-note.md` guidance (a real Base-active wallet, not the zero address), step-by-step observation through `POST /api/analysis/start` → `GET /api/analysis/status` polling → final assertion of `PerformanceSnapshot` rows.

7. **Agent context** — `.github/copilot-instructions.md` updated between the `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers to point at `specs/008-analysis-jobs/plan.md`.

## Phase 2 — Re-Evaluation Of Constitution Check (Post-Design)

After Phase 1 artifact generation, every gate re-evaluates to **PASS**:

- **Brand**: No new user-facing strings introduced anywhere in the contract surface.
- **Localization**: All user-facing surfaces routed through the three new i18n namespaces; en/es parity enforced by the existing parity gate.
- **Chain-awareness**: Every new schema table and every new Trigger.dev `idempotencyKey` is chain-prefixed; every API path includes `chainId`. Audit checklist in `data-model.md` confirms no address-only or hash-only unique constraints exist.
- **Provider/API**: Contracts confine Moralis/Alchemy responsibilities; the engine's API surface returns machine codes only; raw provider bodies never reach the browser.
- **Explainability**: `RawProviderRecord` persistence happens before normalization at every provider call site; coverage vocabulary is fixed and surfaced in the status API; `ProcessingCursor` advance is atomic with `AnalysisRun.status = complete` (FR-023).

No re-litigation of research.md decisions occurred. The plan defers `R14.1`–`R14.5` validations (Mellow per-wrapper event coverage, gauge→pool discovery for all pool types, rebalance-window default validation, Trigger.dev plan sizing measurement, unclaimed-reward valuation precision) to implementation tasks; they remain non-blocking for Phase 2.

## Readiness Report

- **Branch (working)**: `007-settings-screen`. Feature folder is `specs/008-analysis-jobs/`. The user is expected to cut `008-analysis-jobs` from `007-settings-screen` before implementation begins (via the existing `before_implement` git hook), then execute the implementation work from the generated task list.
- **Plan path**: [specs/008-analysis-jobs/plan.md](plan.md)
- **Generated artifacts**:
  - [specs/008-analysis-jobs/data-model.md](data-model.md)
  - [specs/008-analysis-jobs/contracts/analysis-api.md](contracts/analysis-api.md)
  - [specs/008-analysis-jobs/contracts/trigger-tasks.md](contracts/trigger-tasks.md)
  - [specs/008-analysis-jobs/contracts/provider-clients.md](contracts/provider-clients.md)
  - [specs/008-analysis-jobs/contracts/i18n-namespaces.md](contracts/i18n-namespaces.md)
  - [specs/008-analysis-jobs/quickstart.md](quickstart.md)
- **Constitution Check**: PASS pre-design, PASS post-design.
- **New `NEEDS CLARIFICATION`**: 0. The five `R14` items remain implementation-time validations, not planning blockers.
- **Ready for**: `/speckit.implement`.
