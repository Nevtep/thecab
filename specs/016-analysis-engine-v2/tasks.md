# Tasks: Analysis Engine V2

**Input**: Design documents from `/specs/016-analysis-engine-v2/`
**Prerequisites**: [plan.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/plan.md), [spec.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/spec.md), [research.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/research.md), [data-model.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/data-model.md), [contracts/](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/contracts)

**Tests**: Required by the feature spec. Use unit, service, repository, materializer, Trigger task, and deterministic regression tests only. Do not add Playwright, browser E2E, or automated browser/a11y tests.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

**Traceability**: Each phase lists the functional requirements and success criteria it covers. Supplemental task IDs above the original generated range keep existing references stable while making the work more granular.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase when dependencies are met
- **[Story]**: User story label from [spec.md](/Users/core/Code/The%20Cab/specs/016-analysis-engine-v2/spec.md)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create Engine V2 module boundaries, scripts, and configuration without changing runtime behavior.

- [ ] T001 Create Engine V2 server module directories in `apps/web/src/server/analysis/engine-v2/index.ts`
- [ ] T002 [P] Create Engine V2 collection module barrel in `apps/web/src/server/analysis/engine-v2/collection/index.ts`
- [ ] T003 [P] Create Engine V2 canonicalization module barrel in `apps/web/src/server/analysis/engine-v2/canonicalization/index.ts`
- [ ] T004 [P] Create Engine V2 classification module barrel in `apps/web/src/server/analysis/engine-v2/classification/index.ts`
- [ ] T005 [P] Create Engine V2 enrichment module barrel in `apps/web/src/server/analysis/engine-v2/enrichment/index.ts`
- [ ] T006 [P] Create Engine V2 accounting module barrel in `apps/web/src/server/analysis/engine-v2/accounting/index.ts`
- [ ] T007 [P] Create Engine V2 materializers module barrel in `apps/web/src/server/analysis/engine-v2/materializers/index.ts`
- [ ] T008 Add `analysis:v2:run` and `analysis:v2:regression` scripts to `apps/web/package.json`
- [ ] T009 Create Engine V2 run CLI skeleton in `apps/web/src/server/scripts/analysis-engine-v2-run.ts`
- [ ] T010 Create Engine V2 regression CLI skeleton in `apps/web/src/server/scripts/analysis-engine-v2-regression.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add schema, repository, provider-boundary, and shared engine primitives required before any user story can run.

**Critical**: No user story implementation can be completed until this phase is done.

**Traceability**: FR-001 through FR-030, FR-021a, SC-001 through SC-016 foundation tables, provider boundaries, chain-aware identities, DB-only read path prerequisites.

- [ ] T011 Add canonical collection, provider page, canonical transaction, canonical log, internal transaction, canonical movement, and canonical call tables to `apps/web/src/server/db/schema.ts`
- [ ] T131 Add contract ABI, selector/event registry, protocol registry, protocol known-address provenance, token metadata, price point, and protocol snapshot tables to `apps/web/src/server/db/schema.ts`
- [ ] T132 Add domain event, domain event link, classification trace, enrichment need, enrichment evidence/source, provider request audit, and provider response reference tables to `apps/web/src/server/db/schema.ts`
- [ ] T133 Add governance lock, governance lock event, managed/relay lock link, governance epoch, vote context, claim batch, claim item, reward item, and distributor-to-pool link tables to `apps/web/src/server/db/schema.ts`
- [ ] T134 Add accounting lot, residual inventory, cash-flow, valuation, and Activity/Deposits/Strategies/Pools/Rewards/Governance read-model support tables to `apps/web/src/server/db/schema.ts`
- [ ] T135 Add chain-scoped natural keys, unique constraints, indexes, foreign keys, and schema comments for all Engine V2 tables in `apps/web/src/server/db/schema.ts`
- [ ] T012 Generate Engine V2 Drizzle migration for all schema additions from T011 and T131-T135 in `apps/web/src/server/db/migrations/0014_analysis_engine_v2.sql`
- [ ] T013 Update Drizzle migration journal metadata for Engine V2 in `apps/web/src/server/db/migrations/meta/_journal.json`
- [ ] T014 [P] Add Engine V2 constants, versions, coverage states, confidence states, reason-code enums, and stage names in `apps/web/src/server/analysis/engine-v2/types.ts`
- [ ] T015 [P] Add Engine V2 zod payload schemas for Trigger task inputs in `apps/web/src/server/analysis/engine-v2/payloads.ts`
- [ ] T016 [P] Add Engine V2 repository interfaces for canonical, ABI, domain, enrichment, accounting, and read-model tables in `apps/web/src/server/analysis/engine-v2/repositories/types.ts`
- [ ] T017 Implement Engine V2 repository factory using the existing DB client in `apps/web/src/server/analysis/engine-v2/repositories/index.ts`
- [ ] T018 [P] Add provider-boundary adapters for Moralis, Alchemy, explorer/Sourcify, RPC, and LpSugar with DB-first comments and no route exports in `apps/web/src/server/analysis/engine-v2/providers.ts`
- [ ] T019 [P] Add fixture loader for Moralis decoded-history pages and ABI registry fixtures in `apps/web/src/server/analysis/engine-v2/regression/fixtures.ts`
- [ ] T020 [P] Add common Engine V2 test fixture builders in `apps/web/src/server/analysis/engine-v2/test-utils.ts`
- [ ] T021 Add clean-slate Engine V2 purge support with local/dev confirmation flags in `apps/web/src/server/scripts/db-purge.ts`
- [ ] T022 Add repository tests for schema natural keys and chain-scoped identities in `apps/web/src/server/analysis/engine-v2/repositories/repositories.test.ts`
- [ ] T023 Add provider-boundary unit tests proving provider adapters are not exported to route modules in `apps/web/src/server/analysis/engine-v2/providers.test.ts`
- [ ] T024 Add migration smoke test for Engine V2 table names and required indexes in `apps/web/src/server/analysis/engine-v2/repositories/migration-shape.test.ts`

**Checkpoint**: Foundation ready; user stories can now be implemented in priority order.

---

## Phase 3: User Story 1 - Reconstruct Canonical Wallet History (Priority: P1) MVP

**Goal**: Collect Moralis decoded wallet history, persist immutable raw/canonical evidence, dedupe transactions, and stop before semantic DataView totals.

**Independent Test**: Run collection from an empty state against deterministic Moralis decoded-history fixtures and verify raw provider rows, distinct canonical transaction count, chronological order, logs, internal transactions, movements, failed transactions, and duplicate reporting.

**Traceability**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-029, SC-001, SC-002, SC-003.

### Tests for User Story 1

- [ ] T025 [P] [US1] Add collection repository tests for provider page upsert, canonical transaction dedupe, and provider row counts in `apps/web/src/server/analysis/engine-v2/collection/collection.repository.test.ts`
- [ ] T026 [P] [US1] Add Moralis decoded page parser tests using fixture pages in `apps/web/src/server/analysis/engine-v2/collection/moralis-history.test.ts`
- [ ] T027 [P] [US1] Add canonicalization tests for tx/log/internal transaction preservation in `apps/web/src/server/analysis/engine-v2/canonicalization/canonicalize-history.test.ts`
- [ ] T028 [P] [US1] Add movement extraction tests for native, ERC20, ERC721, failed, and zero-value transactions in `apps/web/src/server/analysis/engine-v2/canonicalization/movements.test.ts`
- [ ] T029 [P] [US1] Add Trigger task tests for collection pagination, idempotency, and finalization in `apps/web/src/server/trigger/tasks/engine-v2-collection.test.ts`

### Implementation for User Story 1

- [ ] T030 [US1] Implement collection run and provider page repository methods in `apps/web/src/server/analysis/engine-v2/collection/collection.repository.ts`
- [ ] T031 [US1] Implement Moralis decoded address transaction client and request hashing in `apps/web/src/server/analysis/engine-v2/collection/moralis-history.ts`
- [ ] T032 [US1] Reuse `decodedTransactionsFromPagePayload`, `dedupeDecodedTransactions`, `sortDecodedTransactionsChronologically`, and `normalizeAddress` helpers from `apps/web/src/server/analysis/decoded-history/index.ts` inside `apps/web/src/server/analysis/engine-v2/collection/history-normalizer.ts`
- [ ] T033 [US1] Implement canonical transaction upsert logic with provider row vs distinct tx reporting in `apps/web/src/server/analysis/engine-v2/canonicalization/canonical-transactions.ts`
- [ ] T034 [US1] Implement canonical log and internal transaction persistence in `apps/web/src/server/analysis/engine-v2/canonicalization/canonical-evidence.ts`
- [ ] T035 [US1] Implement canonical movement extraction for native, ERC20, ERC721, share, LP, failed, and unsupported movement evidence in `apps/web/src/server/analysis/engine-v2/canonicalization/canonical-movements.ts`
- [ ] T036 [US1] Implement root canonical call creation from raw transaction input and provider decoded hints in `apps/web/src/server/analysis/engine-v2/canonicalization/canonical-calls.ts`
- [ ] T037 [US1] Implement `engine-v2-collect-decoded-history-page` Trigger task in `apps/web/src/server/trigger/tasks/engine-v2-collection.task.ts`
- [ ] T038 [US1] Implement `engine-v2-finalize-collection` Trigger task and collection progress updates in `apps/web/src/server/trigger/tasks/engine-v2-collection.task.ts`
- [ ] T039 [US1] Implement `engine-v2-canonicalize-history` Trigger task in `apps/web/src/server/trigger/tasks/engine-v2-canonicalize.task.ts`
- [ ] T040 [US1] Add US1 fixture regression assertions to `apps/web/src/server/analysis/engine-v2/regression/canonical-history-regression.ts`

**Checkpoint**: US1 produces a replayable canonical wallet history with no semantic totals.

---

## Phase 4: User Story 2 - Classify Protocol Activity Chronologically (Priority: P1)

**Goal**: Decode ABI-backed direct and nested calls, classify every canonical transaction oldest to newest, emit domain events/links/traces, and handle all supported protocol categories without invented heuristics.

**Independent Test**: Process a canonical fixture chronologically and verify failed tx, cash-in/out, approvals, swaps, manual deposits, strategies, governance locks/votes/pokes/managed deposits/claims/rebases, unsupported/excluded rows, and unresolved ABI gaps.

**Traceability**: FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-014, FR-015, FR-016, FR-017, FR-018, FR-021, FR-021a, FR-022, FR-023, FR-024, FR-029, FR-030, SC-004, SC-010, SC-011, SC-012, SC-013, SC-014.

### Tests for User Story 2

- [ ] T041 [P] [US2] Add ABI registry repository tests for DB-first lookup, explorer miss handling, selector/event persistence, and proxy metadata in `apps/web/src/server/analysis/engine-v2/abi-registry/abi-registry.repository.test.ts`
- [ ] T042 [P] [US2] Add canonical call decoder tests for direct calls, `multicall(bytes[])` child calls, and batch/router target-specific nested calls in `apps/web/src/server/analysis/engine-v2/classification/canonical-call-decoder.test.ts`
- [ ] T043 [P] [US2] Add base classifier tests for failed tx, approvals, cash-in/out, swaps, unsupported, excluded, and unresolved rows in `apps/web/src/server/analysis/engine-v2/classification/base-classifiers.test.ts`
- [ ] T044 [P] [US2] Add manual Aerodrome deposit classifier tests for tokenId identity and governance vote/poke internal log exclusion in `apps/web/src/server/analysis/engine-v2/classification/manual-deposit-classifier.test.ts`
- [ ] T045 [P] [US2] Add Mellow strategy classifier tests proving wrapper/share activity does not become manual deposit activity in `apps/web/src/server/analysis/engine-v2/classification/strategy-classifier.test.ts`
- [ ] T046 [P] [US2] Add governance classifier tests for createLock, increase, extend, vote, poke, depositManaged, claimBribes, claimFees, and RewardsDistributor rebase in `apps/web/src/server/analysis/engine-v2/classification/governance-classifier.test.ts`
- [ ] T047 [P] [US2] Add domain event repository tests for parent/child events and explicit entity links in `apps/web/src/server/analysis/engine-v2/classification/domain-events.repository.test.ts`
- [ ] T048 [P] [US2] Add Trigger task tests for chronological ordering and classifier version replay in `apps/web/src/server/trigger/tasks/engine-v2-classification.test.ts`

### Implementation for User Story 2

- [ ] T049 [US2] Implement DB-backed ABI registry repository using `fetchVerifiedContractAbi` helper semantics in `apps/web/src/server/analysis/engine-v2/abi-registry/abi-registry.repository.ts`
- [ ] T050 [US2] Implement selector and event topic indexing from persisted ABIs in `apps/web/src/server/analysis/engine-v2/abi-registry/selector-event-index.ts`
- [ ] T051 [US2] Implement protocol bootstrap service for core Aerodrome/Mellow contracts and protocol known-address provenance without hardcoding user pools or strategies in `apps/web/src/server/analysis/engine-v2/abi-registry/protocol-bootstrap.ts`
- [ ] T052 [US2] Implement direct, multicall, batch, and router target-specific nested canonical call decoder using DB ABI records and `decodeTransactionInput` helper semantics in `apps/web/src/server/analysis/engine-v2/classification/canonical-call-decoder.ts`
- [ ] T053 [US2] Implement domain event and domain event link repository methods in `apps/web/src/server/analysis/engine-v2/classification/domain-events.repository.ts`
- [ ] T054 [US2] Implement chronological classifier orchestrator and state context in `apps/web/src/server/analysis/engine-v2/classification/chronological-classifier.ts`
- [ ] T055 [US2] Implement base classifiers for failed tx, approvals, cash-in/out, swaps, unsupported, excluded, and unresolved rows in `apps/web/src/server/analysis/engine-v2/classification/base-classifiers.ts`
- [ ] T056 [US2] Implement manual Aerodrome deposit and gauge classifiers with tokenId ownership and vote/poke internal log guards in `apps/web/src/server/analysis/engine-v2/classification/manual-deposit-classifier.ts`
- [ ] T057 [US2] Implement Mellow strategy wrapper/share/staking reward classifiers in `apps/web/src/server/analysis/engine-v2/classification/strategy-classifier.ts`
- [ ] T058 [US2] Implement governance lock, vote, poke, depositManaged, claimBribes, claimFees, and rebase classifiers in `apps/web/src/server/analysis/engine-v2/classification/governance-classifier.ts`
- [ ] T059 [US2] Implement classification trace persistence with matched rule, evidence, coverage, confidence, and reason codes in `apps/web/src/server/analysis/engine-v2/classification/classification-trace.ts`
- [ ] T060 [US2] Implement `engine-v2-protocol-bootstrap`, `engine-v2-ensure-abi-registry`, and `engine-v2-decode-canonical-calls` Trigger tasks in `apps/web/src/server/trigger/tasks/engine-v2-decode.task.ts`
- [ ] T061 [US2] Implement `engine-v2-classify-chronological` Trigger task in `apps/web/src/server/trigger/tasks/engine-v2-classification.task.ts`
- [ ] T062 [US2] Add US2 fixture regression assertions to `apps/web/src/server/analysis/engine-v2/regression/classification-regression.ts`

**Checkpoint**: US2 can classify canonical history into evidence-backed domain events without read models.

---

## Phase 5: User Story 3 - Enrich Missing Evidence Without Guessing (Priority: P2)

**Goal**: Persist deduplicated enrichment needs and resolve missing ABI, token, price, pool, lock, distributor, strategy, and current-state evidence through DB-first analysis-time workers.

**Independent Test**: Feed classified/unresolved fixture data and verify deduplicated enrichment needs, provider request persistence, conflict handling, and no fabricated ownership/value links.

**Traceability**: FR-013, FR-014, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-028, FR-029, FR-030, SC-005, SC-010, SC-012, SC-013, SC-014, SC-015.

### Tests for User Story 3

- [ ] T063 [P] [US3] Add enrichment need planner tests for ABI, token metadata, historical price, pool definition, lock identity, distributor link, strategy state, and LpSugar need dedupe in `apps/web/src/server/analysis/engine-v2/enrichment/enrichment-planner.test.ts`
- [ ] T064 [P] [US3] Add token metadata worker tests for batched metadata persistence and spam-hint handling in `apps/web/src/server/analysis/engine-v2/enrichment/token-metadata.worker.test.ts`
- [ ] T065 [P] [US3] Add price enrichment tests for historical/current separation, unavailable valuation, and provider divergence reason codes in `apps/web/src/server/analysis/engine-v2/enrichment/pricing.worker.test.ts`
- [ ] T066 [P] [US3] Add pool definition and distributor mapping tests using explicit pool contracts and `Voter.GaugeCreated` evidence in `apps/web/src/server/analysis/engine-v2/enrichment/pool-enrichment.test.ts`
- [ ] T067 [P] [US3] Add lock identity backfill tests for unseen governance lock tokenId, NFT transfer history, decoded tx backfill, and protocol grant evidence in `apps/web/src/server/analysis/engine-v2/enrichment/lock-identity-backfill.test.ts`
- [ ] T068 [P] [US3] Add managed/relay current-state tests for `userTokenId -> managedTokenId` persistence and no managed-token ownership merge in `apps/web/src/server/analysis/engine-v2/enrichment/managed-lock-state.test.ts`
- [ ] T069 [P] [US3] Add strategy current-state and LpSugar tests proving current state cannot create lifecycle ownership in `apps/web/src/server/analysis/engine-v2/enrichment/strategy-state.worker.test.ts`
- [ ] T070 [P] [US3] Add enrichment Trigger task tests for bounded batches, retry timing, provider failure, and DB-first cache hits in `apps/web/src/server/trigger/tasks/engine-v2-enrichment.test.ts`

### Implementation for User Story 3

- [ ] T071 [US3] Implement enrichment needs repository and natural dedupe keys in `apps/web/src/server/analysis/engine-v2/enrichment/enrichment.repository.ts`
- [ ] T072 [US3] Implement enrichment planner for ABI, selector, token metadata, price, pool, lock, distributor, strategy, LpSugar, log, and tx decoded gaps in `apps/web/src/server/analysis/engine-v2/enrichment/enrichment-planner.ts`
- [ ] T073 [US3] Implement token metadata worker using batched provider calls with metadata evidence persistence in `apps/web/src/server/analysis/engine-v2/enrichment/token-metadata.worker.ts`
- [ ] T074 [US3] Implement historical and current pricing workers with Alchemy primary and Moralis block-price validation/fallback metadata in `apps/web/src/server/analysis/engine-v2/enrichment/pricing.worker.ts`
- [ ] T075 [US3] Implement pool definition worker for token0/token1/tickSpacing/fee tier/gauge/distributor/current state in `apps/web/src/server/analysis/engine-v2/enrichment/pool-enrichment.worker.ts`
- [ ] T076 [US3] Implement distributor-to-pool link builder from `Voter.GaugeCreated` or equivalent registry evidence in `apps/web/src/server/analysis/engine-v2/enrichment/distributor-pool-links.ts`
- [ ] T077 [US3] Implement lock identity backfill using DB-first canonical logs, cached NFT transfer history, tx decoded backfill, protocol known-address evidence, and optional `eth_getLogs` fallback in `apps/web/src/server/analysis/engine-v2/enrichment/lock-identity-backfill.ts`
- [ ] T078 [US3] Implement managed/relay state worker for Aerodrome helper/sugar and VotingEscrow state snapshots in `apps/web/src/server/analysis/engine-v2/enrichment/managed-lock-state.worker.ts`
- [ ] T079 [US3] Implement strategy current-state worker for wrapper/share/staking/LpSugar evidence after strategy identity discovery in `apps/web/src/server/analysis/engine-v2/enrichment/strategy-state.worker.ts`
- [ ] T080 [US3] Implement conflict preservation and coverage downgrade logic for conflicting enrichment evidence in `apps/web/src/server/analysis/engine-v2/enrichment/evidence-conflicts.ts`
- [ ] T081 [US3] Implement `engine-v2-plan-enrichment` and `engine-v2-run-enrichment-batch` Trigger tasks in `apps/web/src/server/trigger/tasks/engine-v2-enrichment.task.ts`
- [ ] T082 [US3] Add US3 fixture regression assertions to `apps/web/src/server/analysis/engine-v2/regression/enrichment-regression.ts`

**Checkpoint**: US3 can improve partial rows through persisted evidence and leaves unresolved gaps visible when evidence is missing.

---

## Phase 6: User Story 4 - Materialize DataView Read Models (Priority: P2)

**Goal**: Run chronological accounting and materialize Activity, Deposits, Strategies, Pools, Rewards, and Governance read models from the same domain-event source with no double counting.

**Independent Test**: Materialize read models from classified/enriched fixture data and verify cross-surface reconciliation, explicit entity links, historical/current value separation, and DB-only route consumption.

**Traceability**: FR-019, FR-020, FR-025, FR-026, FR-027, FR-028, FR-030, SC-006, SC-007, SC-008, SC-009, SC-015, SC-016.

### Tests for User Story 4

- [ ] T083 [P] [US4] Add accounting lot and residual inventory tests for chronological cash-in/out, swaps, withdrawals, and unresolved allocation in `apps/web/src/server/analysis/engine-v2/accounting/accounting-lots.test.ts`
- [ ] T084 [P] [US4] Add manual deposit accounting tests for opened/increased/decreased/collected/closed values and range coverage in `apps/web/src/server/analysis/engine-v2/accounting/deposit-accounting.test.ts`
- [ ] T085 [P] [US4] Add strategy accounting tests for share-level deposits, withdrawals, current shares, rewards, and coverage states in `apps/web/src/server/analysis/engine-v2/accounting/strategy-accounting.test.ts`
- [ ] T086 [P] [US4] Add pool accounting tests for explicit manual/strategy/governance/residual aggregation and no token-pair/time inference in `apps/web/src/server/analysis/engine-v2/accounting/pool-accounting.test.ts`
- [ ] T087 [P] [US4] Add reward accounting tests for one-count-only totals, unresolved pool contribution, excluded rows, and non-liquid rebases in `apps/web/src/server/analysis/engine-v2/accounting/reward-accounting.test.ts`
- [ ] T088 [P] [US4] Add governance accounting tests for locks, managed links, epochs, votes, claim items, rebases, and identity separation in `apps/web/src/server/analysis/engine-v2/accounting/governance-accounting.test.ts`
- [ ] T089 [P] [US4] Add DataView materializer tests for Activity, Deposits, Strategies, Pools, Rewards, and Governance outputs in `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.test.ts`
- [ ] T090 [P] [US4] Add DB-only route tests proving DataView services do not import provider clients in `apps/web/src/server/analysis/engine-v2/materializers/db-only-read-models.test.ts`
- [ ] T091 [P] [US4] Add Trigger task tests for accounting/materialization order and partial completion in `apps/web/src/server/trigger/tasks/engine-v2-materialization.test.ts`

### Implementation for User Story 4

- [ ] T092 [US4] Implement accounting lot and residual inventory repositories in `apps/web/src/server/analysis/engine-v2/accounting/accounting.repository.ts`
- [ ] T093 [US4] Implement chronological accounting orchestrator that processes domain events oldest to newest in `apps/web/src/server/analysis/engine-v2/accounting/chronological-accounting.ts`
- [ ] T094 [US4] Implement cash-in/out, gas/native transfer, swap, and residual inventory accounting in `apps/web/src/server/analysis/engine-v2/accounting/cash-residual-accounting.ts`
- [ ] T095 [US4] Implement manual deposit accounting and lifecycle projection to existing deposit read-model tables in `apps/web/src/server/analysis/engine-v2/accounting/deposit-accounting.ts`
- [ ] T096 [US4] Implement strategy share-level accounting and projection to existing strategy read-model tables in `apps/web/src/server/analysis/engine-v2/accounting/strategy-accounting.ts`
- [ ] T097 [US4] Implement pool aggregation from explicit links and pool definition evidence in `apps/web/src/server/analysis/engine-v2/accounting/pool-accounting.ts`
- [ ] T098 [US4] Implement reward accounting with affectsTotals, poolContribution, unresolved, excluded, and no-double-count logic in `apps/web/src/server/analysis/engine-v2/accounting/reward-accounting.ts`
- [ ] T099 [US4] Implement governance accounting for locks, managed links, epochs, vote context, claim items, rebase relocks, and governance return in `apps/web/src/server/analysis/engine-v2/accounting/governance-accounting.ts`
- [ ] T100 [US4] Implement Activity read-model materializer with selected-detail evidence for every canonical row in `apps/web/src/server/analysis/engine-v2/materializers/activity-materializer.ts`
- [ ] T101 [US4] Implement Deposits, Strategies, Pools, Rewards, and Governance read-model materializers in `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- [ ] T102 [US4] Wire existing Activity repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/activity/activity.repository.ts`
- [ ] T103 [US4] Implement shared read-model adapter contracts for existing DataView repositories in `apps/web/src/server/analysis/engine-v2/materializers/read-model-adapters.ts`
- [ ] T136 [US4] Wire existing Deposits repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/deposits/deposits.repository.ts`
- [ ] T137 [US4] Wire existing Strategies repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/strategies/strategies.repository.ts`
- [ ] T138 [US4] Wire existing Pools repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/pools/pools.repository.ts`
- [ ] T139 [US4] Wire existing Rewards repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/rewards/rewards.repository.ts`
- [ ] T140 [US4] Wire existing Governance repository/service to consume Engine V2 materialized DB outputs without provider calls in `apps/web/src/server/governance/governance.repository.ts`
- [ ] T104 [US4] Implement `engine-v2-account-chronological` and `engine-v2-materialize-read-models` Trigger tasks in `apps/web/src/server/trigger/tasks/engine-v2-materialization.task.ts`
- [ ] T105 [US4] Add US4 cross-surface reconciliation regression assertions to `apps/web/src/server/analysis/engine-v2/regression/read-model-regression.ts`

**Checkpoint**: US4 powers the DataViews from Engine V2 materialized DB outputs, with Overview still out of scope.

---

## Phase 7: User Story 5 - Preserve Evidence, Coverage, And Regression Safety (Priority: P3)

**Goal**: Make Engine V2 reproducible, explainable, regression-safe, deployable through Trigger, and guarded against provider calls in request-time paths.

**Independent Test**: Run saved decoded-history fixtures and confirm every supported family and known bug class is classified, enriched, accounted, materialized, excluded, unsupported, or unresolved with stable reason codes and DB-only read paths.

**Traceability**: FR-007, FR-014, FR-015, FR-028, FR-029, FR-030, SC-001 through SC-016.

### Tests for User Story 5

- [ ] T106 [P] [US5] Add full Engine V2 regression suite tests for native transfers, approvals, swaps, failed calls, unsupported transfers, manual deposits, strategies, governance, rewards, spam, and accounting in `apps/web/src/server/analysis/engine-v2/regression/engine-v2-regression.test.ts`
- [ ] T107 [P] [US5] Add known bug regression tests for lock origin backfill, grant transfer-in, direct vs managed lock identity, claimBribes items, claimFees multicall, rebase relock, and distributor mapping in `apps/web/src/server/analysis/engine-v2/regression/known-bugs-regression.test.ts`
- [ ] T108 [P] [US5] Add no-provider-at-request static/import guard tests for Activity, Deposits, Strategies, Pools, Rewards, and Governance routes in `apps/web/src/server/analysis/engine-v2/regression/db-only-routes.test.ts`
- [ ] T109 [P] [US5] Add Trigger orchestration tests for start, cancellation, idempotency keys, retryable failures, partial completion, and legacy fallback flag in `apps/web/src/server/trigger/tasks/engine-v2-orchestration.test.ts`
- [ ] T110 [P] [US5] Add CLI command tests for `analysis:v2:run`, `analysis:v2:regression`, and guarded `db:purge --scope engine-v2` behavior in `apps/web/src/server/analysis/engine-v2/regression/cli-commands.test.ts`

### Implementation for User Story 5

- [ ] T111 [US5] Implement Engine V2 regression runner that composes canonical, classification, enrichment, accounting, and read-model regressions in `apps/web/src/server/analysis/engine-v2/regression/engine-v2-regression.ts`
- [ ] T112 [US5] Implement `analysis-engine-v2-regression.ts` CLI command using fixture pages and persisted ABI fixtures in `apps/web/src/server/scripts/analysis-engine-v2-regression.ts`
- [ ] T113 [US5] Implement `analysis-engine-v2-run.ts` CLI command to start fresh, incremental, reanalysis, and fixture modes in `apps/web/src/server/scripts/analysis-engine-v2-run.ts`
- [ ] T114 [US5] Update `analysis-run.task.ts` to orchestrate Engine V2 tasks behind explicit mode/feature flag and preserve legacy rollback mode in `apps/web/src/server/trigger/tasks/analysis-run.task.ts`
- [ ] T115 [US5] Add Engine V2 task exports/discovery verification without changing `trigger.config.ts` semantics in `apps/web/src/server/trigger/tasks/engine-v2-index.task.ts`
- [ ] T116 [US5] Add stable reason-code to i18n key mapping for new Engine V2 coverage/confidence statuses in `apps/web/src/i18n/locales/en/analysis.json`
- [ ] T117 [US5] Add Spanish parity for new Engine V2 reason-code and status keys in `apps/web/src/i18n/locales/es/analysis.json`
- [ ] T118 [US5] Add provider queue audit coverage for Engine V2 enrichment needs and request-time DB-only reads in `apps/web/src/server/scripts/analysis-provider-queue-audit.ts`
- [ ] T119 [US5] Update quickstart validation commands and skipped-check reporting for Engine V2 in `specs/016-analysis-engine-v2/quickstart.md`

**Checkpoint**: US5 proves Engine V2 is reproducible, auditable, deployable, and guarded against the known drift classes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, validation, cleanup, and operational signoff.

- [ ] T120 [P] Update Engine V2 implementation notes and remaining limitations in `docs/brief-spec-engine-v2-refactor.md`
- [ ] T121 [P] Update provider/source ownership notes for Moralis, Alchemy, BaseScan/Sourcify, RPC, and LpSugar in `docs/plan-refactor-engine-procesador-transacciones.md`
- [ ] T122 [P] Update enrichment/accounting/read-model notes after implementation in `docs/plan-refactor-engine-enrichment-accounting.md`
- [ ] T123 [P] Update bug/gap closure notes for implemented edgecases in `docs/informe-engine-v2-bugs-gaps.md`
- [ ] T124 Run `pnpm db:migrate` from `apps/web` and record migration result in `specs/016-analysis-engine-v2/quickstart.md`
- [ ] T125 Run `pnpm typecheck` from `apps/web` and record result in `specs/016-analysis-engine-v2/quickstart.md`
- [ ] T126 Run `pnpm test:unit` from `apps/web` and record result in `specs/016-analysis-engine-v2/quickstart.md`
- [ ] T127 Run `pnpm analysis:v2:regression` from `apps/web` and record result in `specs/016-analysis-engine-v2/quickstart.md`
- [ ] T128 Run `pnpm i18n:check` and `pnpm ds:check` from `apps/web` and record results in `specs/016-analysis-engine-v2/quickstart.md`
- [ ] T129 Verify no Playwright/browser E2E/a11y tasks or scripts were added as Engine V2 release gates in `specs/016-analysis-engine-v2/tasks.md`
- [ ] T130 Verify request-time DataView APIs remain DB-only and document manual UI smoke notes in `specs/016-analysis-engine-v2/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2.
- **US2 (Phase 4)**: Depends on US1 canonical history and Phase 2 ABI/schema foundations.
- **US3 (Phase 5)**: Depends on US2 domain events and enrichment gaps.
- **US4 (Phase 6)**: Depends on US2 domain events and US3 enrichment outputs; can begin partial materializer scaffolding after Phase 2 but cannot complete before US3.
- **US5 (Phase 7)**: Depends on US1-US4 outputs.
- **Phase 8 Polish**: Depends on selected implemented scope, with final validation after US5.

