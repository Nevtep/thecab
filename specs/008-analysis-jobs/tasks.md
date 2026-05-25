# Tasks: Analysis Engine (Background Jobs Pipeline)

**Input**: Design documents from `/specs/008-analysis-jobs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The specification does not request TDD or test-first delivery for this feature. This task list focuses on implementation plus required validation, smoke, and contract checks.

**Organization**: Tasks are grouped by user story so each analysis-engine outcome can be implemented and validated independently after the foundational layer is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reserve the implementation surfaces for the Trigger.dev runtime, analysis modules, and route handlers.

- [ ] T001 Create the Trigger.dev runtime surface in apps/web/trigger.config.ts and apps/web/src/server/trigger/tasks/
- [ ] T002 [P] Create the analysis-engine module surface in apps/web/src/server/analysis/orchestrator.ts, apps/web/src/server/analysis/analysis-slice.repository.ts, apps/web/src/server/analysis/processing-cursor.repository.ts, and apps/web/src/server/analysis/processed-tx.repository.ts
- [ ] T003 [P] Add package and environment wiring for the engine runtime in apps/web/package.json and apps/web/src/server/env.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared persistence, provider, queue, and status infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T004 Extend the Drizzle schema for engine-control tables and run metadata in apps/web/src/server/db/schema.ts
- [ ] T005 Generate the corresponding Drizzle migration files in apps/web/src/server/db/migrations/
- [ ] T006 [P] Implement chain-aware analysis run, slice, cursor, and processed-tx repositories in apps/web/src/server/analysis/analysis-run.repository.ts, apps/web/src/server/analysis/analysis-slice.repository.ts, apps/web/src/server/analysis/processing-cursor.repository.ts, and apps/web/src/server/analysis/processed-tx.repository.ts
- [ ] T007 [P] Implement raw-provider-record persistence and request-hash support in apps/web/src/server/providers/raw-provider-records.repository.ts and apps/web/src/server/providers/provider-cache.repository.ts
- [ ] T008 [P] Implement provider retry and queue-aware client boundaries in apps/web/src/server/providers/alchemy/prices.ts, apps/web/src/server/providers/alchemy/rpc.ts, apps/web/src/server/providers/moralis/getWalletHistory.ts, and apps/web/src/server/providers/moralis/getWalletTokens.ts
- [ ] T009 Implement shared coverage-reason and canonical status projection helpers in apps/web/src/server/analysis/coverage.ts and apps/web/src/server/analysis/status-projection.ts
- [ ] T010 Implement Trigger.dev v3 client and queue definitions in apps/web/src/server/trigger/client.ts and apps/web/src/server/trigger/queues.ts
- [ ] T011 [P] Align canonical analysis status usage for engine routes and UI consumers in apps/web/src/analysis/analysisStatus.ts, apps/web/src/features/overview/overview.mappers.ts, and apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx
- [ ] T012 [P] Add machine-code namespace skeletons for the engine in apps/web/src/i18n/locales/en/analysis.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/errors.json, apps/web/src/i18n/locales/es/analysis.json, apps/web/src/i18n/locales/es/coverage.json, and apps/web/src/i18n/locales/es/errors.json

**Checkpoint**: Schema, repositories, provider boundaries, queue wiring, and canonical status helpers are ready for story work.

---

## Phase 3: User Story 1 - First-Time Full-History Reconstruction For A New Wallet (Priority: P1) 🎯 MVP

**Goal**: Execute a first full-history analysis run that walks up to 365 days in backward 90-day slices and writes normalized Aerodrome and Mellow lifecycle data.

**Independent Test**: Trigger `POST /api/analysis/start` for a wallet with no prior complete run and verify that the run fans out backward 90-day slices, executes per-slice deposit and reward phases, and reaches a completed run state with normalized domain writes.

- [ ] T013 [US1] Implement backward slice planning and run-window calculation in apps/web/src/server/analysis/orchestrator.ts
- [ ] T014 [P] [US1] Implement the parent Trigger.dev orchestrator in apps/web/src/server/trigger/tasks/analysis-run.task.ts
- [ ] T015 [P] [US1] Implement slice task fan-out and per-slice lifecycle management in apps/web/src/server/trigger/tasks/analysis-slice.task.ts
- [ ] T016 [P] [US1] Implement Aerodrome deposit lifecycle decoding for `mint`, `increaseLiquidity`, `decreaseLiquidity`, and `collect` in apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts
- [ ] T017 [P] [US1] Implement Mellow share-level exposure discovery in apps/web/src/server/protocols/mellow/computeShareLevelAccounting.ts
- [ ] T018 [US1] Implement Phase A normalized writes for deposits, strategies, ledger events, and asset movements in apps/web/src/server/trigger/tasks/phase-deposits.task.ts
- [ ] T019 [US1] Implement Phase B reward claim and accrual writes in apps/web/src/server/trigger/tasks/phase-rewards.task.ts
- [ ] T020 [US1] Replace the in-process analysis skeleton with Trigger.dev execution from apps/web/src/app/api/analysis/start/route.ts, apps/web/src/server/analysis/analyzeWalletTask.ts, and apps/web/src/server/trigger/client.ts

**Checkpoint**: A first-time wallet can complete the A→B slice pipeline over the full-history window.

---

## Phase 4: User Story 2 - Incremental Re-Run Short-Circuits On The Processing Cursor (Priority: P1)

**Goal**: Re-runs fetch only newly uncovered days, skip slices behind the cursor, and re-check only the soft reorg window.

**Independent Test**: Complete one run, trigger a later incremental run, and verify that slices fully behind `lastProcessedDayUtc` become `skipped_cached`, overlapping windows only fetch uncached days, and recent blocks inside the soft reorg window are re-checked.

- [ ] T021 [US2] Implement `ProcessingCursor` reads and latest-complete-day calculations in apps/web/src/server/analysis/processing-cursor.repository.ts and apps/web/src/server/analysis/orchestrator.ts
- [ ] T022 [P] [US2] Implement `ProcessedTx` dedupe and 32-block reorg filtering in apps/web/src/server/analysis/processed-tx.repository.ts and apps/web/src/server/trigger/tasks/phase-deposits.task.ts
- [ ] T023 [P] [US2] Implement cache-first provider reuse with distributed in-flight coordination for repeated slice requests in apps/web/src/server/providers/provider-cache.repository.ts, apps/web/src/server/providers/alchemy/prices.ts, and apps/web/src/server/providers/alchemy/rpc.ts
- [ ] T024 [US2] Persist `skipped_cached`, provider-attempt, and transaction-count slice outcomes in apps/web/src/server/analysis/analysis-slice.repository.ts and apps/web/src/server/trigger/tasks/analysis-slice.task.ts
- [ ] T025 [US2] Default existing-wallet starts to incremental mode and bound overlapping request windows in apps/web/src/app/api/analysis/start/route.ts and apps/web/src/server/analysis/orchestrator.ts

**Checkpoint**: Incremental runs short-circuit old slices and only reprocess the uncached edge of history.

---

## Phase 5: User Story 3 - One Completed Run Per Account Per UTC Day (Priority: P1)

**Goal**: Prevent duplicate completed runs and duplicate enqueueing for the same wallet, chain, and UTC day.

**Independent Test**: Call `POST /api/analysis/start` multiple times on the same UTC day for the same wallet and verify that every repeat call returns the existing or in-flight run summary without creating a second completed run.

- [ ] T026 [US3] Implement UTC-day-bucket run creation and same-day lookup helpers in apps/web/src/server/analysis/analysis-run.repository.ts
- [ ] T027 [US3] Enforce same-day idempotent enqueue behavior in apps/web/src/app/api/analysis/start/route.ts and apps/web/src/server/trigger/client.ts
- [ ] T028 [P] [US3] Persist the partial unique-complete-run constraint and active-run lookup indexes in apps/web/src/server/db/schema.ts and apps/web/src/server/db/migrations/
- [ ] T029 [US3] Return existing same-day and in-flight run summaries from apps/web/src/app/api/analysis/start/route.ts and apps/web/src/server/analysis/status-projection.ts

**Checkpoint**: The engine allows only one completed run per wallet and chain per UTC day and deduplicates racing start requests.

---

## Phase 6: User Story 6 - Daily-Resolution Series Power Every Downstream Surface (Priority: P1)

**Goal**: Materialize daily performance, pool, deposit, strategy, and reward series that downstream Overview and protocol-position surfaces can read directly.

**Independent Test**: After a complete run, verify that daily `performance_snapshots`, `pool_metrics_snapshots`, reward accrual rows, and linked protocol entities exist for every covered day without re-deriving data from raw events.

- [ ] T030 [P] [US6] Implement global activity classification and residual attribution writes in apps/web/src/server/trigger/tasks/phase-activity.task.ts and apps/web/src/server/protocols/aerodrome/classifyResidualAttribution.ts
- [ ] T031 [P] [US6] Implement dynamic factory, gauge, and pool discovery in apps/web/src/server/trigger/tasks/phase-pools.task.ts and apps/web/src/server/protocols/aerodrome/syncAerodromeMetadata.ts
- [ ] T032 [P] [US6] Implement official Mellow strategy metadata sync and pool linkage in apps/web/src/server/protocols/mellow/syncMellowStrategies.ts
- [ ] T033 [US6] Implement daily snapshot aggregation for portfolio, pool, deposit, strategy, and rewards scopes in apps/web/src/server/analysis/computeSnapshots.ts and apps/web/src/server/trigger/tasks/phase-finalize.task.ts
- [ ] T034 [US6] Persist `PerformanceSnapshot`, `PoolMetricsSnapshot`, `StrategyExposure`, and final run/cursor state in apps/web/src/server/db/schema.ts and apps/web/src/server/trigger/tasks/phase-finalize.task.ts
- [ ] T035 [US6] Update overview freshness and downstream snapshot linkage after finalization in apps/web/src/server/overview/overview.repository.ts and apps/web/src/server/analysis/analysis-run.repository.ts

**Checkpoint**: Downstream surfaces can read daily materialized series directly from normalized storage.

---

## Phase 7: User Story 4 - Degraded Completion When A Slice Fails (Priority: P2)

**Goal**: Isolate slice failures, roll them into truthful partial coverage, and still complete the run for the slices that succeeded.

**Independent Test**: Force one slice to exhaust provider retries and verify that sibling slices still finish, the run lands as complete with partial coverage, and `coverageReasons[]` reflects the failure accurately.

- [ ] T036 [P] [US4] Normalize provider failure envelopes into the controlled coverage vocabulary in apps/web/src/server/providers/alchemy/index.ts and apps/web/src/server/providers/moralis/index.ts
- [ ] T037 [P] [US4] Implement slice-level retry exhaustion, failure isolation, and coverage rollup in apps/web/src/server/trigger/tasks/analysis-slice.task.ts and apps/web/src/server/trigger/tasks/analysis-run.task.ts
- [ ] T038 [US4] Persist slice and run coverage reason aggregation in apps/web/src/server/analysis/analysis-slice.repository.ts and apps/web/src/server/analysis/analysis-run.repository.ts
- [ ] T039 [US4] Project partial-coverage results through the status surface in apps/web/src/app/api/analysis/status/route.ts and apps/web/src/server/analysis/status-projection.ts

**Checkpoint**: Slice-local failures degrade coverage truthfully without blocking the entire run.

---

## Phase 8: User Story 5 - User Cancels A Running Analysis (Priority: P2)

**Goal**: Allow clean user cancellation that halts new work, preserves already-written rows, and never advances the processing cursor.

**Independent Test**: Cancel a queued or running analysis and verify that the run reaches a cancelled internal state, no new slices are enqueued, and the status API projects the correct post-cancel result.

- [ ] T040 [P] [US5] Implement the cancel route contract in apps/web/src/app/api/analysis/cancel/route.ts
- [ ] T041 [P] [US5] Implement Trigger.dev cancellation and persisted run cancellation fields in apps/web/src/server/trigger/client.ts and apps/web/src/server/analysis/analysis-run.repository.ts
- [ ] T042 [US5] Make the run, slice, and finalize tasks honor cancellation without advancing the cursor in apps/web/src/server/trigger/tasks/analysis-run.task.ts, apps/web/src/server/trigger/tasks/analysis-slice.task.ts, and apps/web/src/server/trigger/tasks/phase-finalize.task.ts
- [ ] T043 [US5] Return canonical post-cancel status projections in apps/web/src/app/api/analysis/status/route.ts and apps/web/src/server/analysis/status-projection.ts

**Checkpoint**: Cancellation stops forward progress cleanly and preserves cursor correctness.

---

## Phase 9: User Story 7 - Honest, Localized Status For The UI (Priority: P2)

**Goal**: Expose canonical, localized, machine-code-only run status with per-phase and per-slice progress for Settings and Overview.

**Independent Test**: Poll `GET /api/analysis/status` across `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed` lifecycles and verify that the payload contains only canonical statuses, machine codes, phase progress, slice progress, and raw timestamps.

- [ ] T044 [P] [US7] Implement phase and slice progress projection models in apps/web/src/server/analysis/status-projection.ts and apps/web/src/server/analysis/analysis-slice.repository.ts
- [ ] T045 [US7] Extend the status route to return canonical status, phase progress, slice progress, coverage reasons, and last-success timestamps in apps/web/src/app/api/analysis/status/route.ts
- [ ] T046 [P] [US7] Add finalized English machine-code copy for engine statuses, phases, coverage reasons, and errors in apps/web/src/i18n/locales/en/analysis.json, apps/web/src/i18n/locales/en/coverage.json, and apps/web/src/i18n/locales/en/errors.json
- [ ] T047 [P] [US7] Add Spanish parity for the same machine-code catalog in apps/web/src/i18n/locales/es/analysis.json, apps/web/src/i18n/locales/es/coverage.json, and apps/web/src/i18n/locales/es/errors.json
- [ ] T048 [US7] Align Settings, Overview, and the analysis badge with the canonical status payload in apps/web/src/features/settings/settings.mappers.ts, apps/web/src/features/overview/overview.mappers.ts, and apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx

**Checkpoint**: UI consumers can render truthful, localized analysis state directly from the status API contract.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Validate the engine end to end and enforce the contract, provider-boundary, and localization quality gates.

- [ ] T049 Run Trigger.dev task registration smoke validation for apps/web/trigger.config.ts with `cd apps/web && pnpm trigger:dev`
- [ ] T050 Run schema generation and migration validation for apps/web/src/server/db/schema.ts with `cd apps/web && pnpm db:generate && pnpm db:migrate`
- [ ] T051 Run static validation for apps/web/src/app/api/analysis/, apps/web/src/server/analysis/, and apps/web/src/server/trigger/tasks/ with `cd apps/web && pnpm lint && pnpm typecheck && pnpm build`
- [ ] T052 Run EN/ES parity validation for apps/web/src/i18n/locales/en/analysis.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/errors.json, apps/web/src/i18n/locales/es/analysis.json, apps/web/src/i18n/locales/es/coverage.json, and apps/web/src/i18n/locales/es/errors.json with `cd apps/web && pnpm i18n:check`
- [ ] T053 Validate provider-boundary compliance for apps/web/src/server/providers/ and apps/web/src/features/ with `cd apps/web && rg "@/server/providers|moralis|alchemy|trigger" src/features src/app`
- [ ] T054 Validate the quickstart flow against specs/008-analysis-jobs/quickstart.md and apps/web/src/app/api/analysis/start/route.ts, apps/web/src/app/api/analysis/status/route.ts, and apps/web/src/app/api/analysis/cancel/route.ts
- [ ] T055 Validate same-day starts, incremental cache hits, partial coverage, cancellation, and status projection against specs/008-analysis-jobs/contracts/analysis-api.md and specs/008-analysis-jobs/contracts/trigger-tasks.md
- [ ] T056 Validate daily snapshot outputs and cursor advancement against specs/008-analysis-jobs/data-model.md and apps/web/src/server/trigger/tasks/phase-finalize.task.ts
- [ ] T057 Validate unsupported-chain handling regressions for the analysis routes against specs/008-analysis-jobs/contracts/analysis-api.md and apps/web/src/app/api/analysis/start/route.ts, apps/web/src/app/api/analysis/status/route.ts, and apps/web/src/app/api/analysis/cancel/route.ts
- [ ] T058 Validate coverage-state rendering regressions for full, partial, and unknown analysis outcomes against specs/008-analysis-jobs/contracts/i18n-namespaces.md, apps/web/src/features/settings/settings.mappers.ts, and apps/web/src/features/overview/overview.mappers.ts
- [ ] T059 Measure status-route latency against the `GET /api/analysis/status` p95 target in specs/008-analysis-jobs/plan.md and apps/web/src/app/api/analysis/status/route.ts
- [ ] T060 Measure per-provider queue throughput and retry behavior against SC-010 in specs/008-analysis-jobs/spec.md, specs/008-analysis-jobs/contracts/trigger-tasks.md, and apps/web/src/server/trigger/queues.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and creates the engine implementation surfaces.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user story work.
- **User Story phases**: All depend on Foundational.
- **Polish (Phase 10)**: Depends on the desired story phases being complete.

### User Story Dependencies

- **US1**: Starts first after Foundational and establishes the first full-history orchestration path.
- **US2**: Depends on US1 because cursor short-circuiting extends the slice pipeline.
- **US3**: Depends on Foundational and should land before production use of US1 or US2 so start requests are idempotent.
- **US6**: Depends on US1 because it materializes downstream daily series from completed run data.
- **US4**: Depends on US1 and US2 because degraded completion operates on slice and cursor behavior.
- **US5**: Depends on US1 because cancellation hooks into the orchestrator and child-task lifecycle.
- **US7**: Depends on US3, US4, and US5 because the status API must project final run semantics, coverage, and cancellation behavior truthfully.

### Within Each User Story

- Implement repositories and shared helpers before task orchestration.
- Implement provider/protocol decoding before phase writers that depend on decoded outputs.
- Complete task orchestration before route-level contract projection.
- Land machine-code localization before wiring the final UI consumers.
- Validate the story-specific independent test before moving on to the next major slice.

### Parallel Opportunities

- Setup tasks `T002` and `T003` can run in parallel.
- Foundational tasks `T006` through `T012` have multiple safe parallel tracks after `T004` and `T005` define the schema baseline.
- In US1, `T014` through `T017` can proceed in parallel once `T013` defines the slice plan contract.
- In US2, `T022` can run in parallel with `T021`.
- In US6, `T030`, `T031`, and `T032` can run in parallel before `T033` aggregates the daily series.
- In US4, `T036` and `T037` can run in parallel.
- In US5, `T040` and `T041` can run in parallel.
- In US7, `T046` and `T047` can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "Implement the parent Trigger.dev orchestrator in apps/web/src/server/trigger/tasks/analysis-run.task.ts"
Task: "Implement slice task fan-out and per-slice lifecycle management in apps/web/src/server/trigger/tasks/analysis-slice.task.ts"
Task: "Implement Aerodrome deposit lifecycle decoding in apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts"
Task: "Implement Mellow share-level exposure discovery in apps/web/src/server/protocols/mellow/computeShareLevelAccounting.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Implement ProcessedTx dedupe and 32-block reorg filtering in apps/web/src/server/analysis/processed-tx.repository.ts and apps/web/src/server/trigger/tasks/phase-deposits.task.ts"
Task: "Implement cache-first provider reuse with distributed in-flight coordination in apps/web/src/server/providers/provider-cache.repository.ts and apps/web/src/server/providers/alchemy/prices.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Enforce same-day idempotent enqueue behavior in apps/web/src/app/api/analysis/start/route.ts and apps/web/src/server/trigger/client.ts"
Task: "Persist the partial unique-complete-run constraint and active-run lookup indexes in apps/web/src/server/db/schema.ts and apps/web/src/server/db/migrations/"
```

