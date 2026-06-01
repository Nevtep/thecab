# Script-to-Runtime Gaps

Date: 2026-06-01

## Purpose

This note captures the current gaps between the validated research/script path and the production Engine V2 runtime so the implementation can continue without losing context.

It is intentionally implementation-oriented. Each gap includes:

- what the validated research path proved;
- what the current runtime does instead;
- why that difference matters;
- the concrete implementation steps needed to close it.

## Context

Authoritative context for this note is the brief spec plus the validated research/runtime evidence listed below.

Other planning artifacts under `specs/016-analysis-engine-v2/` are not treated as authoritative here. They were too shallow to reliably represent the actual implementation requirements or completion state.

The validated research path is represented primarily by:

- `scripts/research/analyze-decoded-history.ts`
- `scripts/research/fetch-protocol-abis.ts`
- `apps/web/src/server/analysis/decoded-history/*`
- `docs/brief-spec-engine-v2-refactor.md`

The production runtime path is represented primarily by:

- `apps/web/src/server/trigger/tasks/analysis-run.task.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-*.task.ts`
- `apps/web/src/server/analysis/engine-v2/*`
- `apps/web/src/server/{activity,rewards,pools,deposits,strategies,governance}/*`

## Gap 1: Incremental Collection Boundary Is Missing

### Validated behavior

The intended runtime flow is:

- when no prior processed tx exists, collect from the latest wallet history without `from_block`;
- when prior processed tx exists, collect only from the latest processed block forward;
- use Moralis decoded history `/api/v2.2/{address}/verbose` with `order=ASC` and `include=internal_transactions`;
- persist raw pages and avoid unnecessary recollection.

### Current runtime behavior

The runtime collector correctly uses `/verbose`, `order=ASC`, and `include=internal_transactions`, but it does not add `from_block` and does not read the latest processed canonical boundary before starting collection.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/collection/moralis-history.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-collection.task.ts`
- `apps/web/src/server/analysis/engine-v2/payloads.ts`

### Why this matters

Without `from_block`, every incremental run behaves like a broader historical recollection than intended. That increases provider dependence, increases collection cost, and weakens the DB-first incremental model described by the spec and research.

### Implementation steps

1. Add a collection repository helper that returns the latest processed canonical transaction boundary for `(chainId, walletAddress)` from `canonical_transactions`.
2. Extend the Moralis request input and request hashing in `apps/web/src/server/analysis/engine-v2/collection/moralis-history.ts` to support `from_block`.
3. Thread the effective start boundary through `analysis-run.task.ts` and `engine-v2-collection.task.ts`.
4. Use `mode` explicitly:
   - `fresh`: omit `from_block`
   - `incremental`: include `from_block`
   - `reanalysis`: skip recollection unless explicitly requested
5. Persist the effective query, including `from_block`, in the collection run row and provider page rows.
6. Add focused tests for first-run, incremental-run, and reanalysis collection semantics.

## Gap 2: Dedupe From The Research Path Is Not Applied In Main Collection/Canonicalization Flow

### Validated behavior

The research script explicitly does:

- parse provider rows;
- dedupe by transaction identity;
- sort chronologically;
- classify only after dedupe.

Relevant file:

- `scripts/research/analyze-decoded-history.ts`

### Current runtime behavior

The runtime re-exports `dedupeDecodedTransactions`, but the main collection/canonicalization flow does not apply it before summarizing provider pages or canonicalizing transactions.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/collection/history-normalizer.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-collection.task.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-canonicalize.task.ts`

### Why this matters

The provider fixture and local research already established that dedupe is part of the validated path. If the runtime does not use the same normalization order, canonical counts and downstream diagnostics can drift from the research baseline.

### Implementation steps

1. Apply `dedupeDecodedTransactions` to the flattened provider-page transaction set before computing collection summary counts.
2. Apply the same dedupe before canonicalization, not only chronological sorting.
3. Ensure canonical upserts and summary counts share the same normalized transaction list.
4. Add a regression test with duplicated tx hashes across mock provider pages.

## Gap 3: The Runtime Does Not Persist The Full Tx-Level Classified Snapshot Used In Research

### Validated behavior

