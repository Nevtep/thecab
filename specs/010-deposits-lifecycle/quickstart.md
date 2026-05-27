# Quickstart: Deposits Lifecycle

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27

End-to-end validation path for the Deposits feature against a local environment.

## Prerequisites

- Local Postgres running per [docs/phase-0-local-postgres-runbook.md](../../docs/phase-0-local-postgres-runbook.md).
- `.env` configured with `DATABASE_URL`, `ALCHEMY_API_KEY`, `MORALIS_API_KEY` for materialization runs; UI runtime requires none beyond `DATABASE_URL`.
- A wallet known to hold (or to have historically held) Aerodrome manual positions on Base. Use `TEST_ADDRESS` only in smoke/test scripts.

## 1. Apply migration

```bash
pnpm --filter web db:generate
pnpm --filter web db:migrate
```

Verify the three new tables exist:

```bash
psql "$DATABASE_URL" -c '\d deposit_wallet_summaries' \
  -c '\d deposit_lifecycle_events' \
  -c '\d deposit_performance_decompositions'
```

## 2. Run an end-to-end analysis

```bash
pnpm --filter web analysis:run -- --chainId 8453 --wallet <WALLET_ADDRESS>
```

Confirm `phase-finalize` populated the new tables:

```sql
SELECT count(*) FROM deposit_wallet_summaries
 WHERE chain_id = 8453 AND wallet_address = lower('<WALLET_ADDRESS>');

SELECT deposit_id, total_return_usd,
       (rewards_usd + fees_usd + asset_price_effect_usd
        + rebalance_effect_usd + realized_pnl_usd + unrealized_pnl_usd
        + unattributed_usd) AS reconstructed
  FROM deposit_performance_decompositions
 WHERE chain_id = 8453 AND wallet_address = lower('<WALLET_ADDRESS>');
```

Both `total_return_usd` and `reconstructed` MUST match within `1e-9` (FR-011a).

## 3. Run the app

```bash
pnpm --filter web dev
```

Sign in with the wallet from step 2 and visit `http://localhost:3000/deposits`.

## 4. Validate UX checkpoints

| Checkpoint | Expected |
|---|---|
| Pre-analysis | `/deposits` renders `CabSectionLockState` (FR-001). |
| Default state | Status filter = `OPEN ACTIVE`, sort = `Opened ↓`, page size = 10 (FR-005a). |
| KPI strip | Six tiles render with covered-range sparklines; no extrapolation past covered end (FR-016). |
| Filter bar | Status, Pool, Date range, More filters; active filters appear as removable chips; URL reflects state (FR-024). |
| List | One row per manual deposit with deterministic label `{t0}/{t1}-{poolKind} #{shortTokenId}` (FR-003a). |
| Coverage placement | No duplicate top-of-page coverage banner; per-row `CabCoverageBadge` only (FR-023). |
| Detail open | Desktop: clicking a row opens sticky right pane; `?selectedDepositId=...` appears in URL. |
| Detail content | Identity row, two impact KPIs, secondary stats, CL range (CL only), lifecycle timeline, decomposition with explicit Unattributed bar, strategies cross-link, two bottom CTAs (Cab Gold primary + secondary). |
| Reconciliation | Decomposition tooltip sum matches Total return exactly. |
| Transfer-in | If applicable, deposit shows `transferIn.badge` and `confidence = degraded`. |
| Mobile | Below `lg`, row tap navigates to `/deposits/[depositId]` full-screen. |
| Deep-link share | Copying current URL and reopening reproduces the same filters + selection (FR-024, FR-017). |
| Locale | Switching to `es` updates all copy (CA-002). |

## 5. Performance smoke checks

```bash
# List endpoint
time curl -s -b cookie.txt 'http://localhost:3000/api/deposits?chainId=8453' >/dev/null

# Detail endpoint
time curl -s -b cookie.txt "http://localhost:3000/api/deposits/<DEPOSIT_ID>?chainId=8453" >/dev/null
```

Targets: list p95 ≤ 200ms, detail p95 ≤ 300ms with warm DB cache.

## 6. Re-materialization & purge

To re-test materialization from scratch:

```bash
pnpm --filter web db:purge -- --wallet <WALLET_ADDRESS> --chainId 8453
pnpm --filter web analysis:run -- --chainId 8453 --wallet <WALLET_ADDRESS>
```

The purge MUST delete `deposit_lifecycle_events`, `deposit_performance_decompositions`, and `deposit_wallet_summaries` before normalized analysis tables; verify no FK errors are logged.