### User Story Dependencies

- **US1 Reconstruct Canonical Wallet History**: MVP and prerequisite for every other story.
- **US2 Classify Protocol Activity Chronologically**: Builds on canonical rows; enables domain events.
- **US3 Enrich Missing Evidence Without Guessing**: Builds on classification gaps and entity references.
- **US4 Materialize DataView Read Models**: Builds on domain events, enrichment, and accounting.
- **US5 Preserve Evidence, Coverage, And Regression Safety**: Hardens all previous stories and prepares cutover.

### Within Each User Story

- Tests first, before implementation tasks.
- Repositories/schema before services.
- Services before Trigger tasks.
- Trigger tasks before CLI/regression end-to-end validation.
- Read-model materializers before route/repository cutover.

---

## Parallel Execution Examples

### User Story 1

```text
Parallel after Phase 2:
- T025 collection repository tests
- T026 Moralis parser tests
- T027 canonicalization tests
- T028 movement extraction tests
- T029 collection Trigger task tests
```

### User Story 2

```text
Parallel after US1:
- T041 ABI registry tests
- T042 canonical call decoder tests
- T043 base classifier tests
- T044 manual deposit classifier tests
- T045 strategy classifier tests
- T046 governance classifier tests
- T047 domain event repository tests
- T048 classification Trigger task tests
```