The research script builds a rich classified transaction row via `buildClassifiedDecodedTransaction`, including:

- tx identity and chronology;
- selector;
- contract label/name;
- decoded function and args;
- transfer counts;
- approval counts;
- classification;
- confidence;
- reason;
- `needsResolution`.

Relevant files:

- `scripts/research/analyze-decoded-history.ts`
- `apps/web/src/server/analysis/decoded-history/classifier.ts`

### Current runtime behavior

The runtime persists:

- canonical transaction rows;
- domain events;
- classification traces.

But it does not persist the full tx-level classified snapshot in one queryable structure.

Relevant files:

- `apps/web/src/server/db/schema.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-classification.task.ts`

### Why this matters

The tx-level classified snapshot is the most useful debugging and regression object from the research path. Without persisting it, it is harder to compare runtime output against the validated wallet report and harder to explain unresolved selectors or classification drift.

### Implementation steps

1. Introduce a dedicated engine-v2 classified-transaction table, or an equivalent persisted structure tightly keyed to canonical transactions.
2. Persist the fields currently emitted by `buildClassifiedDecodedTransaction`.
3. Keep `engine_v2_domain_events` as the lifecycle/event layer; do not collapse domain events back into one-tx rows.
4. Write the classified snapshot during `engine-v2-classify-chronological`.
5. Add indexes by wallet, tx hash, classification, selector, and classifier version.

## Gap 4: Runtime Classification Reuses The Core Helper, But Not The Full Research Snapshot Builder

### Validated behavior

The research path uses one consistent helper chain:

- decode input;
- classify decoded transaction;
- build the full classified snapshot;
- summarize unresolved selectors and no-unknowns coverage.

### Current runtime behavior

The runtime reuses `classifyDecodedTransaction`, but maps it into `EngineV2Classification` through a separate production layer. This is structurally reasonable, but it means the production path can drift from the research snapshot path over time.

Relevant files:

- `apps/web/src/server/analysis/decoded-history/classifier.ts`
- `apps/web/src/server/analysis/engine-v2/classification/base-classifiers.ts`

### Why this matters

The closer runtime stays to the exact research helper chain, the easier it is to preserve the wallet-level validated result and to explain differences.

### Implementation steps

1. Factor a production-safe tx-level snapshot builder from the existing `decoded-history` classifier helper chain.
2. Have `base-classifiers.ts` derive `EngineV2Classification` from that snapshot instead of reconstructing parts of the same logic independently.
3. Reuse the same snapshot in regression scripts, CLI diagnostics, and persisted classified-tx rows.

## Gap 5: ABI-Aware Regression Parity Is Missing

### Validated behavior

The research classification result depended on a real ABI registry built from verified ABIs.

Relevant files:

- `scripts/research/analyze-decoded-history.ts`
- `scripts/research/fetch-protocol-abis.ts`
- `docs/api-research/abis/protocol-abi-registry.json`

### Current runtime behavior

The current engine-v2 classification regression runs with `registry: new Map()` instead of loading the fixture ABI registry.

Relevant file:

- `apps/web/src/server/analysis/engine-v2/regression/classification-regression.ts`

### Why this matters

The current regression is not asserting the same condition that the research proved. It can pass while the ABI-aware wallet classification guarantee has regressed.

### Implementation steps

1. Load the fixture ABI registry in the runtime regression path using the same ABI artifact inputs used by the research script.
2. Build the registry through `buildRegistryMap` from `apps/web/src/server/analysis/decoded-history/abi-registry.ts`.
3. Feed that registry into `classifyTransactionsChronologically`.
4. Add explicit assertions for:
   - no `unclassified_transaction`
   - no `protocol_contract_call_unmapped`
   - stable governance/manual-position/strategy counts for the validated wallet fixtures
5. Treat this regression as a signoff gate for engine-v2 classification changes.

## Gap 6: ABI Auto-Discovery Is Too Narrow Compared To The Research Intent

### Validated behavior

The research direction assumes the runtime should discover relevant protocol contracts from observed evidence, persist their ABIs, and reuse them DB-first.

### Current runtime behavior

The runtime fetches ABIs DB-first correctly, but observed contract discovery is currently limited to:

