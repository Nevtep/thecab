# Frontend Calculation Bugfix Implementation Tasks

Date: 2026-06-04

Source diagnostic report: `docs/informe-frontend-calculation-bugfix-plan.md`

## Split Recommendation

This should not be delivered in one implementation pass.

It can live on one long-lived feature branch if useful, but it should be split into reviewable implementation chunks because the bug list crosses:

- Engine V2 accounting and materialized read models.
- Database contracts/read-model shape.
- Seven screen APIs.
- Shared money/token formatting.
- Multiple DataView UI redesigns.
- Regression checks against persisted wallet data.

Recommended split:

1. Foundation and read-model contracts.
2. Overview + Pools accounting/display fixes.
3. Deposits + Strategies calculation and selection fixes.
4. Rewards + Activity taxonomy/formatting fixes.
5. Governance redesign and governance read-model completion.
6. Final cross-screen regression, copy, and UI polish.

The main reason to split is risk control. Pool values, rewards attribution, residual balances, and governance locks all share source events. Smaller phases let us prove each surface still respects Engine V2 attribution rules before moving to the next screen.

## Phase 0: Baseline Audit And Safety Harness

### Goal

Create deterministic evidence before changing calculations.

### Code Tasks

1. Add or update focused DB/read-model inspection scripts under `apps/web/src/server/scripts/`:
   - current Engine V2 surfaces by row count.
   - pool current values by open manual deposits + active strategies + residuals.
   - reward ownership totals by owner kind.
   - activity action taxonomy counts.
   - governance lock/reward/epoch row counts.
2. Add fixture assertions to existing regression scripts:
   - `apps/web/src/server/scripts/analysis-activity-regression.ts`
   - `apps/web/src/server/scripts/analysis-rewards-regression.ts`
   - `apps/web/src/server/scripts/analysis-governance-regression.ts`
   - `apps/web/src/server/scripts/analysis-strategy-regression.ts`
3. Capture the reviewed wallet's known expected checkpoints:
   - 5 open pools, 2 closed pools.
   - pool total roughly aligned with Overview, not inflated to historical deposit sum.
   - deterministic approval rows are not ambiguous.
   - deterministic failed rows are failed.
   - `manual_position_created` mint rows are not ambiguous.
4. Add unit tests before changing behavior where current bugs are mapper-level:
   - Activity normalization.
   - Rewards amount formatting.
   - Deposit/Strategy selected id parsing.
   - Pool open/closed status.

### Deliverable

A failing baseline for the key bugs, with no production behavior changes yet.

## Phase 1: Shared Engine V2 And Formatting Foundations

### Goal

Fix shared data shape before screen-specific UI work.

### Code Tasks

1. Extend token amount formatting utilities:
   - Add a shared server-side token amount formatter or mapper helper that accepts `amountRaw`, `tokenDecimals`, `tokenSymbol`, and `assetType`.
   - Use token metadata/read-model enrichment for decimals.
   - Keep raw values available in evidence/detail panels.
   - Apply to Rewards, Governance rewards, and Activity movement rows.
2. Extend Engine V2 read-model movement shape:
   - Add `tokenDecimals`.
   - Add `amountFormatted` or `amountDecimal`.
   - Preserve `amountRaw`.
   - Treat ERC721 movements as tokenId/count, not ERC20 decimal amounts.
3. Add wrapped-token pricing support without hardcoded WETH/cbBTC frontend fallbacks:
   - Carry token address through composition rows.
   - Price by token address first.
   - Add wrapped-underlying metadata support when provider/token metadata exposes it.
   - Keep final valuation server-side/read-model-side.
4. Add residual balance read-model contract:
   - pool id.
   - source withdrawal id (`sourceWithdrawalId`).
   - token address.
   - token symbol.
   - token decimals.
   - open amount raw/decimal.
   - open value USD.
   - status: open/consumed/expired or equivalent.
   - consumption links for timeline detail.
5. Add derived rebalance event contract:
   - references to underlying withdrawal, swap, and deposit ids.
   - pool id.
   - withdrawn capital USD.
   - redeployed capital USD.
   - capital delta USD.
   - no suppression of primitive Engine V2 events.

