# Quickstart: Analysis Engine (008-analysis-jobs)

**Feature**: `008-analysis-jobs`  
**Date**: 2026-05-24  
**Audience**: Engineers implementing or smoke-testing the analysis pipeline locally.  
**Goal**: From a clean checkout, kick off an end-to-end analysis run for a real Base-mainnet wallet, observe progress, and verify that `performance_snapshots` rows are written. Citations: `plan.md`, `data-model.md`, `contracts/analysis-api.md`, `contracts/trigger-tasks.md`, `/memories/repo/overview-provider-smoke-note.md`.

## 1. Prerequisites

- Node.js 20.x, pnpm 9.x, Docker (for local Postgres), `psql` CLI.
- A funded Alchemy account (Base mainnet) with both **RPC** and **Prices** API access.
- A Moralis account with Base support.
- A Trigger.dev account (Cloud is fine for local dev).
- A real Base-active wallet for testing. **Do not use `0x0000…0000`** — per `/memories/repo/overview-provider-smoke-note.md`, the zero address breaks several provider clients. Use any wallet you have observed Aerodrome/Mellow activity for.

## 2. Environment Variables

Add to `apps/web/.env.local`:

```dotenv
# Postgres (Phase 0 local Postgres runbook)
DATABASE_URL=postgres://thecab:thecab@localhost:5432/thecab

# Redis (provider cache backend; can be local Upstash-compatible Redis)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Providers (research.md §R8)
MORALIS_API_KEY=...
ALCHEMY_API_KEY=...
ALCHEMY_PRICES_API_KEY=...

# Trigger.dev v3
TRIGGER_API_KEY=tr_dev_...
TRIGGER_API_URL=https://api.trigger.dev
TRIGGER_PROJECT_REF=proj_...

# Queue concurrency (contracts/trigger-tasks.md §Queues)
TRIGGER_QUEUE_MORALIS_CONCURRENCY=4
TRIGGER_QUEUE_ALCHEMY_PRICES_CONCURRENCY=3
TRIGGER_QUEUE_ALCHEMY_RPC_CONCURRENCY=6

# Engine knobs
ANALYSIS_REBALANCE_WINDOW_HOURS=24
ANALYSIS_REORG_SOFT_BLOCKS=32
```

## 3. One-Time Setup

```bash
# From repo root
cd "apps/web"
pnpm install

# Start local Postgres (see docs/phase-0-local-postgres-runbook.md)
docker compose up -d postgres

# Apply migrations (drizzle-kit) — this lands the 008 schema deltas (data-model.md §5)
pnpm db:generate
pnpm db:migrate

# Sanity check the schema
psql "$DATABASE_URL" -c "\d analysis_runs" | grep utc_day_bucket
psql "$DATABASE_URL" -c "\d analysis_slices" | head -20
psql "$DATABASE_URL" -c "\d processing_cursors"
psql "$DATABASE_URL" -c "\d processed_txs"
```

You should see the new columns/tables from `data-model.md`.

## 4. Start the Dev Stack

In three terminals from `apps/web/`:

```bash
# Terminal 1 — Next.js
pnpm dev

# Terminal 2 — Trigger.dev dev server (registers tasks under apps/web/src/server/trigger/tasks/)
pnpm trigger:dev

# Terminal 3 — i18n parity check (optional but recommended)
pnpm i18n:check
```

Confirm the Trigger.dev dev server reports the 7 registered tasks:

```
analysis.run
analysis.slice
phase.deposits
phase.rewards
phase.activity
phase.pools
phase.finalize
```

## 5. Connect a Wallet & Trigger an Analysis

1. Open `http://localhost:3000`, connect the test wallet.
2. From a terminal, kick off a full-history run for that wallet on Base:

   ```bash
   WALLET=0xYourBaseActiveWalletLowercase

   curl -sS -X POST http://localhost:3000/api/analysis/start \
     -H 'Content-Type: application/json' \
     --cookie-jar /tmp/the-cab.cookies --cookie /tmp/the-cab.cookies \
     -d "{\"walletAddress\":\"$WALLET\",\"chainId\":8453,\"mode\":\"full_history\"}" | jq
   ```

   Expected response (`contracts/analysis-api.md §1`):

   ```json
   {
     "runId": "…",
     "status": "queued",
     "mode": "full_history",
     "chainId": 8453,
     "walletAddress": "0x…",
     "utcDayBucket": "2026-05-24",
     "triggeredAtUtc": "2026-05-24T…Z",
     "isExistingRun": false
   }
   ```

## 6. Observe Progress

Poll the status route:

```bash
curl -sS "http://localhost:3000/api/analysis/status?walletAddress=$WALLET&chainId=8453" \
  --cookie /tmp/the-cab.cookies | jq
```

You should see `status` transition through `queued → running → ready` (canonical 007 vocabulary — never `complete` per `contracts/analysis-api.md §1`).

Cross-check inside Trigger.dev's dashboard: the run shows `analysis.run` with up to 5 child `analysis.slice` invocations, each fanning out `phase.deposits` and `phase.rewards`. After the barrier, `phase.activity → phase.pools → phase.finalize` execute serially.