- transaction `to` addresses for non-transfer/non-approval calls;
- approval spenders.

It does not yet promote broader discovery from protocol event emitters and canonical log evidence.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/abi-registry/protocol-bootstrap.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-decode.task.ts`

### Why this matters

Some critical protocol surfaces appear first in logs or secondary evidence rather than as the root transaction target. Without broader discovery, runtime ABI coverage can lag behind the research path.

### Implementation steps

1. Extend observed ABI seeding to inspect canonical logs and decoded events, not only tx targets and approval spenders.
2. Promote discovery from:
   - pool addresses emitting protocol events;
   - gauge addresses;
   - bribe and fee distributor addresses;
   - reward distributor addresses;
   - wrapper/share contracts inferred from transfer evidence.
3. Persist discovery provenance in ABI or known-address metadata.
4. Add tests proving that contracts discovered only through log evidence still become ABI seeds.

## Gap 7: Enrichment Does Not Drain Before Accounting

### Validated behavior

The intended engine order is:

- classify;
- identify required enrichments;
- resolve necessary enrichments;
- account chronologically using the resolved evidence.

### Current runtime behavior

The enrichment batch task resolves only `limit` queued needs, then immediately triggers accounting.

Relevant file:

- `apps/web/src/server/trigger/tasks/engine-v2-enrichment.task.ts`

### Why this matters

Accounting and materialization can run while required historical prices, lock identity backfills, or pool definitions are still queued. That weakens the determinism of downstream read models.

### Implementation steps

1. After each enrichment batch, re-check the queue.
2. If queued needs remain, re-trigger `engine-v2-run-enrichment-batch`.
3. Only trigger accounting once the queue is drained, or once only explicitly non-blocking unresolved needs remain.
4. Define which need types are accounting-blocking.
5. Add multi-batch tests proving that accounting waits for required enrichment completion.

## Gap 8: Governance Still Assumes A Single Lock Instead Of A Lock Set

### Validated behavior

The governance model must preserve explicit lock identities, including documented edge cases such as:

- direct wallet-owned voting lock;
- protocol-grant or distributed lock;
- lock deposited into managed or relay flow;
- separate managed token identity;
- partial lock shells/backfills when lifecycle origin is missing.

The governance dataview should show all relevant locks, not collapse them into one `Estado del lock` card.

### Current runtime behavior

The current governance request and read-model path still assumes a single lock:

- the response contract exposes only one `lockPanel`;
- the engine-v2 repository selects the first lock row with `.find(...)`;
- the legacy repository path uses `.limit(1)`;
- governance summary materialization reads from `lockRows[0]`.

This matches the current observed bug: the screen can show a relay-deposited or grant-derived lock while hiding the actual direct wallet-owned lock used for voting and claiming.

Relevant files:

- `apps/web/src/server/governance/governance.types.ts`
- `apps/web/src/server/governance/governance.repository.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/trigger/tasks/engine-v2-enrichment.task.ts`

### Why this matters

This is not a cosmetic issue. It makes the governance surface materially misleading by showing the wrong lock as the wallet's effective governance identity.

### Implementation steps

1. Change the governance response model from singular `lockPanel` to a lock collection, plus an explicit selected or primary lock concept if the UI still wants one highlighted lock.
2. Preserve one materialized governance lock row per explicit lock identity.
3. Stop selecting the first lock arbitrarily in the repository.
4. Introduce deterministic lock ordering rules:
   - direct active voting lock first
   - other direct locks next
   - deposited-managed user locks next
   - managed or relay shells next
   - withdrawn or partial shells last
5. Update summary KPI computation so it aggregates from the correct direct-lock set or an explicitly chosen primary direct lock, not `lockRows[0]`.
6. Update the governance dataview to list all locks and clearly distinguish:
   - direct wallet-owned voting lock
   - deposited-managed lock
   - managed or relay lock
   - protocol-grant lock
7. Add regression coverage for a wallet with both:
   - a direct lock used to vote and claim;
   - a separate distributed lock later deposited into managed or relay flow.

## Gap 9: Research-Grade Diagnostics Are Not Yet First-Class In Runtime

### Validated behavior

The research script produced useful diagnostics such as:

- classification summary counts;
- confidence distribution;
- unresolved selector list;
- example tx hashes and reasons.

### Current runtime behavior

Runtime persists enough raw information to reconstruct these diagnostics, but it does not currently expose or persist a research-grade diagnostics summary as a first-class artifact.

### Why this matters

These diagnostics are essential when closing the last unknowns and when proving parity with the validated wallet report.

### Implementation steps

1. Add a CLI or regression diagnostics command that rebuilds unresolved-selector and classification summaries from persisted engine-v2 data.
2. Base it on the tx-level classified snapshot described in Gap 3.
3. Make the output usable as a regression artifact for feature review.

## Gap 10: No Unknown Transactions Are Acceptable On The Validated Wallet Fixture

### Validated behavior

The validated research path classified all transactions for the analyzed wallet without unknowns once decoded history and verified ABIs were available.

Concrete example:

- tx `0x01c4d754abe2037b25b7d880a1f3a4000983b1064f83d86081c52fc9679a4a01`
- `to`: `0x41b2126661c673c2bedd208cc72e85dc51a5320a`
- contract name: `CLGauge`
- decoded function: `getReward`
- decoded arg: position token id `71093441`
- validated classification: `manual_gauge_reward_claim`

Relevant evidence:

- `docs/api-research/moralis/address-transactions-decoded-full-classification.json`
- `docs/api-research/moralis/address-transactions-decoded-page5-response.json`

### Current runtime behavior

If this transaction is surfacing as `unknown` or otherwise unresolved in the live product path, that means runtime has drifted from the validated research path. That drift can come from one or more of these seams:

- ABI discovery/persistence did not load the CLGauge ABI in time;
- classification ran without the required ABI-aware registry state;
- gauge reward-claim classifier coverage is too narrow for the observed decoded input variants;
- downstream reward/deposit linkage dropped the explicit tokenId identity and surfaced the event as unknown anyway.

### Why this matters

This is a parity-critical requirement. The brief spec and research explicitly require classification from decoded input, ABI, logs, and explicit identities. A transaction with a decoded gauge reward claim and tokenId argument must not remain unknown.

### Implementation steps

1. Add a formal rule that the validated wallet fixture must have zero `unclassified_transaction` and zero `protocol_contract_call_unmapped` rows once ABI registry and required enrichments are available.
2. Add this exact tx hash `0x01c4d754abe2037b25b7d880a1f3a4000983b1064f83d86081c52fc9679a4a01` as a regression anchor in engine-v2 classification tests.
3. Ensure runtime ABI discovery reliably fetches and persists the ABI for `0x41b2126661c673c2bedd208cc72e85dc51a5320a` before classification of the fixture wallet, using the same DB-first ABI path as the research flow.
4. Extend gauge reward claim classification so decoded reward-claim variants keyed by explicit deposit tokenId are always recognized. The current production helper already recognizes `getReward` on gauge kinds; verify and extend it for any observed `getRewards(...)` variants as well.
5. When the decoded gauge reward claim carries a tokenId argument, propagate that explicit identity into domain metadata and links so the reward resolves as a deposit-owned reward claim instead of becoming an unknown reward surface later.
6. Add a regression assertion that this tx classifies to `manual_gauge_reward_claim` and links to the manual deposit identity by tokenId.
7. Fail the regression if any transaction from the validated wallet falls back to unknown when the research artifact already classifies it explicitly.

## Gap 11: Strategy Rows Still Lack Correct Valuation And Human Pool Labels

### Validated behavior

The strategy surface must expose the same kind of usable metadata that was already proven feasible in the earlier validated path:

- non-zero strategy valuation when explicit pricing/state evidence exists;
- human-readable pool naming such as `USDC/cbBTC-100` instead of raw exposure ids or wrapper addresses;
- stable strategy labels derived from normalized pool identity, not from fallback technical ids;
- DB-only request-time reads, with any `LpSugar` or equivalent protocol metadata gathered only during analysis/enrichment and then persisted.

### Current runtime behavior

The current engine-v2 strategy materialization still falls back too often:

- `strategyCurrentEstimatedValueUsd(...)` derives value from the latest non-reward lifecycle `valueUsd` or falls back to deposited value, which can leave the live strategy value at `0` even when the protocol position is still active;
- `resolvedPoolLabel(...)` returns `null` when normalized pool state is missing or unresolved;
- `strategyDisplayLabel(...)` then falls back to wrapper token symbol, shortened wrapper address, or raw `strategyExposureId`;
- the result is the currently observed runtime symptom: strategy cards and detail views show `0` pricing and incorrect pool names instead of labels like `USDC/cbBTC-100`.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/strategies/strategies.repository.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/load-materialization-context.ts`

