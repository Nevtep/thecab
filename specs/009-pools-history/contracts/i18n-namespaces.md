# Contract: Pools I18n Namespaces

**Feature**: `009-pools-history`  
**Date**: 2026-05-25

## Required namespaces

- `pools`
- `coverage`
- `charts`
- `common`
- `navigation`

## Required key groups

### `pools`

- `title`
- `subtitle`
- `sections.*`
- `filters.search`
- `filters.status.*`
- `filters.exposure.*`
- `filters.coverage.*`
- `sort.*`
- `metrics.*`
- `list.columns.*`
- `list.states.*`
- `detail.tabs.*`
- `detail.segmentLabels.*`
- `detail.timeline.eventTypes.*`
- `detail.timeline.partialAttribution`
- `detail.composition.*`
- `detail.coveredRange`
- `detail.related.*`
- `gated.*`
- `empty.*`
- `errors.*`

### `coverage`

- `status.full`
- `status.share_level`
- `status.partial`
- `status.unknown`
- `reasons.pricingPartial`
- `reasons.partialDecoded`
- `reasons.missingPrices`
- `reasons.recentProtocolReconstruction`
- any pool-specific explanation labels exposed in response contracts

### `charts`

- `series.poolTotalValue`
- `series.poolDeployedValue`
- `series.poolResidualValue`
- `series.poolRewards`
- `markers.capitalIn`
- `markers.capitalOut`
- `markers.rebalance`
- `markers.redeploy`
- `axes.coveredRange`
- `notices.partialCoverage`

### `common`

- shared labels for `active`, `inactive`, `closed`, `manual`, `automated`, `mixed`, `residual`
- generic `viewDetails`, `loadMore`, `unavailable`, `approximate`

### `navigation`

- `items.pools`
- state labels if Pools nav behavior changes after analysis unlock

## Formatting rules

- Currency uses centralized USD formatter.
- Percentages, token amounts, absolute dates, and relative times use centralized locale formatters.
- Legends, chart notices, and timeline labels must not embed manually formatted numeric strings.