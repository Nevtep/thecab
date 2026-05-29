# Analysis Hourly Granularity Research

Date: 2026-05-26

## Purpose

This note documents whether The Cab should support hourly analysis granularity in the future, what problem it would actually solve, what it would not solve, and how to implement it safely without destabilizing the current daily-resolution pipeline.

## Current State

The analysis engine is intentionally designed around daily persistence.

- The v1 analysis spec defines daily precision as the canonical resolution for persisted history.
- `price_points` already supports a `resolution` column, but the analysis pipeline currently writes daily rows only.
- `computeSnapshots()` builds daily price series and writes daily historical snapshots.
- Pools history materialization currently hydrates and values historical token balances with daily prices.
- Overview has one narrow exception: the short `24h` chart can already fetch hourly prices from Alchemy for request-time charting, but this is not the same as hourly analyzed history.

## What Hourly Granularity Would Improve

Hourly granularity would help in a few specific cases:

- Pool value charts would reflect intraday moves more accurately than end-of-day valuation.
- Manual in-range versus out-of-range state could be estimated more truthfully for LP deposits that move in and out within the same day.
- Capital flows and value jumps would align more closely with the actual event window instead of being flattened into a daily bucket.
- Short-range charts, especially recent windows, would look less stair-stepped and would better explain abrupt price changes.

## What Hourly Granularity Would Not Solve By Itself

Hourly token prices are not enough on their own.

- Strategy history still depends on reconstructing historical strategy ranges or rebalance state. Better token prices do not tell us when a strategy changed range.
- Manual LP range status depends on the pool price path, not only token USD prices. Hourly token prices help with valuation, but in-range detection still requires pool tick or pool price reconstruction.
- Very short out-of-range periods can still be missed with hourly buckets. A position that went out of range for 10 to 20 minutes may still be invisible.
- Hourly persistence does not remove the need for better event attribution. It only improves the time resolution of the valuation layer.

## Cost And Operational Impact

The main burden is not just provider calls. It is the full downstream multiplier on storage, writes, caches, and query volume.

### Provider Burden

- Alchemy historical price requests in the current wrapper support both `1d` and `1h` intervals.
- The Overview path already uses hourly prices for the `24h` range.
- The provider wrapper also enforces an hourly request budget guard, so widespread hourly backfills would reach operational limits faster than the current daily model.

Important nuance: request count does not necessarily rise by exactly 24x because the API is queried per token per window, not per hour. However, the returned data volume grows by about 24x for the same time span.

### Data Volume Multiplier

For one year of history:

- Daily points per token: about `365`
- Hourly points per token: about `8,760`

That multiplier propagates into:

- `price_points`
- portfolio snapshots
- pool history snapshots
- deposit and strategy performance snapshots
- query payload sizes
- cache size and rebuild time

### Pipeline Complexity

The current engine relies on day-based invariants.

- The processing cursor stores `lastProcessedDayUtc`.
- Slices are short-circuited by day.
- Finalization assumes a day can be treated as the stable persisted unit.
- Pool history tables key rows by `day_utc`.

Moving to hourly persistence would force a redesign of those assumptions rather than a small extension.

## Recommendation

Do not replace daily persistence with hourly persistence as the default full-history mode.

The better future shape is a hybrid model:

- Keep daily as the canonical long-range analyzed history.
- Add optional hourly support only where it materially improves UX or analytics accuracy.
- Prioritize manual LP range analysis before strategy hourly reconstruction, because manual positions are much more reconstructable from known ticks and pool state.
- Treat strategy historical in-range status as conditional on whether historical rebalance and range changes can be reconstructed reliably.

## Recommended Future Options

### Option A: Keep Persistence Daily, Add Hourly On-Demand Views

This is the lowest-risk option.

- Continue storing daily snapshots as the system of record.
- Add hourly historical price fetches only for bounded recent windows such as `24h`, `7d`, or a dedicated detail overlay.
- Compute hourly chart series at request time or in a short-lived cache, not in the full analysis pipeline.

Pros:

- Minimal schema disruption.
- Lower storage growth.
- Best fit for recent chart UX improvements.

Cons:

- Hourly history would not exist for the full one-year analyzed range.
- In-range analytics would remain partial unless separate pool price reconstruction is added.

### Option B: Dual Resolution Persistence

This is the balanced long-term option if hourly analysis becomes a product requirement.