## 7. Verify Persisted Output

```bash
# Run header
psql "$DATABASE_URL" -c "
  SELECT id, status, mode, utc_day_bucket, coverage, coverage_reasons_json, completed_at
  FROM analysis_runs
  WHERE wallet_address = '$WALLET' AND chain_id = 8453
  ORDER BY triggered_at_utc DESC LIMIT 5;
"

# Slices
psql "$DATABASE_URL" -c "
  SELECT slice_index, slice_start_utc, slice_end_utc, status,
         tx_count_seen, tx_count_processed, coverage_reasons_json
  FROM analysis_slices
  WHERE wallet_address = '$WALLET' AND chain_id = 8453
  ORDER BY slice_index;
"

# Cursor advanced
psql "$DATABASE_URL" -c "
  SELECT last_processed_day_utc, last_processed_block_number, last_advanced_at
  FROM processing_cursors
  WHERE wallet_address = '$WALLET' AND chain_id = 8453;
"

# Performance series exists (Phase F output)
psql "$DATABASE_URL" -c "
  SELECT scope, COUNT(*) AS rows, MIN(day_utc) AS earliest, MAX(day_utc) AS latest
  FROM performance_snapshots
  WHERE wallet_address = '$WALLET' AND chain_id = 8453
  GROUP BY scope ORDER BY scope;
"
```

Success criteria:

- At least one `analysis_runs` row in `status = 'complete'`.
- One `processing_cursors` row, `last_processed_day_utc` ≈ today's UTC date (minus the 32-block soft buffer).
- `performance_snapshots` rows exist with `scope ∈ {portfolio, pool, deposit, strategy, rewards}` covering at least the most recent slice's date range.
- `analysis_slices.status` is `complete` or `skipped_cached` for every row (no orphan `running` rows).

## 8. Test Incremental Re-Run (Cache Behavior)

Re-trigger the same wallet without waiting a day:

```bash
curl -sS -X POST http://localhost:3000/api/analysis/start \
  -H 'Content-Type: application/json' \
  --cookie /tmp/the-cab.cookies \
  -d "{\"walletAddress\":\"$WALLET\",\"chainId\":8453}" | jq
```

Expected: `isExistingRun: true` returning the same `runId` — the UTC-day cap (FR-002) prevented enqueueing a duplicate. Wait until tomorrow UTC (or manually advance `triggered_at_utc` in a dev script) and re-run; the new run should default to `mode = 'incremental'` and complete in a single slice that's almost entirely `skipped_cached` for txs already in `processed_txs`.

## 9. Test Cancellation

While a run is in `queued` or `running`:

```bash
curl -sS -X POST http://localhost:3000/api/analysis/cancel \
  -H 'Content-Type: application/json' \
  --cookie /tmp/the-cab.cookies \
  -d "{\"runId\":\"<run-id>\",\"walletAddress\":\"$WALLET\",\"chainId\":8453}" | jq
```

Confirm:

- Trigger.dev marks the run cancelled.
- `analysis_runs.status = 'cancelled'`, `cancelled_at` set.
- `processing_cursors` did NOT advance (FR-036).

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `unsupported_chain` on every start request | Sending `chainId ≠ 8453`. | Use Base mainnet in v1. |
| `run_already_in_progress` | An older `queued`/`running` row is stuck. | `UPDATE analysis_runs SET status = 'cancelled', cancelled_at = now() WHERE id = ...` in a dev DB, then retry. |
| Status stays `queued` forever | Trigger.dev dev server not running. | Restart `pnpm trigger:dev` and watch for the 7 registered tasks. |
| Slice fails with `providerThrottled` repeatedly | Free Alchemy/Moralis tier rate limits. | Lower `TRIGGER_QUEUE_*_CONCURRENCY` to 1 and retry. |
| `coverage = 'partial'` with `pricingPartial` reason | Alchemy Prices fell back to symbol lookup for some tokens. | Expected; `price_points.source = 'alchemy_symbol'` rows surface a lower-confidence badge in the UI (research.md §R8). |
| `performance_snapshots` empty after `complete` | Phase F failed silently. | Inspect Trigger.dev run logs for `phase.finalize`; check DB constraint violations. |
| `decodeError` in coverage reasons | Unknown ABI for a tx in the window. | Expected when wallet interacted with a non-Aerodrome/Mellow contract; data is preserved in `raw_provider_records` for later analysis (FR-029). |

## 11. Reset (Destructive — Dev Only)

```bash
psql "$DATABASE_URL" -c "
  TRUNCATE TABLE analysis_runs, analysis_slices, processing_cursors, processed_txs,
                 deposits, ledger_events, asset_movements, reward_events,
                 performance_snapshots, portfolio_snapshots, strategy_exposures,
                 pool_metrics_snapshots, raw_provider_records,
                 attribution_states, attribution_source_lots
  RESTART IDENTITY CASCADE;
"
```

Do NOT run this against any shared environment.