### User Story 3

```text
Parallel after US2:
- T063 enrichment planner tests
- T064 token metadata worker tests
- T065 pricing worker tests
- T066 pool enrichment tests
- T067 lock identity backfill tests
- T068 managed lock state tests
- T069 strategy state worker tests
- T070 enrichment Trigger task tests
```

### User Story 4

```text
Parallel after US2/US3 interfaces are stable:
- T083 accounting lot tests
- T084 deposit accounting tests
- T085 strategy accounting tests
- T086 pool accounting tests
- T087 reward accounting tests
- T088 governance accounting tests
- T089 materializer tests
- T090 DB-only route tests
- T091 materialization Trigger task tests
```

### User Story 5

```text
Parallel after US4:
- T106 full regression suite tests
- T107 known bug regression tests
- T108 DB-only route guard tests
- T109 Trigger orchestration tests
- T110 CLI command tests
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Validate canonical history from fixtures with no DataView totals.
4. Stop and inspect provider row count, distinct tx count, failed tx, logs, internal tx, movements, and source evidence.

### Incremental Delivery

1. US1: Immutable canonical wallet history.
2. US2: Chronological domain event classification.
3. US3: DB-first enrichment and evidence gaps.
4. US4: Accounting and DataView read models.
5. US5: Regression safety, Trigger orchestration, CLI commands, cutover readiness.

### Cutover Strategy

1. Implement Engine V2 alongside legacy phases.
2. Route `analysis-run.task.ts` to V2 only behind explicit mode/feature flag.
3. Run fixture regression and DB-only route checks.
4. Enable V2 as default analysis path.
5. Keep legacy phases available only as rollback until V2 signoff.

---

## Notes

- Do not implement provider calls in DataView request paths.
- Do not infer ownership, pool, reward, epoch, lock, deposit, or strategy association from pool + time window.
- Do not use current prices for historical values.
- Do not merge direct locks, deposited user locks, and managed token ids without explicit evidence.
- Do not convert strategy-owned internal pool logs into manual deposits.
- Do not add Playwright, browser E2E, or automated browser/a11y tasks as release gates.