- Keep daily rows for all long-range read models.
- Add separate hourly rows only for selected tables and a bounded retention window.
- Example: keep `30` to `90` days of hourly snapshots, and keep `365` days of daily snapshots.

Pros:

- Better recent accuracy without exploding one-year storage cost.
- Preserves existing daily consumers.
- Makes hourly charts and recent in-range analysis much more credible.

Cons:

- Considerably more implementation work.
- Requires dual-resolution query logic and backfill rules.

### Option C: Full Hourly Analysis For The Entire Covered Window

This is the highest-cost option and should be avoided unless product requirements clearly justify it.

- Every daily assumption in the analysis engine would need to become resolution-aware.
- Pool history, performance snapshots, and cursor semantics would need redesign.
- Rebuild times, DB size, and read complexity would increase materially.

This option is technically possible, but it is not the recommended path.

## If Hourly Is Implemented In The Future

The safest path is staged.

### Phase 1: Make Resolution Explicit In Read Models

Before writing any hourly rows, make the read side resolution-aware.

- Add a timestamp bucket field for persisted snapshots instead of relying on `day_utc` alone.
- Preserve daily tables or daily rows for backward compatibility.
- Update repositories and chart mappers to request a specific resolution intentionally.

### Phase 2: Add Hourly Price Storage First

Introduce hourly `price_points` writes before touching pool or portfolio snapshots.

- Store `resolution = '1h'` rows in `price_points`.
- Bound the retention window, for example to recent history only.
- Reuse provider caching and deduplication aggressively.

This phase isolates the cheapest useful improvement: better valuation inputs.

### Phase 3: Add Hourly Pool And Portfolio Snapshots For Recent Windows

Only after hourly price storage is stable:

- create hourly portfolio snapshots for bounded ranges
- create hourly pool history snapshots for bounded ranges
- keep daily snapshots as the canonical one-year series

This enables richer recent charts without rewriting the entire analysis product.

### Phase 4: Add In-Range Detection For Manual LPs

For manual positions, in-range status needs pool price reconstruction, not only USD token pricing.

- Persist deposit range metadata already known from the position
- reconstruct pool price or tick by time bucket
- derive `isInRange` per hourly bucket for manual deposits
- aggregate that state into pool-level metrics carefully

This is the first stage where hourly granularity meaningfully improves impermanent-loss and range analytics.

### Phase 5: Add Strategy Historical Range Reconstruction If Feasible

Only do this if the required signals exist.

- identify whether strategy range changes can be derived from onchain events, wrapper state snapshots, or explicit rebalance logs
- if not reconstructable with confidence, keep strategy range history labeled as estimated or unavailable

The product should not claim historical strategy in-range truth if the inputs do not support it.

## Required Schema And Model Changes

If hourly persistence is ever adopted beyond request-time charts, expect changes in these areas:

- `price_points`: persist `resolution = '1h'` rows deliberately and query them by bounded windows
- `performance_snapshots`: support hourly buckets explicitly instead of only daily semantics
- `pool_history_snapshots`: either add a new hourly table or introduce a resolution-aware bucket key
- repositories and API contracts: require a bounded range and explicit resolution selection
- chart components: render mixed daily and hourly ranges intentionally rather than treating all series the same
- processing cursor and caching: decide whether hourly data is authoritative, derived, or recent-only

## Implementation Risks

The main risks are:

- ballooning DB size and rebuild times
- expensive backfills for historical wallets
- inconsistent mixed-resolution queries if repositories silently fall back
- false confidence in historical strategy range status
- over-fetching provider data for windows that do not need hourly detail

## Practical Recommendation For The Product

If future work is approved, start with this order:

1. Add a research spike for manual LP in-range reconstruction by hourly pool price or tick.
2. Add bounded hourly `price_points` persistence for recent windows only.
3. Add optional hourly pool detail charts for recent windows while keeping the one-year chart daily.
4. Reassess whether strategy historical range reconstruction is credible enough to expose.

This gives the product the useful part of hourly granularity without forcing a full rewrite of the analysis engine.

## Bottom Line

Hourly granularity is feasible, but it should be treated as a targeted enhancement rather than a replacement for the daily analysis model.

It is most valuable for:

- recent detail charts
- manual LP in-range estimation
- better short-window valuation fidelity

It is not, by itself, a complete solution for:

- historical strategy in-range truth
- impermanent loss calculation
- exact reconstruction of short intrahour excursions

The correct long-term approach is likely dual resolution: daily as canonical history, hourly as bounded recent detail where the extra fidelity is worth the cost.