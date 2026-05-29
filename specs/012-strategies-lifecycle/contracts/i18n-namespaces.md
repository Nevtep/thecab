# Contract: i18n Namespaces

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

English and Spanish resources must remain in parity. No user-facing product copy may be hardcoded in components, routes, or mappers.

## Namespace Impact

| Namespace | Impact |
|---|---|
| `strategies` | New full product surface: title, subtitle, KPI labels, filters, table headers, selected panel, lifecycle labels, rewards labels, coverage notes, empty states. |
| `coverage` | New strategy coverage reason labels and note bodies. |
| `charts` | KPI trend labels and strategy value/reward trend labels. |
| `common` | Shared filter chips, status text, unavailable/partial labels if missing. |
| `navigation` | Strategies sidebar/nav item. |
| `errors` | `strategy_not_found`, `analysis_not_ready`, invalid request messages if missing. |

## `strategies` Key Categories

```json
{
  "title": "Strategies",
  "subtitle": "...",
  "kpis": {
    "currentValue": "...",
    "activeCount": "...",
    "claimedRewards": "...",
    "totalReturn": "...",
    "protocolCoverage": "..."
  },
  "filters": {
    "searchPlaceholder": "...",
    "status": "...",
    "protocol": "...",
    "pool": "...",
    "coverage": "...",
    "shareLevel": "...",
    "partial": "..."
  },
  "table": {
    "title": "...",
    "columns": {
      "strategy": "...",
      "protocol": "...",
      "status": "...",
      "currentValue": "...",
      "shares": "...",
      "claimedRewards": "...",
      "result": "...",
      "estimatedApr": "...",
      "coverage": "...",
      "confidence": "..."
    }
  },
  "detail": {
    "exposureSummary": "...",
    "rewards": "...",
    "lifecycle": "...",
    "coverageNote": "..."
  },
  "events": {
    "strategy_deposit": "...",
    "strategy_share_receive": "...",
    "strategy_stake": "...",
    "strategy_claim": "...",
    "strategy_unstake": "...",
    "strategy_withdraw": "...",
    "strategy_share_redeem": "...",
    "strategy_close": "...",
    "strategy_internal_rebalance": "...",
    "strategy_fee_dilution": "...",
    "strategy_baseline_transfer_in": "...",
    "unresolved_strategy_reward": "..."
  },
  "states": {
    "emptyTitle": "...",
    "emptyDescription": "...",
    "emptyFilteredTitle": "...",
    "selectedMissingTitle": "...",
    "lockedTitle": "..."
  }
}
```

## Coverage Reason Codes

Add labels for:

- `shareLevelAccounting`
- `missingShareValuation`
- `missingHistoricalPrice`
- `poolMappingInferred`
- `poolMappingUnknown`
- `unresolvedStrategyReward`
- `baselineTransferIn`
- `incompleteInternalActivity`
- `externalStrategyReferenceUnresolved`
- `mixedCoverageAggregate`

## Formatting Rules

- Currency: centralized currency formatter.
- Percentages and APR: centralized percent formatter with signed values where applicable.
- Share amounts: centralized token/share amount formatter, no manual commas in components.
- Dates and times: centralized locale-aware date/time formatters.
- Addresses and transaction hashes: existing wallet/tx display components.

## Forbidden Patterns

- Hardcoded strings in `features/strategies/*`.
- Copy returned from `/api/strategies`.
- English-only coverage reason messages stored in DB rows.
- Translating protocol terms in ways that obscure meaning. `Mellow`, `Aerodrome`, `StakingRewards`, `lpWrapper`, and `veAERO` may remain canonical.
