# Tasks: Deterministic Reward & Rebalance Refactor

**Input**: Design documents from `/specs/011-deterministic-reward-rebalance/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reward-resolution.md, contracts/rebalance-read-models.md, quickstart.md

**Tests**: No standalone test-authoring phase is included because the feature spec does not explicitly require TDD. Validation is still required in the implementation flow through the existing `pnpm --filter web test:unit`, smoke scripts, rebuild scripts, and quickstart checks.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated with minimal cross-story ambiguity.

## Phase 1: Setup

**Purpose**: Establish the implementation and validation scaffolding for deterministic reward and rebalance refactors.

- [x] T001 Update apps/web/src/server/scripts/analysis-smoke.ts to print deterministic reward-resolution and inferred-action summaries for a wallet/run validation pass.
- [x] T002 [P] Create apps/web/src/server/scripts/rebuild-deposit-read-models.ts to rebuild `deposit_wallet_summaries`, `deposit_lifecycle_events`, and `deposit_performance_decompositions` from normalized rows only.
- [x] T003 [P] Update specs/011-deterministic-reward-rebalance/quickstart.md to use the actual validation scripts and SQL checks implemented for feature 011.

---

## Phase 2: Foundational

**Purpose**: Add schema, persistence, coverage, and finalize-time plumbing that every user story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Update apps/web/src/server/db/schema.ts to extend `reward_events` with `strategy_exposure_id`, `resolved_pool_id`, `resolution_basis`, and `resolution_reason_codes` for deterministic owner proof persistence, and ensure the schema can persist additive external strategy position references without making them the canonical owner key.
- [x] T005 Generate the matching Drizzle migration under apps/web/src/server/db/migrations/ for the new `reward_events` columns and indexes.
- [x] T006 Update apps/web/src/server/analysis/enginePersistence.ts to upsert the new deterministic reward-resolution fields, persist additive `LpSugar` strategy position references on `strategy_exposures`, and avoid regressing existing `reward_events` identity behavior.
- [x] T007 [P] Update apps/web/src/server/analysis/coverage.ts to propagate unresolved manual/strategy reward reason codes and residual-flow ambiguity reasons into downstream coverage surfaces.
- [x] T008 [P] Update apps/web/src/server/scripts/reclassify-run.ts to expose the shared deterministic rebuild order for a wallet/chain/run: reward re-resolution, canonical inference, snapshot rebuilds, pool rebuilds, and deposit rebuilds, all idempotently.
- [x] T009 Update apps/web/src/server/trigger/tasks/phase-finalize.task.ts to route finalize-time projection rebuilds through the same deterministic reclassification and materialization path used by `reclassify-run.ts` instead of maintaining a divergent direct-materialization path.

**Checkpoint**: Schema, persistence, and rebuild plumbing are ready; user-story work can proceed.

---

## Phase 3: User Story 1 - Deterministic Manual Reward Ownership (Priority: P1) 🎯 MVP

**Goal**: Resolve manual Aerodrome rewards only when deposit ownership is proven by tokenId or same-transaction identity evidence, while strategy rewards resolve through StrategyExposure plus the deterministic `LpSugar.positions(...).id` strategy position reference when available rather than leaking into manual deposits.

**Independent Test**: Analyze a wallet with overlapping same-pool manual deposits, a gauge unstake-with-reward flow, and Mellow `StakingRewards` activity; confirm manual rewards resolve only with explicit or same-transaction token proof, strategy rewards resolve through `StrategyExposure` plus the matching deterministic `LpSugar` strategy position reference when available, and ambiguous cases remain unresolved.

- [x] T010 [P] [US1] Create apps/web/src/server/analysis/rewardResolution.ts to normalize explicit `tokenId` extraction, same-transaction deposit proof, strategy wrapper/staking pairing, share-lifecycle ownership hints, deterministic `LpSugar.positions(...).id` matching for known strategy wrappers, and any verified Aerodrome-visible automated strategy position reference, returning a structured result that includes owner type, `depositId`, `strategyId`, `strategyExposureId`, `resolvedPoolId`, `resolutionBasis`, `resolutionReasonCodes`, and additive external strategy position reference fields.
- [x] T011 [US1] Refactor apps/web/src/server/trigger/tasks/phase-rewards.task.ts to build reward candidates from `collect`, gauge inbound reward receipts, unstake-with-reward flows, and Mellow `StakingRewards` claims using the deterministic resolution order from contracts/reward-resolution.md, resolving strategy rewards through proven `StrategyExposure` ownership first and attempting to attach the matching `LpSugar` strategy position id only as an additive external reference for known wrappers.
- [x] T012 [US1] Update apps/web/src/server/analysis/enginePersistence.ts to persist resolved manual rewards to `deposits.id`, resolved strategy rewards to `strategies.id` plus `strategy_exposure_id`, persist `resolved_pool_id`, `resolution_basis`, and `resolution_reason_codes` on `reward_events`, persist deterministic `LpSugar` strategy position references on `strategy_exposures`, and persist unresolved rewards with explicit reason codes instead of fallback attribution.
- [x] T013 [US1] Update apps/web/src/server/analysis/computeSnapshots.ts to aggregate only resolved manual and resolved strategy rewards by owner and to surface unresolved ownership as coverage degradation instead of counting it into totals.
- [x] T014 [US1] Update apps/web/src/server/analysis/deposit-read-models.ts to consume only resolved manual rewards for deposit totals, explicitly exclude same-pool strategy rewards from deposit projections, and expose unresolved reward reason codes on affected deposit projections.
- [x] T014a [US1] Implement deterministic Aerodrome dashboard strategy-position resolution via `LpSugar.positions(limit, offset, walletAddress)` filtered by `row.alm == wrapperAddress`, explicitly excluding the public Mellow `points.mellow.finance` API and `LpWrapper.positionId()` as identity sources, then persist `row.id` on `strategy_exposures.metadata_json.externalDepositReference` (or a dedicated column if needed) only when the mapping is deterministic and wallet-scoped.

**Checkpoint**: Manual reward attribution is tokenId-first and strategy rewards are separated from manual deposits.

---

## Phase 4: User Story 2 - Residual-Flow Rebalance And Redeploy Continuity (Priority: P1)

**Goal**: Replace bounded-window rebalance and redeploy heuristics with deterministic residual-flow outcomes emitted from canonical inference.

**Independent Test**: Analyze a wallet where a pool withdrawal is followed by intermediate cash-ins, unrelated activity, paired-token swaps, and a later same-pool redeploy; confirm `rebalance_same_pool`, `redeploy_same_pool`, liquidation, and cash-out outcomes follow source-of-funds allocation rather than timestamps.

- [x] T015 [P] [US2] Update apps/web/src/server/analysis/sourceOfFundsWaterfall.ts to emit the allocation breakdown, candidate residual consumption, and excess-bucket metadata required by the new `inferred_actions` contract, including attributable same-pool funding portions and mixed-funding metadata instead of majority-share shortcuts.
- [x] T016 [US2] Extend apps/web/src/server/analysis/canonicalInference.ts to emit `rebalance_same_pool`, `redeploy_same_pool`, `liquidation_from_residual`, `cash_out_from_residual`, and transfer/reassignment metadata from residual states without any time-window classifier, preserving same-pool attributable portions even when they are not the dominant share of total funding.
- [x] T017 [US2] Refactor apps/web/src/server/trigger/tasks/phase-activity.task.ts to use apps/web/src/server/analysis/canonicalInference.ts as the only higher-order rebalance/redeploy classifier and to remove bounded-window logic.
- [x] T018 [US2] Update apps/web/src/server/analysis/computeSnapshots.ts to consume residual-flow `inferred_actions` for same-pool capital continuity, liquidation, and cash-out semantics instead of re-deriving them from timing.
- [x] T019 [US2] Update apps/web/src/server/analysis/deposit-read-models.ts to attach deposit lifecycle and decomposition narratives only to residual-flow `inferred_actions` and never to time-window groupings.

**Checkpoint**: Same-pool rebalance and redeploy outcomes are deterministic residual-flow actions, not window-based guesses.

---

## Phase 5: User Story 3 - Truthful Read Models And Rebuilds (Priority: P2)

**Goal**: Rebuild dependent normalized outputs and wallet-scoped Pools/Deposits projections so corrected ownership and inferred-action semantics flow through every read model.

**Independent Test**: Reclassify a known wallet/run with prior heuristic drift, then rebuild snapshots, pool read models, and deposit read models; confirm ambiguous rewards become unresolved, pool reward totals aggregate resolved manual and strategy owners only, and timeline rebalance/redeploy rows come exclusively from canonical `inferred_actions`.

- [x] T020 [P] [US3] Update apps/web/src/server/analysis/pool-read-models.ts to repair pool reward aggregation so each pool totals `sum(resolved rewards linked to pool deposits) + sum(resolved rewards linked to pool strategies)` directly from normalized reward ownership, and to create rebalance/redeploy timeline rows only from canonical `inferred_actions`, degrading coverage or emitting neutral lifecycle rows instead of using local swap-shape fallback heuristics when canonical inference is absent.
- [x] T021 [US3] Update apps/web/src/server/analysis/deposit-read-models.ts to degrade coverage/confidence and preserve explicit unresolved/unattributed reason codes whenever deterministic reward or residual ownership cannot be proven.
- [x] T022 [US3] Update apps/web/src/server/scripts/rebuild-analysis-snapshots.ts to regenerate affected `performance_snapshots` from deterministic `reward_events` and `inferred_actions` outputs.
- [x] T023 [US3] Update apps/web/src/server/scripts/rebuild-pool-read-models.ts to rebuild `pool_wallet_summaries`, `pool_history_snapshots`, and `pool_timeline_events` from corrected normalized rows only.
- [x] T024 [US3] Update apps/web/src/server/scripts/rebuild-deposit-read-models.ts to rebuild `deposit_wallet_summaries`, `deposit_lifecycle_events`, and `deposit_performance_decompositions` from corrected normalized rows only.
- [x] T025 [US3] Update apps/web/src/server/scripts/reclassify-run.ts to orchestrate the full deterministic rebuild order through the shared rebuild pathway: reward re-resolution, canonical inference, snapshot rebuild, pool rebuild, and deposit rebuild.
- [x] T026 [US3] Update apps/web/src/server/trigger/tasks/phase-finalize.task.ts to preserve idempotent finalize-time rebuilds for wallet/chain reruns after reward or inference semantics change by invoking the same shared rebuild pathway as `reclassify-run.ts`.
- [x] T026a [US3] Update apps/web/src/server/analysis/pool-read-models.ts, apps/web/src/server/analysis/deposit-read-models.ts, and any future Strategies projections to expose the deterministic `LpSugar` strategy position reference as display/debug metadata without collapsing StrategyExposure into manual Deposit identity.

**Checkpoint**: Read models and rebuild scripts honor deterministic ownership and residual-flow semantics end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final spec-alignment cleanup and executable validation.

- [x] T027 [P] Update specs/008-analysis-jobs/spec.md and specs/008-analysis-jobs/research.md to remove or supersede bounded-window rebalance wording in favor of deterministic residual-flow semantics.
- [x] T028 [P] Update specs/008-analysis-jobs/data-model.md to replace the bounded-window `Phase D` rule with the deterministic `inferred_actions` contract used by feature 011.
- [x] T029 Run the validation flow in specs/011-deterministic-reward-rebalance/quickstart.md using apps/web/src/server/scripts/analysis-smoke.ts, apps/web/src/server/scripts/reclassify-run.ts, apps/web/src/server/scripts/rebuild-analysis-snapshots.ts, apps/web/src/server/scripts/rebuild-pool-read-models.ts, and apps/web/src/server/scripts/rebuild-deposit-read-models.ts, including fixtures for manual-plus-strategy same-pool rewards, mixed-funding same-pool redeploys where residual funding is not the majority share, and canonical-inference-missing timeline degradation.
- [x] T030 Run `pnpm --filter web lint`, `pnpm --filter web typecheck`, and `pnpm --filter web test:unit` from apps/web and fix any regressions in the touched analysis pipeline files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Phase 2 and is the recommended MVP slice.
- **User Story 2 (Phase 4)**: Starts after Phase 2 and can proceed in parallel with late US1 work once schema/persistence changes are in place.
- **User Story 3 (Phase 5)**: Depends on the normalized semantics from US1 and US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after Foundational.
- **US2**: No dependency on US1 for schema setup, but its final outputs should consume the deterministic reward owner model established in US1.
- **US3**: Depends on US1 and US2 because rebuilds must consume corrected reward ownership and corrected inferred actions.

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup.
- T007 and T008 can run in parallel during Foundational.
- T010 can run in parallel with T015 because reward proof extraction and residual-flow metadata changes touch different modules.
- T020 and T022 can run in parallel once US1 and US2 normalized outputs are stable.
- T027 and T028 can run in parallel during Polish.

## Parallel Example: User Story 1

```bash
# Parallelizable groundwork for deterministic reward ownership:
Task: "Create apps/web/src/server/analysis/rewardResolution.ts to normalize explicit token and strategy ownership proof"
Task: "Update apps/web/src/server/analysis/sourceOfFundsWaterfall.ts to emit richer residual allocation metadata"
```

## Parallel Example: User Story 3

```bash
# Parallelizable rebuild work after normalized semantics are stable:
Task: "Update apps/web/src/server/scripts/rebuild-analysis-snapshots.ts to regenerate deterministic snapshots"
Task: "Update apps/web/src/server/scripts/rebuild-pool-read-models.ts to rebuild pool projections from corrected rows"
Task: "Update apps/web/src/server/scripts/rebuild-deposit-read-models.ts to rebuild deposit projections from corrected rows"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate deterministic manual reward ownership before touching downstream rebuild surfaces.

### Incremental Delivery

1. Ship US1 to remove the core false-attribution bug.
2. Add US2 to replace bounded-window rebalance/redeploy semantics with residual-flow outcomes.
3. Add US3 to rebuild all dependent projections and maintenance scripts.

### Suggested MVP Scope

The smallest high-value delivery is **User Story 1**: deterministic manual reward ownership plus correct separation of strategy rewards from manual deposits.

## Notes

- `[P]` tasks operate on different files without blocking dependencies.
- All tasks preserve chain-aware identities and provider boundaries defined in the product and feasibility specs.
- No task may reintroduce pool/time/current-position heuristics as a fallback.