### Primary Files

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/activity-materializer.ts`
- `apps/web/src/server/analysis/engine-v2/accounting/*`
- `apps/web/src/server/analysis/engine-v2/regression/*`
- `apps/web/src/server/overview/getRecentOverview.ts`
- shared token metadata/formatting helpers under `apps/web/src/server` and `apps/web/src/features`

### Tests

- Residual lots stay token-level and pool-scoped.
- Consumed residual lots do not appear in current residual panels.
- Rebalance rows are added without hiding the primitive withdraw/swap/deposit.
- WETH LP-only composition can be valued by token address.
- ERC20 raw amounts format correctly for 6, 8, and 18 decimals.

## Phase 2: Overview And Pools

### Goal

Make portfolio evolution and pool current state consume the corrected Engine V2 read models.

### Overview Code Tasks

1. Update Overview composition types:
   - `apps/web/src/features/overview/overview.types.ts`
   - `apps/web/src/features/overview/capitalAllocation.utils.ts`
   - `apps/web/src/server/overview/getRecentOverview.ts`
2. Replace symbol-only LP token valuation with token-address/read-model valuation.
3. Update portfolio evolution source series:
   - consume Engine V2 rebalance events.
   - show capital delta for rebalance, not withdrawal/deposit spikes.
   - keep primitive event markers available for tooltip/detail.
4. Restore chart event markers:
   - swaps.
   - claims.
   - rebalances.
   - cash-outs.
   - deposits/withdrawals where meaningful.
5. Add tests in:
   - `apps/web/src/features/overview/capitalAllocation.utils.test.ts`
   - `apps/web/src/features/overview/portfolio-evolution/portfolioEvolution.utils.test.ts`
   - `apps/web/src/server/overview/overview.repository.test.ts`

### Pools Code Tasks

1. Fix pool status and counts:
   - current open pools count.
   - closed volatile pools.
   - active means open and in range.
   - inactive means open but out of range.
2. Fix current value calculation:
   - open manual deposit value.
   - active strategy value.
   - open residual balance value.
   - subtract/ignore closed withdrawn capital.
3. Add pool APR:
   - denominator: current deployed/invested basis defined by open value or net invested, as decided in the bug section.
   - numerator: resolved pool rewards.
   - duration: first pool deposit to close date or current analysis timestamp.
4. Add/update `investedDays` at materialization time:
   - recompute on each analysis/materialization run.
   - closed pools freeze at close date.
   - open pools use current analysis timestamp.
5. Fix row expansion:
   - hide closed positions in the subtable.
   - include closed positions in pool history/timeline only.
6. Replace related links with pool timeline graph:
   - grouped event lanes.
   - icons for deposit, withdrawal, swap, reward, rebalance, strategy.
   - hover/detail for tx hash and linked entities.
7. Add residual panel:
   - show only current open residual token balances.
   - consumed lots available through timeline detail.

### Primary Files

- `apps/web/src/server/pools/pools.repository.ts`
- `apps/web/src/server/pools/pools.service.ts`
- `apps/web/src/server/pools/pools.types.ts`
- `apps/web/src/server/pools/pools.contract.ts`
- `apps/web/src/features/pools/Pools.container.tsx`
- `apps/web/src/features/pools/Pools.component.tsx`
- `apps/web/src/features/pools/PoolDetail.component.tsx`
- `apps/web/src/features/pools/components/PoolsTable.tsx`
- `apps/web/src/features/pools/components/PoolHistoryChart.tsx`
- `apps/web/src/features/pools/components/PoolTimeline.tsx`
- `apps/web/src/features/pools/components/PoolRelatedLinks.tsx`

### Tests

- `apps/web/src/server/pools/pools.repository.test.ts`
- `apps/web/src/server/pools/pools.service.test.ts`
- `apps/web/src/features/pools/pools.mappers.test.ts`
- Read-model check: total pool value matches Overview deployed value within tolerance.

## Phase 3: Deposits And Strategies

### Goal

Fix selection, APR, KPI semantics, and detail presentation for direct deposits and Mellow strategies.

### Deposits Code Tasks

1. Fix KPI layout:
   - `apps/web/src/features/deposits/components/DepositsKpiStrip.tsx`
   - `apps/web/src/features/deposits/DepositsWorkspace.module.css`
2. Fix selected deposit ids:
   - preserve Engine V2 scoped/string ids in URL state.
   - stop UUID-only parsing.
   - clear selection on page/filter changes when needed.
3. Restore row-click detail:
   - `DepositsTable.tsx`
   - `Deposits.container.tsx`
   - `DepositDetail.container.tsx`
4. Calculate deposit APR:
   - initial/opening value.
   - closing/latest value.
   - resolved deposit rewards.
   - open date to close date or analysis timestamp.
   - no APR when denominator or dates are missing.
5. Track zero-reward deposits:
   - list deposit ids with no attributed rewards.
   - distinguish "no rewards earned" from "rewards unresolved".
   - reconcile against Rewards surface.
6. Replace unclear KPIs:
   - remove misleading total deposits sparkline.
   - rename/define capital deployed.
   - make weighted annualized estimate use valid denominators only.

### Strategies Code Tasks

1. Fix strategy row selection:
   - row click selects strategy.
   - remove `Abrir estrategia` column/button.
   - preserve Engine V2 strategy exposure ids.
2. Fix closed strategy current value:
   - active: current value.
   - closed: value at close.
3. Make KPIs global screen indicators:
   - active filter should not change global rewards/return KPIs unless explicitly labeled as filtered.
4. Split claimed rewards from total return:
   - total return = claimed rewards plus any other realized return component that is explicitly modeled.
   - if no other component exists, label as claimed rewards only.
5. Add strategy APR where denominator/time exists.
6. Redesign selected strategy panel:
   - compact badges.
   - remove ugly action buttons.
   - combine rewards and lifecycle into one dataview timeline/chart.
   - move summary below the timeline.
7. Remove or replace protocol coverage KPI.

### Primary Files

- `apps/web/src/server/deposits/*`
- `apps/web/src/features/deposits/*`
- `apps/web/src/server/strategies/*`
- `apps/web/src/features/strategies/*`

### Tests

- `apps/web/src/server/deposits/deposits.repository.test.ts`
- `apps/web/src/server/deposits/deposits.service.test.ts`
- `apps/web/src/features/deposits/deposits.urlState.test.ts`
- `apps/web/src/features/deposits/deposits.mappers.test.ts`
- `apps/web/src/server/strategies/strategies.repository.test.ts`
- `apps/web/src/server/strategies/strategies.service.test.ts`
- `apps/web/src/features/strategies/strategies.urlState.test.ts`
- `apps/web/src/features/strategies/strategies.mappers.test.ts`

## Phase 4: Rewards And Activity

### Goal

Fix token-level rendering, selection, action taxonomy, and useful data summaries.

### Rewards Code Tasks

1. Fix selected reward ids:
   - support Engine V2 scoped reward ids.
   - remove UUID-only assumptions.
   - clear selected reward on page/filter changes.
2. Fix token icons:
   - pass chainId and tokenAddress consistently.
   - ensure AERO has metadata/icon resolution.
3. Fix token amount formatting:
   - use token decimals.
   - never render raw units as the display amount.
4. Keep governance bribes evidence-backed:
   - do not infer pool from token pairs alone.
   - only resolve bribe pools when distributor/bribe contract evidence maps explicitly to pool/gauge/voter semantics.
   - otherwise keep `unresolved`/partial.
5. Replace or relabel yellow return line:
   - if it is one-day annualized APR, label as such and cap/contextualize it.
   - otherwise replace with cumulative rewards or daily reward value.
6. Clarify filtered/global KPIs.
7. Reconcile deposits with zero rewards:
   - verify whether unstake-time rewards are accounted as deposit-owned rewards.
   - produce a list of deposit ids still at zero after fix.

### Activity Code Tasks

1. Expand action contract and i18n:
   - `approval`
   - `failed`
   - `position_created`
   - `stake`
   - `unstake`
   - `cash_in`
   - `cash_out`
   - `noop`
2. Preserve raw Engine V2 event type as detail/subtype.
3. Update `normalizeAction()` and `normalizeSurface()`:
   - approvals stay approvals.
   - failed transactions stay failed.
   - `manual_position_created` / mint does not become ambiguous.
   - cash in/out do not become transfer/unknown.
4. Fix `buildSummary()`:
   - use explicit Engine V2 summary/event type before fallback.
   - do not generate `ambiguous:0x...` when deterministic action exists.
5. Enable DataTable sorting:
   - remove blanket `enableSorting: false`.
   - wire sort state to existing API sort keys.
6. Reset selected activity on context changes.
7. Format movement amounts by token decimals.
8. Redesign Activity KPIs:
   - remove "value not excluded".
   - add wallet capital in/out.
   - keep protocol volume separate.
   - show excluded spam only when non-zero.
9. Redesign charts:
   - action/surface/movement distribution.
   - coverage only as diagnostics.

### Primary Files

- `apps/web/src/server/rewards/*`
- `apps/web/src/features/rewards/*`
- `apps/web/src/server/activity/*`
- `apps/web/src/features/activity/*`
- `apps/web/src/i18n/locales/es/activity.json`
- `apps/web/src/i18n/locales/en/activity.json`
- `apps/web/src/i18n/locales/es/rewards.json`
- `apps/web/src/i18n/locales/en/rewards.json`

### Tests

- `apps/web/src/server/rewards/rewards.repository.test.ts`
- `apps/web/src/server/rewards/rewards.service.test.ts`
- `apps/web/src/features/rewards/rewards.urlState.test.ts`
- `apps/web/src/features/rewards/rewards.mappers.test.ts`
- `apps/web/src/server/activity/activity.repository.test.ts`
- `apps/web/src/server/activity/activity.service.test.ts`
- `apps/web/src/features/activity/activity.urlState.test.ts`
- `apps/web/src/features/activity/activity.mappers.test.ts`
- DB check: no deterministic approval/failed/mint rows are displayed as ambiguous.

## Phase 5: Governance Redesign

### Goal

Rebuild Governance as a lock-centered DataView with selectable locks, epoch/vote history, governance rewards, and evidence-backed details.

### Code Tasks

1. Complete governance read-model rows:
   - lock rows with current status.
   - relay/managed lock rows.
   - lock lifecycle events.
   - vote/poke/reset/extend/relock/withdraw events.
   - governance reward rows.
   - epoch summary rows derived from vote events.
2. Fix lock amount fields:
   - locked AERO.
   - veAERO exposure.
   - expiration/remaining days.
   - relay/managed status.
3. Add selected lock route state:
   - selected kind: lock/event/reward/epoch.
   - selected lock id.
   - selected reward id.
4. Replace current lock feed:
   - `GovernanceLocksRegister`
   - selected lock metric cards.
   - lock lifecycle timeline.
   - epoch voting timeline.
   - governance rewards table scoped to selected lock.
   - reward distribution panel.
   - selected detail rail.
5. Format reward amounts by token decimals.
6. Keep bribe pool attribution unresolved unless explicit evidence exists.
7. Define or hide estimated governance return:
   - no basis, no metric.
   - if implemented, denominator must be clear: locked AERO cost basis, current veAERO value, or reward APR over selected lock.

### Primary Files

- `apps/web/src/server/governance/*`
- `apps/web/src/features/governance/*`
- `apps/web/src/server/analysis/engine-v2/accounting/governance-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/classification/governance-classifier.ts`
- `apps/web/src/server/scripts/rebuild-governance-read-models.ts`

### Tests

- `apps/web/src/server/governance/governance.repository.test.ts`
- `apps/web/src/server/governance/governance.service.test.ts`
- `apps/web/src/server/governance/governance-locks.test.ts`
- `apps/web/src/features/governance/governance.urlState.test.ts`
- `apps/web/src/features/governance/governance.mappers.test.ts`
- `apps/web/src/server/analysis/engine-v2/accounting/governance-accounting.test.ts`
- `apps/web/src/server/analysis/engine-v2/classification/governance-classifier.test.ts`

## Phase 6: Cross-Screen Finalization

### Goal

Run all affected tests and verify the screens agree with the same Engine V2 read-model truth.

### Code Tasks

1. Rebuild Engine V2 read models for the reviewed wallet.
2. Run all focused test files from phases 1-5.
3. Run regression scripts:
   - activity regression.
   - rewards regression.
   - strategy regression.
   - governance regression.
4. Compare totals across screens:
   - Overview deployed value.
   - Pools current total.
   - open deposits + active strategies + open residuals.
   - rewards by owner kind.
5. Review i18n copy:
   - `Retiro` vs protocol withdrawal vs cashout.
   - partial coverage language.
   - APR/return labels.
6. Manual product signoff:
   - Overview.
   - Pools.
   - Deposits.
   - Strategies.
   - Rewards.
   - Governance.
   - Activity.

### Deliverable

A final implementation note listing:

- tests passed.
- DB checks passed.
- manual screens checked.
- remaining partial/unresolved cases and why they remain unresolved.
