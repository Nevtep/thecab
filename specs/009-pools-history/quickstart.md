# Quickstart: Analyzed Pools History

**Feature**: `009-pools-history`  
**Date**: 2026-05-25

## Goal

Validate the routed Pools feature locally using only DB-backed read APIs after a completed analysis run has materialized pool read models.

## Prerequisites

1. App dependencies are installed in `apps/web`.
2. `.env.local` is configured for database, auth, Moralis, Alchemy, and Trigger.dev.
3. A Base-active wallet with analyzable Aerodrome and/or Mellow history is available for local validation.

## Setup

1. From `apps/web`, migrate the database:

```bash
pnpm db:migrate
```

2. If you need a clean wallet-scoped test state, purge existing local analysis artifacts:

```bash
pnpm db:purge
```

3. Start the app and supporting local analysis workflow as already documented for the analysis engine.

## Produce analyzed data

1. Connect the validation wallet.
2. Start historical analysis through the existing Settings or Overview analysis control.
3. Wait until canonical analysis status becomes `ready`.
4. If the wallet later enters `stale` during refresh, verify Pools continues serving the last successful analyzed data instead of relocking.

## Validate pool read models

After analysis completes, confirm the new wallet-scoped pool read models exist for the connected wallet and chain:

- `pool_wallet_summaries`
- `pool_history_snapshots`
- `pool_timeline_events`

The exact inspection command is implementation-dependent, but validation should confirm:

1. At least one summary row exists per participated pool.
2. History rows span the covered window for the pool.
3. Timeline rows include grouped lifecycle and rebalance events where expected.

## Validate routed UI

1. Visit `/pools` while analysis is ready.
2. Confirm the sidebar Pools item is a real route, not a placeholder.
3. Confirm the list loads from internal APIs without external provider activity in request flow.
4. Open `/pools/[poolId]` for a populated pool.
5. Verify chart, KPI, composition, rewards, and timeline sections render from DB-backed data.
6. Verify direct navigation to `/pools` before analysis completion shows the gated state instead of partial recent-view data.

## Regression checks

1. `pnpm lint src`
2. Run the relevant unit tests for Pools repositories, mappers, and route handlers.
3. Run the relevant Playwright coverage for Pools gating and navigation unlock behavior.

## Notes

- Pools routes must stay DB-only even during local development.
- If pool read models need to be regenerated from normalized records without re-fetching providers, implement and use a dedicated rebuild script rather than hitting provider APIs in route handlers.