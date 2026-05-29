# Quickstart: Deterministic Reward & Rebalance Refactor

**Feature**: `011-deterministic-reward-rebalance`  
**Date**: 2026-05-28

Focused validation path for the analysis-engine refactor after implementation lands.

## Prerequisites

- Local Postgres running per [docs/phase-0-local-postgres-runbook.md](../../docs/phase-0-local-postgres-runbook.md).
- `apps/web/.env.local` configured with `DATABASE_URL`, `ALCHEMY_API_KEY`, and `MORALIS_API_KEY`.
- A validation wallet with at least one of each useful case:
  - overlapping manual deposits in the same pool;
  - a manual unstake or claim reward flow;
  - a same-pool withdrawal followed by later paired-token swap and redeploy;
  - Mellow wrapper plus `StakingRewards` activity.

## 1. Install schema changes and baseline validation

```bash
pnpm --filter web db:generate
pnpm --filter web db:migrate
pnpm --filter web lint
pnpm --filter web typecheck
```

## 2. Run focused backend tests

```bash
pnpm --filter web test:unit
```

Implementation should add or update targeted coverage for:

- manual reward resolution without pool/time fallback
- strategy reward linkage to `StrategyExposure`
- no invented strategy `tokenId`
- strategy rewards remaining resolved to `StrategyExposure` even when the external `LpSugar` strategy-position reference is unresolved
- residual-flow rebalance and redeploy classification across long gaps
- attributable same-pool continuity when residual funding is less than half of total funding
- pool/deposit read-model rebuilds consuming only canonical rewards and inferred actions

## 3. Start local app and worker

```bash
pnpm --filter web dev
pnpm --filter web trigger:dev
```

Use the existing analysis flow in the app to run or rerun analysis for the validation wallet.

## 4. Inspect normalized outputs

Verify manual and strategy rewards are separated correctly:

```sql
SELECT reward_type,
       deposit_or_strategy_id,
       strategy_exposure_id,
  resolved_pool_id,
       resolution_status,
       resolution_basis,
  resolution_reason_codes,
  metadata_json ->> 'externalStrategyPositionReference' AS external_strategy_position_reference,
  metadata_json ->> 'externalStrategyPositionReferenceStatus' AS external_strategy_position_reference_status
  FROM reward_events
 WHERE chain_id = 8453
   AND wallet_address = lower('<WALLET_ADDRESS>')
 ORDER BY occurred_at DESC
 LIMIT 50;
```

Expected:

- manual rewards resolve only with explicit or same-transaction token proof;
- strategy rewards link to `strategy_exposure_id` where proven;
- a proven `StrategyExposure` owner can still be resolved when the external `LpSugar` strategy position reference is absent or ambiguous;
- unresolved rows remain unresolved rather than falling into a pool or deposit by timing.

## 5. Inspect higher-order residual outcomes

```sql
SELECT action_type,
       primary_pool_id,
       deposit_id,
       strategy_id,
       metadata_json
  FROM inferred_actions
 WHERE chain_id = 8453
   AND wallet_address = lower('<WALLET_ADDRESS>')
 ORDER BY occurred_at DESC
 LIMIT 50;
```

Expected:

- same-pool rebalance or redeploy rows show `classificationBasis = residual_flow`;
- no action depends on a bounded window;
- excess consumption is split through the source-of-funds waterfall;
- mixed-funding same-pool actions preserve the attributable same-pool portion even when it is not the majority share.

## 6. Inspect rebuilt read models

```sql
SELECT pool_id, total_rewards_usd, metadata_json
  FROM pool_wallet_summaries
 WHERE chain_id = 8453
   AND wallet_address = lower('<WALLET_ADDRESS>');

SELECT deposit_id, total_rewards_usd, coverage_reason_codes
  FROM deposit_wallet_summaries
 WHERE chain_id = 8453
   AND wallet_address = lower('<WALLET_ADDRESS>');
```

Expected:

- only resolved owners contribute to totals;
- ambiguous ownership degrades coverage instead of manufacturing certainty;
- pools aggregate resolved manual and strategy rewards without double counting;
- deposit reward totals include only manual rewards resolved to the deposit identity itself and exclude same-pool strategy rewards.

## 7. Regression spot checks

- Shift timestamps of a known rebalance fixture across a former 24-hour boundary and verify outputs do not change.
- Confirm a Mellow strategy deposit never fabricates a manual NFT `tokenId`, and that any Aerodrome-visible automated `Deposit #...` reference comes from a deterministic `LpSugar.positions(...).id` match persisted for the wrapper when wallet-scoped resolution is unique.
- Confirm a proven strategy reward remains linked to `StrategyExposure` even when no unique `LpSugar` row exists, with only the external strategy-position reference marked unresolved.
- Confirm pool reward totals equal `sum(resolved pool deposit rewards) + sum(resolved pool strategy rewards)` even after deposit read-model rebuilds.
- Confirm deposit reward totals do not increase because a same-pool strategy reward was included in a deposit projection.
- Confirm a mixed-funding same-pool redeploy fixture preserves the attributable same-pool portion even when fresh capital is the majority source.
- Confirm pool timeline rebuilds degrade coverage or emit neutral lifecycle rows rather than inventing rebalance or redeploy semantics when canonical `inferred_actions` are absent.
- Confirm a manual reward without token proof stays unresolved even if there is only one plausible-looking deposit in the pool.