### Why this matters

This is not a cosmetic rename. Wrong pool identity and zero valuation make the strategy dataview materially misleading and break parity with functionality that already existed before on the validated path.

### Implementation steps

1. Restore analysis-time enrichment for strategy pool identity so each strategy exposure resolves to a normalized pool definition with token symbols, fee tier, and canonical pool label.
2. Persist that normalized strategy-to-pool metadata into engine-v2 state/read-model inputs so request-time strategy routes remain DB-only.
3. Reintroduce the protocol metadata needed to generate labels like `USDC/cbBTC-100`, using `LpSugar` or an equivalent analysis-time protocol source, but never from request-time route calls.
4. Replace the current label fallback chain so strategy display labels prefer normalized pool identity first, wrapper symbol second, and raw exposure ids only as a last-resort unresolved state.
5. Add strategy valuation enrichment/state resolution so active strategies can compute current estimated USD value from persisted share-to-underlying or pool-position state, rather than only from the last lifecycle event or deposited principal fallback.
6. Distinguish coverage explicitly when valuation is partial or unavailable, but do not silently show confident-looking `0` USD for active strategies if pricing/state evidence is merely missing.
7. Add regression coverage for the validated wallet proving that strategy rows materialize non-zero value when evidence exists and that affected strategies render pool labels in the expected `TOKEN0/TOKEN1-feeTier` form.
8. Add a DB-only route test ensuring the fix comes from persisted enrichment/materialization, not from request-time `LpSugar` or provider calls.