## Parallel Example: User Story 6

```bash
Task: "Implement global activity classification and residual attribution writes in apps/web/src/server/trigger/tasks/phase-activity.task.ts and apps/web/src/server/protocols/aerodrome/classifyResidualAttribution.ts"
Task: "Implement dynamic factory, gauge, and pool discovery in apps/web/src/server/trigger/tasks/phase-pools.task.ts and apps/web/src/server/protocols/aerodrome/syncAerodromeMetadata.ts"
Task: "Implement official Mellow strategy metadata sync and pool linkage in apps/web/src/server/protocols/mellow/syncMellowStrategies.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Normalize provider failure envelopes into the controlled coverage vocabulary in apps/web/src/server/providers/alchemy/index.ts and apps/web/src/server/providers/moralis/index.ts"
Task: "Implement slice-level retry exhaustion, failure isolation, and coverage rollup in apps/web/src/server/trigger/tasks/analysis-slice.task.ts and apps/web/src/server/trigger/tasks/analysis-run.task.ts"
```

## Parallel Example: User Story 5

```bash
Task: "Implement the cancel route contract in apps/web/src/app/api/analysis/cancel/route.ts"
Task: "Implement Trigger.dev cancellation and persisted run cancellation fields in apps/web/src/server/trigger/client.ts and apps/web/src/server/analysis/analysis-run.repository.ts"
```

