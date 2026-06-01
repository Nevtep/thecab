# Quickstart: Strategies Lifecycle

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

End-to-end validation path for the Strategies DataView, backend read models, and post-analysis reward regression.

## Prerequisites

- Local Postgres running per [docs/phase-0-local-postgres-runbook.md](../../docs/phase-0-local-postgres-runbook.md).
- `apps/web/.env.local` configured with `DATABASE_URL`, `ALCHEMY_API_KEY`, and `MORALIS_API_KEY`.
- A validation wallet on Base mainnet with at least one Mellow strategy exposure and, ideally, a pool that also has manual Aerodrome deposits.

## 1. Apply Migration

```bash
cd apps/web
pnpm db:generate
pnpm db:migrate
```

Verify the new tables:

```bash
psql "$DATABASE_URL" \
  -c '\d strategy_wallet_summaries' \
  -c '\d strategy_history_snapshots' \
  -c '\d strategy_lifecycle_events'
```

## 2. Run Analysis And Rebuild Read Models

Start the app and worker:

```bash
cd apps/web
pnpm dev
pnpm trigger:dev
```

In another shell, run the existing analysis smoke for the validation wallet:

```bash
cd apps/web
TEST_ADDRESS=<WALLET_ADDRESS> pnpm analysis:smoke
```

If a run already exists and only read models need rebuilding:

```bash
cd apps/web
RUN_ID=<RUN_ID> tsx src/server/scripts/rebuild-strategy-read-models.ts
RUN_ID=<RUN_ID> tsx src/server/scripts/rebuild-pool-read-models.ts
RUN_ID=<RUN_ID> tsx src/server/scripts/rebuild-deposit-read-models.ts
```

## 3. Inspect Strategy Rows

```sql
SELECT strategy_label,
       strategy_exposure_id,
       primary_pool_id,
       status,
       current_estimated_value_usd,
       current_shares_raw,
       total_rewards_usd,
       coverage_status,
       coverage_reason_codes
  FROM strategy_wallet_summaries
 WHERE chain_id = 8453
   AND wallet_address = lower('<WALLET_ADDRESS>')
 ORDER BY current_estimated_value_usd DESC NULLS LAST;
```

Expected:

- one row per detected strategy exposure;
- share balances visible even when value is partial;
- coverage `share_level` when user-level shares/rewards are reliable but internals are incomplete;
- no manual deposit NFT exposure represented as a strategy.

## 4. Compare Rewards Across Surfaces

Pool totals must equal resolved deposit rewards plus resolved strategy rewards.

```sql
WITH deposit_rewards AS (
  SELECT d.pool_id,
         COALESCE(SUM(re.amount_usd), 0) AS deposit_rewards_usd
    FROM reward_events re
    JOIN deposits d ON d.id = re.deposit_or_strategy_id
   WHERE re.chain_id = 8453
     AND re.wallet_address = lower('<WALLET_ADDRESS>')
     AND re.is_accrual_snapshot = false
     AND re.resolution_status = 'resolved'
     AND re.strategy_exposure_id IS NULL
   GROUP BY d.pool_id
),
strategy_rewards AS (
  SELECT s.primary_pool_id AS pool_id,
         COALESCE(SUM(re.amount_usd), 0) AS strategy_rewards_usd
    FROM reward_events re
    JOIN strategy_exposures se ON se.id = re.strategy_exposure_id
    JOIN strategies s ON s.id = se.strategy_id
   WHERE re.chain_id = 8453
     AND re.wallet_address = lower('<WALLET_ADDRESS>')
     AND re.is_accrual_snapshot = false
     AND re.resolution_status = 'resolved'
     AND re.strategy_exposure_id IS NOT NULL
   GROUP BY s.primary_pool_id
)
SELECT pws.pool_id,
       pws.total_rewards_usd AS pool_total,
       COALESCE(dr.deposit_rewards_usd, 0) AS deposit_total,
       COALESCE(sr.strategy_rewards_usd, 0) AS strategy_total,
       pws.total_rewards_usd
         - COALESCE(dr.deposit_rewards_usd, 0)
         - COALESCE(sr.strategy_rewards_usd, 0) AS delta
  FROM pool_wallet_summaries pws
  LEFT JOIN deposit_rewards dr ON dr.pool_id = pws.pool_id
  LEFT JOIN strategy_rewards sr ON sr.pool_id = pws.pool_id
 WHERE pws.chain_id = 8453
   AND pws.wallet_address = lower('<WALLET_ADDRESS>');
```

Expected:

- `delta` is zero within rounding tolerance for covered pools;
- deposit rewards include only rewards resolved to deposit ownership;
- strategy rewards include only rewards resolved to `strategy_exposure_id`;
- unresolved rewards degrade coverage instead of being counted.