## Gap 12: Deposit Rows Still Fall Back To Raw Pool Identifiers Instead Of Human Labels

### Validated behavior

Deposit rows may use `chainId:contractAddress` internally as a stable identifier, but user-facing deposit and position labels must be normalized human labels, as in the previously validated path:

- pool labels like `WETH / USDC 100` or `USDC / cbBTC 100`;
- position labels like `WETH / USDC · CL #71093441` or equivalent stable human-readable form;
- request-time deposit routes remain DB-only, with label construction backed by persisted normalized pool metadata.

### Current runtime behavior

The current engine-v2 deposit materializer still exposes raw identifiers when normalized pool state is incomplete:

- `poolLabelFromState(...)` returns the raw `poolId` when token metadata or pool state is missing;
- deposit rows then persist that raw `chainId:contractAddress` string as `poolLabel`;
- `positionLabelFromDeposit(...)` uses that same fallback `poolLabel`, so the user-facing position label is also polluted with the raw internal identifier.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/deposits/deposits.repository.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/load-materialization-context.ts`

### Why this matters

This is not just a presentation issue. It means the engine is not persisting enough normalized pool identity to render deposits in the same usable way the product already supported before. The raw identifier is acceptable for joins and keys, but not as the visible pool name.

### Implementation steps

1. Ensure analysis-time pool enrichment persists the normalized pool definition needed for deposit labeling: token0 symbol, token1 symbol, fee tier or tick spacing, and canonical pool label.
2. Make deposit materialization depend on that persisted normalized pool state rather than falling back directly to `poolId` as the visible label.
3. Keep `chainId:contractAddress` only as `poolId` or another internal identity field; do not surface it as the primary visible `poolLabel` except as an explicitly unresolved fallback state.
4. Update deposit `positionLabel` construction to prefer normalized pool label first and append tokenId or pool kind in a stable human-readable format.
5. If pool metadata is still unresolved, surface the row as unresolved or partial rather than silently presenting the raw identifier as if it were a real label.
6. Add regression coverage for the validated wallet proving that affected deposit rows render human pool labels instead of raw `chainId:contractAddress` strings.
7. Add a DB-only route test proving the fix comes from persisted engine-v2 pool metadata and not from request-time provider lookups or UI heuristics.

## Gap 13: Pool Detail Rows Drop Closed-Position Range Metadata And Still Depend On Incomplete Pool Labels

### Validated behavior

The pools surface must preserve enough persisted pool and position state to show:

- normalized pool labels for every pool row, not only the subset whose metadata happened to hydrate correctly;
- manual position range information for pool detail rows, including closed CL deposits when historical range metadata is known;
- DB-only request-time reads, with any `LpSugar` or equivalent protocol metadata gathered during analysis/enrichment and persisted before materialization.

### Current runtime behavior

The current engine-v2 pool materialization and mapping still lose both kinds of information:

- `materializePoolRows(...)` builds `positions.manualDeposits` only from deposits where `deposit.status !== "closed"`, so closed manual positions are excluded from the pool detail surface entirely;
- even for included manual deposits, the pool materializer hardcodes `tickLower`, `tickUpper`, `rangeLowerPrice`, `rangeUpperPrice`, and `isInRange` to `null`;
- pool labels render correctly only when persisted token symbols and density/type suffix metadata are present. The repository can synthesize `TOKEN0 / TOKEN1 feeTier` from metadata, but otherwise the pool row falls back to unresolved or raw labels.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/pools/pools.repository.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/load-materialization-context.ts`