## Parallel Example: User Story 7

```bash
Task: "Add finalized English machine-code copy for engine statuses, phases, coverage reasons, and errors in apps/web/src/i18n/locales/en/analysis.json, apps/web/src/i18n/locales/en/coverage.json, and apps/web/src/i18n/locales/en/errors.json"
Task: "Add Spanish parity for the same machine-code catalog in apps/web/src/i18n/locales/es/analysis.json, apps/web/src/i18n/locales/es/coverage.json, and apps/web/src/i18n/locales/es/errors.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate a first full-history run end to end before expanding scope.

### Incremental Delivery

1. Land the orchestration baseline with US1.
2. Add cache and cursor efficiency with US2.
3. Enforce the once-per-day cap with US3.
4. Materialize downstream daily series with US6.
5. Add degraded-completion behavior with US4.
6. Add cancellation with US5.
7. Finish with truthful, localized status projection in US7.

### Suggested MVP Scope

1. Setup + Foundational.
2. US1 full-history reconstruction.
3. US3 once-per-day run cap.

---

## Notes

- `[P]` tasks are safe to parallelize because they target different files or isolated contracts.
- Each user story maps directly to the numbered user stories in specs/008-analysis-jobs/spec.md.
- Every task includes an implementation path under apps/web/ or a feature artifact path under specs/008-analysis-jobs/.
- This task list preserves chain-aware identity rules, server-only provider access, Trigger.dev as the durable runtime, and machine-code-only API responses.