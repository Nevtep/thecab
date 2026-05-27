# Contract: i18n Namespaces — Deposits

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27

All user-facing copy is sourced from i18next resources. English is canonical; Spanish parity is required (CA-002). Semantic keys only (no full sentences as keys). Position labels (FR-003a) are deterministic identifiers, not translated strings; pool-kind tokens (`stable`/`volatile`/numeric tick spacing) are technical identifiers preserved verbatim.

## New namespace

### `deposits`

Files: `apps/web/src/i18n/locales/en/deposits.json`, `apps/web/src/i18n/locales/es/deposits.json`.

Top-level key groups:

```text
title
subtitle
howItWorks.{label,description}
gating.{title,message}
filters.{status.{open_active,closed,all}, pool.all, dateRange.label, returnSign.{positive,negative,any}, more.label, activeChip.clearAll}
list.{count,emptyAll,emptyFiltered,density.{table,compact},columns.{deposit,pool,status,opened,closed,openedValue,currentValue,totalRewards,realizedPnl,unrealizedPnl,totalReturn,estApr,coverage,confidence,performance}, pagination.{showing,pageSize}}
kpi.{totalDeposits,totalCapitalDeployed,currentValue,totalRewards,realizedPnl,unrealizedPnl, ofTotal, pctOfManual, pctOfCapital, sparkline.aria}
status.{open_active,closed}
poolKind.{cl,basic_stable,basic_volatile,feeTier}
detail.{viewInExplorer,share,close,events.viewAll, timeline.title, decomposition.title, decomposition.totalReturn, decomposition.estAnnualizedReturn, decomposition.flow.{title,context,entered,withdrawn}, decomposition.attribution.title, decomposition.components.{rewards,fees,assetPriceEffect,rebalanceEffect,realizedPnl,unrealizedPnl,unattributed}, range.{title,inRange,outOfRange,unavailable,token1Denom}, coveredRange.{title,shorterThanWindow}, secondary.{estApr,totalRewards,realizedPnl,unrealizedPnl,coverage,confidence}}
events.{mint_position,increase_liquidity,stake,claim_reward,unstake,decrease_liquidity,collect_fees,withdraw,burn,close,transfer_in}
strategiesCrossLink.{label,placeholder,available}
transferIn.{badge,explainer}
unattributed.{badge,explainer, reasonCodes.{missingHistoricalPrice,unresolvedRewardClaim,coverageGap,lowConfidenceClassification,priceUnavailable}}
a11y.{openDetail,closeDetail,clearFilter,sortBy}
```

Interpolation policy:

- Numbers/currency/percent/dates go through `@/i18n/formatters` helpers (`formatUsd`, `formatPercent`, `formatTokenAmount`, `formatDate`, `formatDayRange`, signed `formatPnl`).
- No protocol address or token id is embedded in translation keys.

## Updated shared namespaces

### `navigation`

Add:

```text
items.deposits
a11y.openDeposits
```

### `coverage`

Add:

```text
reasonCodes.transferInOrigin
reasonCodes.unattributedResidual
reasonCodes.priceUnavailable
reasonCodes.rangeUnavailable
confidence.degraded
```

### `charts`

Add:

```text
decomposition.legend.{rewards,fees,assetPriceEffect,rebalanceEffect,realizedPnl,unrealizedPnl,unattributed}
decomposition.tooltip.{component,value,share}
range.token1Denom
```

### `common`

Add (only if not already present):

```text
chips.{open_active,closed}
actions.{viewInExplorer,share}
empty.noData
```

### `errors`

Add:

```text
codes.deposit_not_found
codes.analysis_not_ready
codes.invalid_request
codes.wallet_not_authenticated
codes.chain_unsupported
```

(Reuse existing codes where already defined.)

## en/es parity rules

1. Every leaf key in `en/deposits.json` MUST exist in `es/deposits.json` (existing repo i18n parity lint applies).
2. Spanish copy uses the established control-tower register (precise, técnico, sin hype): "Depósitos", "Valor actual", "Comisiones cobradas", "Recompensas", "Efecto de precio", "Efecto de rebalanceo", "Sin atribuir", "Rango", "Dentro del rango", "Fuera del rango", "No disponible".
3. Pool-kind technical tokens (`stable`, `volatile`, tick spacings like `100`/`2000`) are preserved verbatim in both languages.
4. `unattributed.reasonCodes.*` Spanish strings document operational state, not failure ("Precio histórico no disponible", "Reclamo de recompensa sin resolver", "Cobertura parcial", "Clasificación de baja confianza", "Sin precio disponible").
