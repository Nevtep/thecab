# Analysis Engine Robustening Research — Session Notes

## Current State Summary

**Phase Architecture**: 5-phase pipeline — deposits, rewards, activity, pools, finalize (Trigger.dev tasks)

**What Exists**:
- `classifyResidualAttribution()` creates `attributionStates` + `attributionSourceLots` (phase-activity)
- `pool-read-models.ts` materializes wallet-scoped pool summaries/history/timeline (phase-finalize)
- Reward assignment in `phase-rewards.task.ts` uses basic matching on tokenId/wrapperAddress, falls back to first deposit/strategy
- Ledger event classification in `classifyRunLedgerEvents()` produces classes like "manual_deposit", "swap", "claim" etc.

**Critical Gaps Identified**:

1. **Rebalance inference never runs** — `classifyResidualAttribution` creates residual attribution states but does NOT infer rebalance actions from subsequent swaps. The code checks `classification?.startsWith("rebalance_")` but no code ever writes that classification to `ledgerEvents`.

2. **Pool association for residuals not implemented** — `attributionStates.poolId` is nullable and never set even after inference should assign residual to a pool.

3. **Canonical action tracking absent** — No table/structure exists to track inferred rebalances, redemployments, waterfall allocations with timing, confidence, and waterfall breakdown.

4. **Reward assignment allows unresolved claims** — `phase-rewards.task.ts` line 220: `depositOrStrategyId: matchingDeposit?.id ?? matchingStrategy?.id ?? null` assigns to first deposit/strategy if no explicit match, then persists with null if no match found.

5. **Waterfall allocation logic missing** — Swap decomposition based on residual priority order (pool residual → cash-ins → liquidation inventory → other residuals pro-rata) is not implemented.

## Key Files & Ownership Gaps

### Rebalance Inference (MISSING)
- **Should own**: `phase-activity.task.ts` + new helper module (e.g., `inferRebalanceActions()`)
- **Current**: Basic residual lot/state creation only
- **Needed**: After `classifyRunLedgerEvents()`, infer rebalance by matching swaps to residual attributed tokens

### Pool Association for Residuals (INCOMPLETE)
- **Should own**: `phase-activity.task.ts` (during `classifyResidualAttribution`)
- **Current**: `attributionStates.poolId` set to `null` regardless
- **Needed**: Determine pool_id from swap target token + pair matching

### Canonical Inferred Actions (MISSING)
- **Should own**: New table + `pool-read-models.ts` materialization
- **Current**: None
- **Needed**: Track each rebalance/redeploy/liquidation with action_type, source_residual_id, target_pool_id, waterfall breakdown, confidence

### Reward Attribution Hardening (WEAK)
- **Should own**: `phase-rewards.task.ts` + new helper (e.g., `resolveRewardTarget()`)
- **Current**: Fallback to first deposit/strategy
- **Needed**: Keep null for unresolved, allow downstream to handle vs. false assignment

---

## Minimal Schema Changes Required

1. **`attributionStates` expansion**:
   - `poolId` → FK to pools (derive from rebalance inference or residual initial withdrawal)
   - `resolutionStatus` → enum: still_waiting | rebalanced_same_pool | redeploy_same_pool | transferred_other_pool | liquidated | transferred_external | fully_spent
   - `canonicalInferredActionId` → FK to new table (nullable, 1:1 mapping)

2. **New `canonical_inferred_actions` table**:
   - id (pk), chain_id, wallet_address, run_id
   - action_type (enum: rebalance_same_pool, rebalance_different_pool, redeploy_same_pool, liquidation, transfer_external)
   - source_residual_id (FK→attributionStates), source_pool_id (FK→pools)
   - target_pool_id (FK→pools, nullable), target_token_address
   - occurred_at, confidence (high/medium/low)
   - metadata_json: { waterfall_allocation: [{source_type, source_id, amount_raw}...], swap_tx_hash, ... }

3. **`ledgerEvents` classification additions**:
   - `rebalance_same_pool`, `rebalance_different_pool`, `redeploy_same_pool`, `liquidation_from_residual`, etc.
   - (optional: add `canonical_action_id` FK for join convenience)

4. **`rewardEvents` hardening**:
   - Add column `resolution_status` (enum: unresolved | claimed_by_deposit | claimed_by_strategy | orphaned)
   - (no schema change needed if null assignment is acceptable, but tracking status helps downstream)

---

## Migration Risks

1. **Data re-ingestion**: If rebalance inference is retroactively applied to old runs, existing `attributionStates.poolId = null` rows need hydration. Requires re-running residual inference over historical ledger events.

2. **Waterfall allocation idempotence**: Swap decomposition across source lots must be deterministic per swap + residual state snapshot. Changes to waterfall logic will produce different allocations for same input.

3. **Reward claim orphaning**: Changing reward assignment from "first deposit" to "unresolved" will change existing claim associations if rows are already persisted. Either add migration to orphan old claims, or keep old behavior for prior runs.

4. **Performance of residual resolution**: Inferring rebalances requires JOIN between swaps and residual states per wallet per run. Large wallet histories may see slowdown in phase-activity.

---

## Recommended Implementation Order

### Phase 1: Rebalance Inference & Pool Association (1-2 weeks)
- Add `inferRebalanceActionsFromSwaps()` in phase-activity or new module
- Populate `attributionStates.poolId` + `resolutionStatus` during residual classification
- Write rebalance classification to `ledgerEvents.classification`
- Add minimal schema migration (poolId FK, resolutionStatus enum)
- Test on sandbox wallets with multi-pool rebalances

### Phase 2: Canonical Action Tracking (1 week)
- Create `canonical_inferred_actions` table
- Materialize in phase-finalize alongside pool read models
- Link from `attributionStates.canonicalInferredActionId`
- Surface in pool read model timeline via `pool_timeline_events`

### Phase 3: Waterfall Allocation & Reward Hardening (1-2 weeks)
- Implement swap decomposition logic per waterfall priority order in phase-activity
- Update `phase-rewards.task.ts` to leave reward `depositOrStrategyId = null` if no explicit match
- Add `resolution_status` column to `rewardEvents` for tracking
- Harden claim assignment logic with explicit unresolved handling

### Phase 4: Backwards Compatibility & UI Surfacing (1 week)
- Decide: re-run historical analysis or accept partial coverage?
- If re-run: add flag to trigger.ts to republish old runs in background
- Surface rebalance+residual timeline in pools detail UI
- Add coverage warnings for unresolved claims

---

## Implementation Notes

**Key interdependencies**:
- Rebalance inference must happen before canonical action materialization (depends on poolId + resolutionStatus)
- Waterfall allocation must be complete before canonical action snapshot (needs decomposition breakdown in metadata)
- Pool read models must consume canonical actions to group timeline events

**Testing strategy**:
- Unit test: rebalance detection (swap matching residual by paired token)
- Unit test: pool association (residual token → pool lookup)
- Unit test: waterfall priority (swap exceeding residual uses cash-in/liquidation fallback)
- Integration test: end-to-end analysis run on multi-pool rebalance wallet
- E2E test: pool detail UI shows rebalance timeline correctly