### Why this matters

This makes the pools surface materially incomplete. Closed CL deposits still belong to the pool lifecycle and should retain their known range metadata for historical review, and pool labels should not appear correct only for the subset of pools whose metadata happened to be present.

The currently correct `WETH / USDC 100` label is evidence that the display path works when normalized metadata is available. The remaining broken labels indicate missing or inconsistent persisted pool metadata, not a frontend rendering limitation.

### Implementation steps

1. Persist the normalized pool metadata required for every pool row: token symbols, fee tier or density suffix, pool type, and canonical display label.
2. Ensure analysis-time enrichment backfills that metadata consistently for all affected Aerodrome pools, using `LpSugar` or equivalent protocol sources only during analysis, never at request time.
3. Update pool materialization so `positions.manualDeposits` can include closed deposits when the screen is showing historical participation, rather than filtering them out with `deposit.status !== "closed"`.
4. Persist or derive manual-deposit range metadata into the pool detail rows: `tickLower`, `tickUpper`, `rangeLowerPrice`, `rangeUpperPrice`, and `isInRange` where explicitly known.
5. For closed deposits, preserve the last known range metadata as historical state instead of dropping it just because the position is no longer active.
6. Surface unresolved or partial coverage explicitly when range metadata is unavailable, rather than silently nulling all range fields for every pool-position row.
7. Add regression coverage for the validated wallet proving that pool detail rows include expected closed manual positions and retain their known CL range information.
8. Add regression coverage proving that affected pool rows render normalized labels consistently, not only for the already-correct `WETH / USDC 100` case.
9. Add a DB-only route test ensuring the fix comes from persisted engine-v2 metadata/materialization and not from request-time `LpSugar` or provider calls.

## Priority Guidance

Mandatory for parity with the validated research result:

1. Gap 1: incremental collection boundary
2. Gap 2: dedupe in main runtime path
3. Gap 4: consistent research-to-runtime classification helper chain
4. Gap 5: ABI-aware regression parity
5. Gap 6: broader ABI discovery
6. Gap 7: drain enrichment before accounting
7. Gap 8: governance multi-lock support and correct lock identity rendering
8. Gap 10: zero unknown transactions on the validated wallet fixture
9. Gap 11: strategy valuation and normalized pool labeling parity
10. Gap 12: deposit pool-label normalization parity
11. Gap 13: pool closed-range and pool-label parity

Important hardening, but can follow after parity-critical work:

1. Gap 3: persisted tx-level classified snapshot
2. Gap 9: first-class diagnostics output

## Non-Goal Reminder

These gaps should be closed inside:

- collection
- canonicalization
- ABI registry
- classification
- enrichment
- accounting
- materialization

They should not be "fixed" by adding request-time provider calls or UI-only heuristics.