## 5. Compare DB Rows Against Blockchain Transactions

Run the feature regression script after implementation:

```bash
cd apps/web
WALLET_ADDRESS=<WALLET_ADDRESS> pnpm tsx src/server/scripts/analysis-strategy-regression.ts
```

The script should:

- list strategy lifecycle rows grouped by `tx_hash`;
- compare each row to normalized `ledger_events`, `asset_movements`, `reward_events`, and `raw_provider_records`;
- flag strategy reward rows without `strategy_exposure_id`;
- flag deposit reward rows that also have `strategy_exposure_id`;
- verify pool reward totals equal deposit plus strategy rewards;
- print the source transaction hashes that should be checked against the block explorer.

Manual spot check at least three transactions:

1. one Mellow strategy deposit or share receive;
2. one Mellow `getRewards` or strategy claim;
3. one withdrawal or share redeem.

For each, confirm the DB `strategy_lifecycle_events.tx_hash`, movement values, reward owner, and coverage reason codes match the on-chain transaction.

## 6. Run Focused Tests

```bash
cd apps/web
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm i18n:check
pnpm ds:check
```

Implementation should add focused unit coverage for:

- `materializeStrategyReadModels`;
- strategy reward aggregation by `strategy_exposure_id`;
- pool reward totals including deposit plus strategy rewards;
- deposit reward totals excluding strategy rewards;
- route auth, chain validation, analysis gating, and not-found behavior;
- strategy URL state and selected-row behavior;
- Strategies mappers for coverage note and DataView metrics.

## 7. Run Manual Auth-Gated UI Validation

Expected checkpoints:

- `/strategies` is locked before analysis is ready;
- DataView shows KPI strip, filters, master list, and selected panel;
- selecting a row updates the selected panel and active row;
- Pool detail links to Strategies filtered by pool;
- Deposit detail cross-link opens the relevant strategy when present;
- narrow viewport can reach lifecycle and coverage details in no more than two interactions;
- non-full coverage strategies show a visible coverage note.

Playwright, browser E2E, and automated browser/a11y suites are intentionally excluded by
constitution v1.1.0. Record manual screenshots or product-owner confirmation for
auth-gated UI behavior instead.

## 8. Final Regression Acceptance

### Implementation Regression Notes

2026-05-30 UTC validation run:

- Rebuilt read models for a representative local analysis run and connected wallet fixture.
- `rebuild-pool-read-models.ts`: 5 pool summaries, 1,830 history rows, 73 timeline rows.
- `rebuild-deposit-read-models.ts`: 26 deposit summaries, 85 lifecycle rows, 26 decomposition rows.
- `rebuild-strategy-read-models.ts`: 4 strategy summaries, 4 history rows, 11 lifecycle rows.
- `analysis-strategy-regression.ts` passed after rebuild:
  - strategy lifecycle rows have source transaction hashes;
  - strategy reward lifecycle rows match `reward_events.strategy_exposure_id`;
  - deposit reward rows do not carry `strategy_exposure_id`;
  - pool totals equal resolved deposit plus strategy rewards within rounding tolerance;
  - surface totals are available for Deposits, Strategies, and Pools.
- Pool rewards now count canonical resolved `reward_events` only. Synthetic accrual snapshots and claim-ledger fallback diagnostics are excluded from user-facing reward totals so Pools, Deposits, and Strategies reconcile to the same ownership source.
- Representative strategy claim hashes emitted for explorer review:
  - `0x46f63be7e6bda313c3559bc9bee295d7d85de99a3903a8ac266152dd7a051dd6`
  - `0xe1755f34427255d7b615b25b11e2f7d6ff8cb8430e1fbcdc64c685c61994b39c`
  - `0x66e3c84386b10a3cdb2d452c29c0770c43708d23fb115b3916d8ced126a289fb`
- Product-owner UI signoff recorded from screenshots captured on 2026-05-30 at
  `/strategies` and `/strategies?selectedStrategyId=895cc80b-4985-4a4b-8e96-4089e7e0fece`.
  The screenshots show populated KPI strip, active Strategies navigation, strategy table,
  selected strategy panel, claimed reward values, lifecycle entries, and coverage notes.

Before marking feature complete:

- run a fresh analysis for the validation wallet;
- inspect `strategy_wallet_summaries`, `strategy_lifecycle_events`, `reward_events`, `pool_wallet_summaries`, and `deposit_wallet_summaries`;
- compare representative DB rows against blockchain transaction hashes;
- confirm Pools receive total rewards from both manual deposits and strategies;
- confirm Deposits show rewards only for deposits;
- confirm Strategies show rewards only for strategies;
- confirm unresolved or ambiguous rewards appear as coverage loss, not fabricated totals.
