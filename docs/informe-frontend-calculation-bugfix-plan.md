# Frontend Calculation Bugfix Plan

Date: 2026-06-04  
Scope: Overview, Pools, Deposits, Strategies, Rewards, Governance, and Activity screens reviewed so far.  
Primary feature context: `specs/016-analysis-engine-v2/plan.md`

## Ground Rules

- Do not keep live legacy calculation paths for the reviewed features.
- Engine V2 is the source of persisted DataView state.
- Primitive Engine V2 events must stay visible; derived events such as rebalances should be additional explanatory/read-model rows, not replacements that hide the underlying withdraw, swap, or deposit legs.
- No invented ownership or reward heuristics. Residual attribution and rebalance detection must be evidence-backed and leave ambiguous cases unresolved or partial.
- Request-time DataView APIs should read persisted rows/read models only.
- Residual balances must be token-level, pool-scoped, and inspectable.
- Existing working Engine V2 classifications and attributions must be preserved; reported Activity edge cases should be additive unless a concrete logic flaw is identified.

## Overview Bugs

### OVR-1: WETH Underlying Asset Price Shows Unavailable

#### Symptom

On Overview, capital distribution's underlying asset panel shows WETH value as unavailable under LP composition. cbBTC is valued correctly.

#### Findings

- The database has WETH price points.
- The UI estimates LP component values by matching `composition.tokens[].symbol` to direct wallet asset rows.
- cbBTC works incidentally because there is a priced direct wallet asset row for cbBTC.
- WETH inside the LP does not have a corresponding direct priced asset row, so the symbol-based lookup fails.

Relevant files:

- `apps/web/src/features/overview/capitalAllocation.utils.ts`
- `apps/web/src/server/overview/getRecentOverview.ts`
- `specs/016-analysis-engine-v2/data-model.md`

#### Fix

Move LP composition pricing out of symbol-only frontend inference and into server/read-model data.

#### Implementation Plan

1. Extend `OverviewDistributionCompositionToken` to include token address and optional value/price fields:
   - `tokenAddress`
   - `priceUsd`
   - `estimatedValueUsd`
   - `priceConfidence`
2. Update Overview composition construction to preserve token0/token1 addresses and per-token values from protocol-position/current-state readers where available.
3. Update `buildDistributionCompositionBreakdown()` to price by token address first, then fall back to server-provided `estimatedValueUsd`.
4. Keep symbol fallback only for display, not valuation.
5. Add unit coverage proving LP-only WETH can display value without a direct WETH wallet asset row.
6. Future enhancement: persist/use `wrapped_underlying_address` from token metadata enrichment so wrapped token pricing can generalize beyond WETH/cbBTC cases.

### OVR-2: Portfolio Evolution Shows Manual Rebalances As Downward Spikes

#### Symptom

Withdrawals that are followed by pool-pair swaps and redeposits are shown as sharp portfolio drawdowns, even when they are manual rebalances.

#### Findings

- Overview currently expects legacy `inferred_actions` for rebalance membership.
- Engine V2 read models exist, but `inferred_actions` is empty for the reviewed wallet.
- Engine V2 pool history currently applies raw withdraw/deposit deltas without residual continuity.
- Product/spec docs require residual attribution to prevent false pool/chart exits during rebalances.

Relevant files:

- `apps/web/src/server/overview/getRecentOverview.ts`
- `apps/web/src/server/overview/overview.repository.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `docs/spec/the-cab-product-technical-spec.md`
- `docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md`

#### Fix

Add Engine V2-native residual accounting and derived rebalance activity. Overview should consume Engine V2 activity/chart events rather than legacy `ledger_events` or `inferred_actions`.

#### Implementation Plan

1. Add Engine V2 residual state accounting:
   - On manual withdrawal/decrease/close, create residual token lots scoped to pool/deposit.
   - Track token address, raw amount, decimals, source event id, pool id, confidence, and status.
2. Add consumption accounting:
   - Swaps consume residual lots when the outgoing token matches an open residual.
   - Same-pool pair swaps create a rebalance candidate.
   - Redeposit into the same pool completes or strengthens the rebalance event.
3. Add derived Engine V2 rebalance activity rows:
   - Event type: `rebalance`
   - Evidence links: withdraw event id, swap event id(s), deposit event id when present, residual lot id(s)
   - Metadata: token flow, attributed residual amount, excess amount, confidence, reason codes
4. Do not hide underlying primitive events.
5. Update Overview chart event generation to read Engine V2 activity/read-model rows.
6. Update chart series calculation to apply net capital effect for confirmed rebalance sequences.
7. Add regression tests for withdraw -> paired swap -> same-pool deposit without time-window heuristics.

### OVR-3: Portfolio Evolution Has No Event Markers

#### Symptom

Overview chart shows no markers for swaps, claims, rebalances, cash-outs, etc.

#### Findings

- `chart.events` is empty.
- Frontend can derive markers from activity as fallback, but activity classifications no longer come from the expected legacy source.
- Engine V2 has activity read-model rows, but Overview chart generation does not use them.

#### Fix

Route Overview chart markers through Engine V2 activity/read-model rows.

#### Implementation Plan

1. Add a DB-only Engine V2 chart-event reader for Overview.
2. Map Engine V2 activity categories to chart event types:
   - `claim`
   - `cash_out`
   - `rebalance`
   - `redeploy`
   - `move_to_idle`
   - `lock`
   - `vote`
3. Include reward value where available.
4. Preserve fallback behavior only for non-Engine-V2 empty states, if needed behind explicit non-live/legacy guard.
5. Add tests that chart events are emitted from Engine V2 rows for claims and rebalances.

## Engine V2 Residual Balances

### Requirement

Residual balances must be first-class Engine V2 state. The main UI panel should show only currently open residual balances. Consumed/closed lots must remain persisted and inspectable in timeline detail.

### Proposed Model

Add or derive a persisted residual state entity with:

- `chainId`
- `walletAddress`
- `poolId`
- `sourceWithdrawalId`
- `originDepositId` when explicitly known
- `sourceDomainEventId`
- `sourceTxHash`
- `tokenAddress`
- `tokenSymbol`
- `tokenDecimals`
- `openedAmountRaw`
- `remainingAmountRaw`
- `consumedAmountRaw`
- `estimatedValueUsd`
- `pricePointId` or price evidence
- `status`
- `confidence`
- `reasonCodes`
- `openedAt`
- `updatedAt`
- `closedAt`
- `consumptionLinks`

Suggested statuses:

- `open`
- `partially_consumed`
- `rebalanced`
- `transferred_out`
- `liquidated`
- `reassigned`
- `unresolved`
- `closed`

### Implementation Plan

1. Define residual projection/types in Engine V2 accounting.
2. Persist residual rows or include them in read-model materialization with evidence links.
3. Add pool detail residual panel backed by only open/partially open residual rows.
4. Add timeline detail for consumed residual lots.
5. Enforce partial attribution: if a swap consumes more than the pool residual, only the residual-covered portion belongs to the pool rebalance.

## Future V3 Accounting: Impermanent Loss And Asset Price Effect

### Requirement

Deposits, strategies, pools, and portfolio-level views should eventually distinguish reward income from capital value changes caused by pool composition, market movement, impermanent loss, and realized swap losses.

### Current Gap

The current Engine V2 read models mostly show:

- current/close value
- deposited or entered value
- withdrawn value
- claimed rewards
- reward-only return in some surfaces

They do not consistently calculate:

- impermanent loss
- unrealized asset price effect
- realized loss or gain when residual assets are swapped below/above acquisition value
- total portfolio capital gain/loss excluding rewards

### Accounting Concept

Examples:

- If a deposit enters at `300,000 USD` and is withdrawn at `267,000 USD`, the capital-side loss is `33,000 USD` before rewards.
- If residual assets are later swapped for less than their acquisition basis, that loss becomes realized at swap time.
- If the market moves favorably, the same mechanism can produce a capital gain rather than a loss.
- At portfolio level, a simple view is: "capital invested basis vs current marked value", separate from reward income.

### Proposed Future Model

For V3, add cost-basis and mark-to-market accounting on top of Engine V2 lifecycle entities:

- `capitalBasisUsd`
- `currentMarkedValueUsd`
- `closeValueUsd`
- `unrealizedCapitalEffectUsd`
- `realizedCapitalEffectUsd`
- `impermanentLossUsd`
- `assetPriceEffectUsd`
- `rewardReturnUsd`
- `totalReturnUsd`
- `totalReturnExRewardsUsd`

Residual lots should carry token-level cost basis so realized gain/loss can be calculated when consumed:

- token address
- amount raw
- acquisition value USD
- acquisition event id
- consumption event id
- proceeds value USD
- realized gain/loss USD

### Implementation Boundary

This is not part of the current bugfix implementation unless explicitly pulled forward. For the current pass:

1. Do not fabricate impermanent-loss values.
2. Keep APR/return labels precise about whether they are reward-only or total-return based.
3. Preserve lifecycle data needed to compute cost basis later.
4. Use `assetPriceEffectUsd`, `realizedPnlUsd`, `unrealizedPnlUsd`, and `rebalanceEffectUsd` as zero/null until the accounting model is explicitly implemented.

## Pools Bugs

### POOL-1: Pools With Positions KPI Shows Historical Pool Count

#### Symptom

KPI shows 7 pools with positions. The expected active/open pool count is 5.

#### Findings

- Persisted Engine V2 pool rows mark all visible pools as active.
- Actual active state from reviewed DB:
  - 2 open manual deposits.
  - Active strategies across additional pools.
  - 2 volatile pools have only closed manual positions.

#### Fix

Pool status should derive from current open manual deposits, active strategies, and open residual balances.

#### Implementation Plan

1. In Engine V2 pool materializer, compute pool status:
   - `active`: has open/in-range manual deposit or active strategy or open residual exposure.
   - `inactive`: has open/out-of-range manual deposit and no in-range/active exposure.
   - `closed`: historical participation only, no open manual/strategy/residual exposure.
2. Rename/adjust KPI label semantics if necessary:
   - Display "Open pools" or make "Pools with positions" count only open/active exposure.
3. Update summary reduction to use computed status.
4. Add tests covering closed volatile pools.

### POOL-2: Volatile Pools Show Active Instead Of Closed

#### Symptom

Both volatile pools show status active, but they have no active deposits or strategies.

#### Findings

- Engine V2 pool rows currently hardcode `status: "active"`.

#### Fix

Use computed status from current exposure state.

#### Implementation Plan

Same as POOL-1. Add regression fixture for pools with closed historical basic/volatile deposits.

### POOL-3: Pool Current Values Are Inflated

#### Symptom

Pools screen current value shows `1,804,546.85 USD`. Expected value is closer to Overview's current portfolio value.

#### Findings

- Persisted Engine V2 pool rows contain inflated current values.
- `accountPools()` adds closed deposit close values into current manual value.
- WETH/cbBTC summary contains many closed deposit values plus the one open deposit.
- Table, KPI, and detail panel all reflect the persisted bad row.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/accounting/pool-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`

#### Fix

Current pool value must include only:

- open manual deposit current value
- active strategy current value
- open residual value

Closed deposit values must remain in history/timeline/accounting but not current value.

#### Implementation Plan

1. Update `accountPools()` to aggregate:
   - manual current value only from open manual deposits.
   - strategy current value from current estimated strategy value, not deposited value.
   - residual current value from open residual balances.
2. Persist capital entered and capital withdrawn separately.
3. Keep closed deposit close values available in timeline/history, not current summary.
4. Rebuild pool read models after changes.
5. Add tests comparing current value vs closed deposit sums.

### POOL-4: APR Unavailable Or Wrong

#### Symptom

Average APR is implausible and per-pool APR shows unavailable.

#### Findings

- Engine V2 rows persist `annualizedReturnPct: null`.
- Engine V2 rows persist `investedDays: null`.
- Repository only derives APR for older non-Engine-V2 rows.

#### Fix

Derive APR for Engine V2 pools from total rewards, net active capital, and invested days.

#### Implementation Plan

1. Compute `investedDays` during Engine V2 materialization.
2. Compute net invested/current capital:
   - `capitalInvestedUsd = max(capitalEnteredUsd - capitalWithdrawnUsd, 0)` for historical capital basis.
   - For active APR display, use current open deposited/strategy/residual value where appropriate.
3. Compute:
   - `totalReturnPct = totalRewardsUsd / denominator * 100`
   - `annualizedReturnPct = totalReturnPct * (365 / investedDays)`
4. Validate against expected rough range around 24-28% after current value fixes.
5. Add unit tests for open and closed pools.

### POOL-5: Active Range KPI Shows 0

#### Symptom

KPI says `0 of 7 active pools in range`. Expected wording is closer to `5 of 5 open pools in range`.

#### Findings

- Pool `isInRange` is persisted as `null`.
- Open deposit rows currently also have `isInRange: null`.

#### Fix

Propagate current range state from current-position enrichment into Engine V2 deposit and pool rows.

#### Implementation Plan

1. Ensure current-state enrichment stores tick/range state for open CL deposits.
2. Materialize open manual deposit `isInRange`.
3. Aggregate pool `isInRange`:
   - true when all open current positions are in range or at least active exposure is in range depending final product definition.
   - false when open manual exposure is out of range.
   - null for strategy-only/basic pools without meaningful manual range state unless strategy state can prove range.
4. Update KPI copy to use open pools count, not all historical pools.
5. Add tests for open active, open out-of-range, and closed pools.

### POOL-6: Row Expansion Does Not Show Open Deposit/Strategy Composition Reliably

#### Symptom

Clicking a row shows loading briefly, then the row collapses or no underlying open deposit/strategy appears.

#### Findings

- Expansion state is coupled to route navigation.
- Detail query powers expanded composition.
- Closed positions should be retained in Engine V2 but hidden from the expandable subtable.

#### Fix

Keep closed positions in pool history/timeline/accounting, but expose/render only open manual deposits and active strategies in the subtable.

#### Implementation Plan

1. Decouple row expansion from route navigation:
   - Expanding row should not necessarily navigate to `/pools/[poolId]`.
   - Selecting row can open detail panel; expanding row should control only subtable state.
2. Ensure expanded composition receives active-only positions:
   - manual deposits where status is not closed.
   - strategies where status is active and current value/share balance is non-zero.
3. Keep closed positions available in timeline detail.
4. Add UI tests/unit mapper tests for expanded composition filtering.

### POOL-7: Detail KPIs Match Bad Table Values

#### Symptom

Detail panel current value/APR/time invested are wrong or unavailable.

#### Findings

Detail reads the same persisted pool summary row as the table.

#### Fix

Fix Engine V2 pool summary/current value/status/APR fields. Detail should then align.

#### Implementation Plan

Covered by POOL-1 through POOL-5.

### POOL-8: Pool Performance Chart Is Actually Deposited Value Only

#### Symptom

Chart title says pool performance, but it only plots deployed/deposited value.

#### Findings

- `PoolHistoryChart` maps only `deployedValueUsd`.
- `rewardValueUsd` and `cumulativeRewardsUsd` already exist in data.

#### Fix

Show deposited/deployed value plus cumulative rewards over time, or retitle chart if only one series remains.

#### Implementation Plan

1. Update chart data to include:
   - `deployedValueUsd`
   - `cumulativeRewardsUsd`
   - optionally `residualValueUsd`
2. Use restrained semantic colors:
   - deployed: signal teal
   - rewards: mint
   - residual: amber/orange
3. Update title/copy to "Historical capital flow" or similar if aligned with brand.
4. Add mapper/component test for multiple series.

### POOL-9: Time Invested Unavailable

#### Symptom

Detail card shows time invested as unavailable.

#### Findings

- Engine V2 row persists `investedDays: null`.

#### Fix

Persist "invested days at analysis time" and recompute every analysis run.

#### Implementation Plan

1. For each pool, derive `firstParticipatedAt` from first deposit/strategy/residual participation event.
2. For closed pools, derive end from last close/withdraw/participation event.
3. For open pools, derive end from materialization timestamp/latest covered day.
4. Store the computed `investedDays`.
5. Ensure rerunning analysis updates open pool `investedDays` to the new analysis date.
6. Add tests proving open pool invested days increases when materialized with a later date.

### POOL-10: Residual Attribution Missing In Pool Detail

#### Symptom

Pool detail shows no residual attribution.

#### Findings

- Engine V2 pool rows persist `currentResidualValueUsd: 0`.
- History points persist `residualValueUsd: 0`.
- Residual model is not yet defined in Engine V2.

#### Fix

Implement token-level residual balances as described in the Engine V2 Residual Balances section.

#### Implementation Plan

1. Add residual projection/entity.
2. Materialize open residual balances into Pool detail residual panel.
3. Include consumed residual lots in timeline detail only.
4. Include residual USD in current pool value only for open residual balances.
5. Add regression coverage for residual balances across shared-token pools.

### POOL-11: Related Links Panel Should Become A Timeline Graph

#### Symptom

Current "Related links" panel is visually poor and causes duplicate-key runtime errors because related deposits are generated from repeated timeline events.

#### Findings

- `pools.service.ts` maps every timeline row with `relatedDepositId` into related links without dedupe.
- `PoolRelatedLinks.tsx` renders duplicate keys.
- The underlying data is timeline-like, not link-like.

#### Fix

Replace the related-links button panel with a branded Pool Event Timeline graph.

#### Implementation Plan

1. Remove `PoolRelatedLinks` from detail panel.
2. Replace it with a visual timeline section backed by `timeline.items`.
3. Timeline design:
   - Vertical "flight recorder" rail.
   - Small semantic icons/markers by event type.
   - Group events by day.
   - Use mono labels for hashes/technical identifiers.
   - Show value, confidence, coverage, and related entity.
   - Inline expandable detail for selected events.
4. Event type mapping:
   - deposit/stake: inbound marker, teal
   - withdraw/unstake: outbound marker, amber
   - claim/reward: rewards marker, mint
   - rebalance: swap/refresh marker, blue/gold
   - residual: token balance marker, orange
   - strategy: automated/route marker, cobalt
5. Rebalance timeline detail should show:
   - withdraw/decrease leg
   - residual attribution state
   - swap leg(s)
   - deposit/increase leg when present
   - attributed amount vs excess amount
6. Add deduping or grouping by `eventKey` and related entity to avoid React key collisions.

## Deposits Bugs

### DEP-1: KPI Cards Are Crunched Instead Of Taking Full Width

#### Symptom

Deposits KPI cards are compressed into a narrow cluster at the top of the screen instead of using the available page width.

#### Findings

- `DepositsKpiStrip` renders cards inside `CabKpiStrip`.
- `CabKpiStrip` is a generic wrapping flex row.
- `CabImpactMetricCard` has no page-specific flex-basis or grid behavior, so the cards size to content rather than distributing across the row.

Relevant files:

- `apps/web/src/features/deposits/components/DepositsKpiStrip.tsx`
- `apps/web/src/design-system/data-display/CabKpiStrip.tsx`
- `apps/web/src/design-system/data-display/CabImpactMetricCard.tsx`

#### Fix

Use a Deposits-specific KPI grid or extend `CabKpiStrip` with a layout mode that lets cards distribute across the full row.

#### Implementation Plan

1. Add a `DepositsKpiStrip.module.css` grid:
   - desktop: `repeat(5, minmax(0, 1fr))`
   - medium: `repeat(2, minmax(0, 1fr))`
   - mobile: `1fr`
2. Keep card heights stable and text non-overlapping.
3. Avoid changing global `CabKpiStrip` unless all existing consumers are checked.
4. Add a component-level snapshot/unit render check where practical.

### DEP-2: Clicking A Deposit Row Does Not Show Details

#### Symptom

Clicking a deposit row updates the URL/selection state, but the detail panel is not visible/reliable.

#### Findings

- Deposits URL state only accepts UUIDs for `selectedDepositId`.
- Engine V2 deposit ids are scoped strings such as:
  - `8453:0x827922686190790b37229fd06084350e74485b72:71663333`
  - `8453:basic_amm:0xcdac0d6c6c59727a65f871236188350531885c43`
- `parseDepositsListUrlState()` drops these ids as invalid.
- The API detail route also rejects non-UUID deposit ids.
- Mobile direct routes to `/deposits/[depositId]` therefore fail for Engine V2 ids too.

Relevant files:

- `apps/web/src/features/deposits/deposits.urlState.ts`
- `apps/web/src/server/deposits/deposits.route.ts`
- `apps/web/src/features/deposits/Deposits.container.tsx`
- `apps/web/src/app/api/deposits/[depositId]/route.ts`

#### Fix

Deposit ids must be treated as opaque Engine V2 entity ids, not UUIDs.

#### Implementation Plan

1. Replace UUID validation with an Engine V2-safe opaque id validator:
   - non-empty string
   - bounded length
   - URL-safe after decoding
   - no path separators or control characters
2. Apply the same validator to:
   - list URL `selectedDepositId`
   - API detail route param
   - mobile detail route param
3. Ensure `encodeURIComponent` is used when building direct detail links.
4. Add URL-state tests for CL and basic AMM deposit ids.
5. Add route normalization tests for Engine V2 ids.

### DEP-3: Some Deposits Have Zero Attributed Rewards

#### Symptom

Several deposit rows show `0.00 USD` rewards. With details unavailable, the affected deposits are hard to inspect from the UI.

#### Findings

Database read-model check for the reviewed wallet:

- Total Engine V2 deposits: 30
- Deposits with `totalRewardsUsd = 0`: 9
- Rewards surface unresolved rows: 0
- One zero-reward deposit has a linked `fee_claim` worth about `0.5082 USD`, but deposit materialization excludes fee claims from `totalRewardsUsd`.

Affected deposits currently showing zero deposit rewards:

| Deposit | Pool | Status | Opened | Closed | Reward surface link |
| --- | --- | --- | --- | --- | --- |
| `#71663509` | USDC / cbBTC 100 | open | 2026-06-02 | open | none |
| `#71663333` | WETH / cbBTC 100 | open | 2026-06-02 | open | none |
| `#71498850` | USDC / cbBTC 100 | closed | 2026-05-28 | 2026-06-02 | none |
| `#71272831` | WETH / USDC 100 | closed | 2026-05-23 | 2026-05-28 | none |
| `#71251309` | USDC / cbBTC 100 | closed | 2026-05-23 | 2026-05-28 | none |
| `#70406529` | WETH / cbBTC 100 | closed | 2026-05-12 | 2026-05-20 | none |
| `#69784258` | WETH / cbBTC 100 | closed | 2026-05-07 | 2026-05-12 | none |
| `#67225133` | USDC / cbBTC 100 | closed | 2026-04-17 | 2026-04-27 | fee claim only |
| `#56113878` | WETH / cbBTC 100 | closed | 2026-03-05 | 2026-03-05 | none |

#### Fix

Track these deposits explicitly while reviewing the Rewards screen. Do not invent attribution. If claims are genuinely missing from provider/decoded data, keep them zero/unresolved with reason codes. If the claims exist and link to a deposit/strategy/governance owner, fix the ownership/materialization path.

#### Implementation Plan

1. After Rewards screen review, cross-check the nine deposits above against reward rows and source events.
2. Separate three cases:
   - no claim occurred while the deposit was open
   - claim exists but is attributed elsewhere
   - claim exists but fee/reward semantics are excluded from the deposit total
3. Decide display semantics:
   - `totalRewardsUsd` should likely remain incentive rewards.
   - `feesUsd` should be surfaced separately in decomposition/return if fee claims are explicit.
4. Add a tracking table/check in regression output for deposits with zero rewards.
5. Add tests ensuring no reward is silently guessed from pool/time when explicit identity is absent.

### DEP-4: Deposit APR Is Missing For Every Deposit

#### Symptom

The APR column and detail APR fields show `—` for all deposits.

#### Findings

- All 30 persisted Engine V2 deposit rows have `estimatedAnnualizedReturnPct: null`.
- Deposit rows have enough materialized fields for a first calculation in most cases:
  - `openedAt`
  - `closedAt` for closed deposits
  - `coveredEndDayUtc` or analysis/materialization day for open deposits
  - `openedValueUsd`
  - `totalRewardsUsd`
- `aggregateSummary()` cannot compute weighted annualized return because every row APR is null.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/deposits/deposits.service.ts`
- `apps/web/src/features/deposits/components/DepositsTable.tsx`

#### Fix

Materialize deposit-level APR at Engine V2 read-model time, recomputed on every analysis run.

#### Implementation Plan

1. Add a deterministic `investedDays` or internal duration calculation for deposits:
   - closed deposit: `openedAt` to `closedAt`
   - open deposit: `openedAt` to latest covered day/materialization day
2. Compute deposit reward APR:
   - `rewardReturnPct = totalRewardsUsd / openedValueUsd`
   - `estimatedAnnualizedReturnPct = rewardReturnPct * (365 / investedDays)`
3. Guard invalid inputs:
   - null APR when `openedValueUsd <= 0`
   - null APR when duration is zero/invalid
   - preserve reason codes for partial coverage
4. Use reward APR for the Deposits APR column unless product later asks for total-return APR.
5. Add tests for open, closed, zero-reward, and zero-duration deposits.

### DEP-5: Capital Deployed KPI Is Unclear And Overlaps Latest Valuation Semantics

#### Symptom

The KPI labeled `Capital desplegado` shows `9.68%`, but it is unclear what the percentage means and it appears to overlap with latest valuation.

#### Findings

- `aggregateSummary()` calculates `capitalDeployedPctOfManual` as:
  - current open deposit value / total historical capital entered
- For the reviewed wallet:
  - open current manual value is about `161,826.47 USD`
  - total historical deposit capital entered is about `1,672,598.51 USD`
  - ratio is about `9.68%`
- The KPI is mathematically explainable, but not useful as currently labeled.

Relevant files:

- `apps/web/src/server/deposits/deposits.service.ts`
- `apps/web/src/features/deposits/components/DepositsKpiStrip.tsx`

#### Fix

Replace or rename the KPI so it communicates a useful current-state metric.

#### Implementation Plan

Preferred implementation:

1. Replace `Capital desplegado` with `Posiciones abiertas`.
2. Show `2 abiertas / 30 totales` or `2 abiertas`.
3. Use open/closed counts already present in summary.

Alternative if keeping deployed capital:

1. Rename to `Capital manual aún abierto`.
2. Show USD as primary value and percent as meta:
   - primary: current open manual value
   - meta: percent of historical entered capital
3. Do not duplicate `Última valuación` as the same primary value.

### DEP-6: Total Deposits KPI Sparkline Is Misleading

#### Symptom

The total deposits KPI has a downward-looking sparkline that does not represent a useful time series.

#### Findings

- `DepositsKpiStrip` passes `[closedCount, openOutOfRangeCount, openActiveCount]` as the series.
- For this wallet that becomes roughly `[28, 0, 2]`, which renders as a misleading downward line.
- This is categorical composition, not time-series data.

#### Fix

Remove the sparkline from this KPI until there is a real deposits-over-time series.

#### Implementation Plan

1. Pass no `series` for the total deposits KPI.
2. Optionally show meta text with open/closed count.
3. If a time series is needed later, add a real `depositCountOverTime` read-model series.

### DEP-7: Weighted Annualized Estimated KPI Is Empty/Wrong

#### Symptom

`Anualizado estimado ponderado` is empty. User does not expect this KPI to be very useful, but if it remains it should be correct.

#### Findings

- Summary calculation uses only rows where `estimatedAnnualizedReturnPct !== null && item.currentValueUsd > 0`.
- All row APRs are null.
- Closed positions have non-zero close values in `currentValueUsd`, so current-value weighting would be misleading if closed rows are included later.

#### Fix

Compute it only after DEP-4, with a clear weighting rule.

#### Implementation Plan

1. Use opened capital as the weighting denominator for all historical manual deposit rows:
   - `sum(apr * openedValueUsd) / sum(openedValueUsd)`
2. If the KPI should represent current open exposure only, rename it accordingly and filter to open deposits only.
3. Prefer removing the KPI if it does not support a workflow.
4. Add unit tests for weighted APR with closed and open deposits.

### DEP-8: Detail Panel May Reveal More Calculation Bugs After Selection Fix

#### Symptom

Additional detail-level bugs cannot be fully reviewed because row detail is currently blocked by deposit id validation.

#### Findings

Code review already shows likely detail issues:

- Detail route rejects Engine V2 ids.
- Detail APR is null for the same persisted reason as the table.
- Detail decomposition has `feesUsd: 0`, `assetPriceEffectUsd: 0`, `rebalanceEffectUsd: 0`, and PnL fields all zero for Engine V2 deposit rows.
- Value chart is lifecycle-event based, so it may be sparse or misleading for deposits with only mint/stake/withdraw events.

#### Fix

Fix detail access first, then perform a second UI review of detail cards/charts/timeline.

#### Implementation Plan

1. Complete DEP-2 so all deposit ids can open details.
2. Re-review detail panel with CL and basic AMM deposits:
   - an open CL deposit
   - a closed CL deposit with rewards
   - a zero-reward deposit
   - a volatile/basic AMM deposit
3. Decide whether fees, asset price effect, and rebalance effect should be added to Engine V2 deposit decomposition in this bugfix round or split into a later accounting task.
4. Add detail mapper/materializer tests for whatever fields are fixed.

## Strategies Bugs

### STRAT-1: Current Value KPI Sparkline Is Misleading

#### Symptom

`Valor actual` shows a downward sloping graph that does not communicate a meaningful trend.

#### Findings

- `StrategiesKpiStrip` uses the currently visible strategy rows as the sparkline series.
- The series is `viewModel.items.map((item) => item.currentEstimatedValueUsd)`.
- This is a per-row ranking sequence, not a time series.
- Sorting/filtering changes the line shape, so the visual suggests movement where none exists.

Relevant files:

- `apps/web/src/features/strategies/components/StrategiesKpiStrip.tsx`
- `apps/web/src/server/strategies/strategies.service.ts`

#### Fix

Remove the sparkline from the current value KPI until a real historical strategy value series is available.

#### Implementation Plan

1. Pass no `series` for the strategy current value KPI.
2. If trend is desired later, materialize a global strategy value over time series from Engine V2 history.
3. Do not use row-order values as KPI trend data.

### STRAT-2: Closed Strategy Current Value Should Show Closing Value

#### Symptom

Closed strategies show `0.00 USD` as current value. User expects the value at closing, matching the Deposits screen behavior.

#### Findings

- Reviewed DB state has 5 strategies:
  - 4 active strategies.
  - 1 closed strategy: `Mellow WETH / cbBTC 100`.
- The closed strategy has:
  - `currentEstimatedValueUsd: 0`
  - `withdrawnValueUsd: 8143.10`
  - `depositedValueUsd: 17093.03`
  - `currentSharesRaw: 0`
- Engine V2 strategy materializer derives `currentEstimatedValueUsd` from current shares, so closed rows collapse to zero.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/accounting/strategy-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/features/strategies/components/StrategiesTable.tsx`

#### Fix

Persist separate strategy value concepts:

- `currentEstimatedValueUsd`: open/current value, zero or null for closed exposure.
- `closeValueUsd`: value at close/withdrawal for closed exposure.
- `displayValueUsd`: current value for active strategies, close value for closed strategies.

#### Implementation Plan

1. Extend Engine V2 strategy projection/read model with `closeValueUsd` or equivalent.
2. On final withdraw/redeem/close, store the event USD value as close value.
3. In Strategies table/detail, render:
   - active: current estimated value
   - closed: closing value
4. Keep KPI current value global to currently open strategies only unless the label changes.
5. Add materializer tests for closed strategy display value.

### STRAT-3: KPI Values Are Filtered, But Should Be Global Screen Indicators

#### Symptom

When filtering the table, KPIs such as `Recompensas reclamadas` change. User expects KPIs to remain global indicators for the screen.

#### Findings

- `findStrategySummaries()` applies request filters and pagination.
- `buildStrategiesListResponse()` builds KPIs from `input.rows`, which are the filtered/page rows.
- With active filter:
  - claimed rewards: about `28,162.04 USD`
- With all filter:
  - claimed rewards: about `29,903.40 USD`
- The filter difference is the closed WETH/cbBTC strategy rewards, about `1,741.37 USD`.

Relevant files:

- `apps/web/src/server/strategies/strategies.repository.ts`
- `apps/web/src/server/strategies/strategies.service.ts`

#### Fix

Return global KPI aggregates separately from filtered table rows.

#### Implementation Plan

1. Repository should return:
   - filtered paginated rows for the table.
   - unfiltered rows or precomputed aggregate summary for KPIs.
2. KPIs should use the unfiltered aggregate by default.
3. If filtered KPIs are ever needed, show them as explicitly filtered context, not primary KPI cards.
4. Add service tests proving filtering the table does not change global KPI totals.

### STRAT-4: Claimed Rewards And Total Return Are The Same Value

#### Symptom

`Recompensas reclamadas` and `Retorno total` show identical amounts.

#### Findings

- Engine V2 strategy materializer currently sets:
  - `totalRewardsUsd = strategy.rewardsUsd`
  - `totalReturnUsd = strategy.rewardsUsd`
  - `totalReturnPct = null`
  - `estimatedAnnualizedReturnPct = null`
- Strategy accounting does persist deposited and withdrawn values, but materialized total return does not use them.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/accounting/strategy-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/features/strategies/components/StrategiesKpiStrip.tsx`

#### Fix

Define and materialize strategy return separately from claimed rewards.

#### Implementation Plan

Preferred strategy-level return formula:

1. For active strategies:
   - `totalReturnUsd = currentEstimatedValueUsd + withdrawnValueUsd + totalRewardsUsd - depositedValueUsd`
2. For closed strategies:
   - `totalReturnUsd = closeValueUsd + totalRewardsUsd - depositedValueUsd`
   - If `withdrawnValueUsd` is the close value, use it as the close-value leg.
3. Compute `totalReturnPct = totalReturnUsd / depositedValueUsd` where denominator exists.
4. Keep `claimedRewardsUsd` as reward-only.
5. Add tests showing rewards and total return diverge when capital value changes.

Open question:

- User mentioned total return could also mean "total returned". If that is preferred, label it explicitly as `Capital returned + rewards` and calculate `withdrawnValueUsd + totalRewardsUsd`, not profit/loss.

### STRAT-5: Strategy APR Is Missing

#### Symptom

The APR column shows `—` for every strategy.

#### Findings

- All reviewed strategy rows have `estimatedAnnualizedReturnPct: null`.
- Engine V2 strategy materializer does not calculate strategy invested days or annualized return.

#### Fix

Materialize strategy APR with the same analysis-time semantics as pool/deposit APR.

#### Implementation Plan

1. Derive strategy invested days:
   - active: first strategy deposit to analysis/materialization day.
   - closed: first strategy deposit to final withdraw/close.
2. Compute APR using a clearly named return basis:
   - reward APR: `totalRewardsUsd / depositedValueUsd * 365 / investedDays`
   - total return APR: `totalReturnUsd / depositedValueUsd * 365 / investedDays`
3. Pick one basis for the table label and keep the other out unless explicitly shown.
4. Add tests for active, closed, zero-duration, and partial-coverage strategies.

### STRAT-6: Row Click/Selection Does Not Reliably Open Strategy Details

#### Symptom

Clicking a strategy row does not reliably select/show that strategy in the detail panel. The table also has an `Abrir estrategia` column/button, which should be removed.

#### Findings

- Strategy URL state validates `selectedStrategyId` as a UUID.
- Engine V2 strategy ids are scoped strings such as `8453:0xcd975e6a5f55137755487f0918b8ca74acce7925`.
- Invalid selected ids are dropped from URL state.
- The API detail route also rejects non-UUID ids.
- `applyStrategiesListRequest()` falls back to the first visible row when the selected id is not present in the filtered page.
- The table has both `onRowSelect` and a row action button column for the same action.

Relevant files:

- `apps/web/src/features/strategies/strategies.validation.ts`
- `apps/web/src/features/strategies/strategies.urlState.ts`
- `apps/web/src/server/strategies/strategies.route.ts`
- `apps/web/src/server/strategies/strategies.repository.ts`
- `apps/web/src/features/strategies/components/StrategiesTable.tsx`

#### Fix

Treat strategy ids as opaque Engine V2 entity ids and make row click the single selection action.

#### Implementation Plan

1. Replace UUID validation for `selectedStrategyId` and detail route strategy id with opaque Engine V2-safe validation.
2. Remove the `Abrir estrategia` column and action button.
3. Keep `onRowSelect` as the only table selection action.
4. Preserve selected strategy across filters when it exists globally, even if it is not on the current page, or clearly clear selection when filters exclude it.
5. Add URL-state, route, and mapper tests for scoped strategy ids.

### STRAT-7: Detail Panel Needs Dataview Redesign

#### Symptom

The detail panel feels visually inconsistent with the desired futuristic DataView style:

- confidence/coverage badges are oversized and bloated.
- `Abrir pool` and `Recompensas` buttons break the visual language.
- `Resumen`, `Recompensas reclamadas`, and `Linea de vida` are plain cards/tables.
- bottom coverage note is visually heavy and repetitive.

#### Findings

- `StrategySelectedPanel` stacks:
  - header card with metric cards, badges, and buttons.
  - `StrategyExposureSummary`.
  - `StrategyRewardsTable`.
  - `StrategyLifecycleTimeline`.
  - `StrategyCoverageNote`.
- Rewards and lifecycle are separate views even though they describe the same chronological story.

Relevant files:

- `apps/web/src/features/strategies/components/StrategySelectedPanel.tsx`
- `apps/web/src/features/strategies/components/StrategyExposureSummary.tsx`
- `apps/web/src/features/strategies/components/StrategyRewardsTable.tsx`
- `apps/web/src/features/strategies/components/StrategyLifecycleTimeline.tsx`
- `apps/web/src/features/strategies/components/StrategyCoverageNote.tsx`
- `apps/web/src/features/strategies/StrategiesWorkspace.module.css`

#### Fix

Replace the table-heavy detail panel with a single strategy activity graph/timeline and move summary context lower.

#### Implementation Plan

1. Header:
   - Keep title, pool label, compact value/return/share chips.
   - Replace large badges with subtle status dots or compact chips.
   - Remove `Abrir pool` and `Recompensas` buttons from the header.
2. Main graph:
   - Merge rewards and lifecycle into one chronological DataView graph.
   - Use event icons for deposit, claim, withdraw, close, and unresolved events.
   - Plot cumulative rewards as an incrementing line.
   - Plot strategy value/share value as a second line when history exists.
   - Show event value markers.
   - Provide hover/popover detail for tx hash, raw shares, token amount, coverage reasons, and value evidence.
3. Summary:
   - Move `Resumen de exposicion` below the graph.
   - Keep it compact and scalar, not a top-level visual card.
4. Coverage note:
   - Move to bottom.
   - Make it a compact diagnostic strip rather than a large warning card.
5. Add mapper tests for graph event construction from existing `rewards`, `lifecycle`, and `history` arrays.

### STRAT-8: Protocol Coverage KPI Is Not Useful

#### Symptom

`Cobertura del protocolo` shows `0%`, which does not communicate useful product meaning.

#### Findings

- The KPI formula is:
  - count rows with `coverageStatus` full/share-level divided by row count.
- Reviewed strategy rows all have `coverageStatus: partial`, so the value is `0%`.
- Each KPI card also shows `Cobertura parcial` as meta, creating duplicate and confusing coverage messaging.

Relevant files:

- `apps/web/src/server/strategies/strategies.service.ts`
- `apps/web/src/features/strategies/components/StrategiesKpiStrip.tsx`

#### Fix

Remove the protocol coverage KPI or replace it with a diagnostic coverage state.

#### Implementation Plan

Preferred implementation:

1. Remove `Cobertura del protocolo` from KPI strip.
2. Keep a single compact coverage indicator near the filter bar or detail diagnostics.
3. Do not show a percent unless it maps to a user-understandable coverage scope.

Alternative:

1. Rename it to `Estrategias con cobertura completa`.
2. Show `0 de 5`.
3. Keep reasons visible in diagnostic detail, not as primary KPI.

## Rewards Bugs

### REW-1: Reward Rows And Detail Stop Selecting On Click

#### Symptom

Clicking a reward row does not reliably select the row or update the detail rail. Switching pages should also reset the selected reward/detail, but currently selection can remain stale.

#### Findings

- Rewards URL state validates `selectedRewardEventId` as a UUID.
- Engine V2 reward ids are opaque scoped keys such as:
  - `0x23f1f251ab4f41495fab927542827a65d25b9c6bec7a4d169bd625768cbc44a7:governance_bribe_claim`
  - `0xf4b7eb62...05c1cf68:fee_claim`
- `RewardsEventsTable` calls `onStateChange({ ...state, selectedRewardEventId: rewardEventId })`, but `parseRewardsUrlState()` drops the id on the next URL parse.
- `poolId`, `depositId`, and `strategyExposureId` filters have the same UUID-only assumption and can drop Engine V2 scoped ids.
- Pagination handlers preserve `selectedRewardEventId`, so even after fixing selection, changing page can point the detail rail at an off-page/stale event.

Relevant files:

- `apps/web/src/features/rewards/rewards.validation.ts`
- `apps/web/src/features/rewards/rewards.urlState.ts`
- `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- `apps/web/src/features/rewards/Rewards.container.tsx`

#### Fix

Treat reward, pool, deposit, and strategy ids as opaque Engine V2 entity ids in Rewards URL state. Clear selected reward when pagination or page-size changes.

#### Implementation Plan

1. Replace UUID validation for `selectedRewardEventId`, `poolId`, `depositId`, and `strategyExposureId` with bounded opaque-id validation:
   - non-empty
   - max length
   - no control characters
   - no path separators when used in routes
2. Keep `tokenAddress` validation as an address validator.
3. Update `onPageChange` and `onPageSizeChange` to set `selectedRewardEventId: null`.
4. Decide whether filter changes also clear selection; preferred behavior is clear selection when a filter or page change can remove the row from the visible table.
5. Add URL-state tests for Engine V2 reward ids and scoped deposit/strategy/pool filters.

### REW-2: Token Icons Are Missing Or Poorly Rendered

#### Symptom

Token icons do not display well in the selected reward detail rail. AERO is not properly displayed in the rewards table.

#### Findings

- `SelectedRewardRail` renders `CabTokenIcon` without `chainId`, so Base-specific address and symbol overrides cannot resolve there.
- `CabTokenIcon` only has explicit Base overrides for WETH, cbBTC, USDC, and EURC.
- AERO address `0x940181a94a35a4569e4529a3cdfb74e38fd98631` is not included in `BASE_TOKEN_ADDRESS_OVERRIDES` or `BASE_TOKEN_SYMBOL_MAP`.
- Engine V2 rewards rows persist `token.iconUrl: null`, so the design-system fallback is responsible for AERO.

Relevant files:

- `apps/web/src/features/rewards/components/SelectedRewardRail.tsx`
- `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- `apps/web/src/design-system/data-display/CabTokenIcon.tsx`
- `apps/web/src/design-system/tokens/tokenAssets.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`

#### Fix

Pass `chainId` everywhere token icons render and add a Base AERO token asset override. Preserve generic fallback for unknown tokens.

#### Implementation Plan

1. Add Base AERO to `BASE_TOKEN_ADDRESS_OVERRIDES` and `BASE_TOKEN_SYMBOL_MAP`.
2. Pass `chainId={viewModel.chainId}` or selected reward chain id into `SelectedRewardRail`.
3. Consider persisting token icon URLs from token metadata only when the source is trusted; otherwise rely on local address/symbol overrides.
4. Add a small unit test for `resolveCabTokenIcon()` resolving WETH, cbBTC, USDC, EURC, and AERO on Base.
5. Confirm detail and table use the same icon resolution inputs.

### REW-3: Token Amounts Are Displayed In Raw Units

#### Symptom

The rewards table `Cantidad` field shows strange values. Examples from screenshots and DB:

- USDC governance bribe row shows `599` while claim value is about `12.44 USD`.
- AERO rows persist values like `5201679121050002365`, which are raw 18-decimal token units.

#### Findings

- Engine V2 reward rows persist `tokenAmount` as `reward.amountRaw`.
- `RewardsEventsTable` renders `row.original.tokenAmount` directly.
- `SelectedRewardRail` also renders the same raw amount.
- `mapRewardEventRow()` can use `metadata.amountFormatted`, but Engine V2 rows do not currently persist `amountFormatted`.
- Token metadata with decimals exists in Engine V2 materialization context, but rewards row materialization is not using it for display amount.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/rewards/rewards.repository.ts`
- `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- `apps/web/src/features/rewards/components/SelectedRewardRail.tsx`

#### Fix

Persist and display both raw and formatted token amounts.

#### Implementation Plan

1. In Engine V2 reward materialization, include:
   - `tokenAmountRaw`
   - `tokenAmountFormatted`
   - `tokenDecimals`
2. Format using token metadata decimals.
3. For missing decimals:
   - keep raw amount available in diagnostic detail.
   - display amount as unavailable/partial rather than guessing decimals.
4. Update Rewards repository normalization to prefer `tokenAmountFormatted`.
5. Update table/detail to show formatted amount plus token symbol.
6. Add materializer tests for USDC 6 decimals and AERO/WETH 18 decimals.

### REW-4: Governance Bribes Have Unresolved Pool Attribution

#### Symptom

Governance bribe rewards show unresolved pool attribution even though the decoded input includes `_bribes` and `_tokens`, and inbound token transfers correlate with bribe sources.

#### Findings

- Local ABI confirms Aerodrome Voter `claimBribes(address[] _bribes, address[][] _tokens, uint256 _tokenId)`.
- Aerodrome Voter source loops `_bribes[i]` and calls `IReward(_bribes[i]).getReward(_tokenId, _tokens[i])`.
- The reviewed DB row for tx `0x23f1f251ab4f41495fab927542827a65d25b9c6bec7a4d169bd625768cbc44a7` is a single `governance_bribe_claim` row with:
  - owner status governance
  - token USDC
  - partial coverage
  - `poolContribution.status = unresolved`
  - reason `missing_distributor_pool_link`
- Project specs already require `claimBribes` child items by decoded bribe/token arrays plus matching transfer logs, and distributor-to-pool mapping via `Voter.GaugeCreated` or equivalent registry evidence.
- A token pair from `_tokens[i]` is useful evidence, but it is not enough alone to assign a pool when multiple pools can share token pairs, fee tiers, factories, or historical contexts.

Relevant files/specs:

- `docs/api-research/abis/base-8453/0x16613524e02ad97edfef371bc883f2f5d6c480a5.json`
- `specs/016-analysis-engine-v2/research.md`
- `specs/016-analysis-engine-v2/plan.md`
- `apps/web/src/server/analysis/engine-v2/accounting/reward-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- Aerodrome contracts source: `Voter.claimBribes(...)`

#### Fix

Materialize governance bribe child items from explicit bribe contract and token-array evidence, then resolve pool only when a distributor-to-pool link is explicit.

#### Implementation Plan

1. Decode `claimBribes` call arguments into child claim candidates:
   - `bribeContractAddress = _bribes[i]`
   - `rewardTokenAddresses = _tokens[i]`
   - `lockTokenId = _tokenId`
2. Match each child candidate to transfer logs from the corresponding bribe contract to the wallet.
3. Persist one reward item per matched transfer/log, keyed by `(txHash, logIndex)`.
4. Resolve pool using explicit evidence only:
   - known `bribeVotingReward -> pool` mapping from `Voter.GaugeCreated`
   - persisted protocol known-address mapping
   - decoded event metadata that already carries pool id
5. If no distributor-to-pool evidence exists:
   - keep `poolContribution.status = unresolved` or `none`
   - retain bribe contract, token list, and lock token id in detail evidence
   - do not infer from token pair alone
6. Add an enrichment need for missing distributor-to-pool links.
7. Add regression coverage for multi-bribe/multi-token claim transactions.

### REW-5: Rewards Chart Yellow Return Line Spikes To Unrealistic Percentages

#### Symptom

The yellow line in `Rewards en el tiempo` reaches values such as `2200%`, which reads as an impossible portfolio return.

#### Findings

- The line is `estimatedRewardReturnPct`.
- `buildOverTime()` buckets rewards by day.
- For each day, `calculateEstimatedRewardReturn()` annualizes that day's reward value against historical capital:
  - `annualizedReturnPct = rewardValueUsd / averageCapitalUsd * 365 / daySpan * 100`
- Because `daySpan` is effectively 1 for daily buckets, high-reward days are annualized into large APR-like spikes.
- The label/tooltip says "Return", so the metric appears to be cumulative return or portfolio performance, but it is actually one-day annualized reward yield.

Relevant files:

- `apps/web/src/server/rewards/rewards.service.ts`
- `apps/web/src/features/rewards/components/RewardsOverTimePanel.tsx`
- `apps/web/src/design-system/data-display/CabRewardsTimelineChart.tsx`

#### Fix

Replace or relabel the yellow series with a metric that matches user expectations.

#### Implementation Plan

Preferred implementation:

1. Keep bars as claimed reward USD by day.
2. Replace yellow daily annualized line with cumulative claimed rewards or rolling reward APR:
   - cumulative rewards: intuitive, no misleading annualization.
   - rolling 30-day APR: useful but must be explicitly labeled `APR estimado 30d`.
3. If daily annualized APR is retained, rename it everywhere to `APR diario anualizado estimado` and add tooltip wording that it annualizes a single-day reward.
4. Update KPI copy to avoid calling reward APR "return" without basis.
5. Add service tests showing daily buckets do not produce unlabeled `return` values.

### REW-6: Zero-Reward Deposits Are Not The Same As Unresolved Rewards

#### Symptom

The deposits screen shows several deposits with no rewards, but Rewards screen does not show unresolved rewards.

#### Findings

- A DB check earlier found zero unresolved reward rows in the Rewards surface for the reviewed wallet.
- The nine tracked zero-reward deposits are therefore not currently "unresolved reward rows"; they are deposits with no linked reward rows or fee-only rows excluded from deposit `totalRewardsUsd`.
- `sumOwnedRewardClaimsUsd()` explicitly excludes reward types containing `fee`, so fee claims do not contribute to deposit `totalRewardsUsd`.
- Engine V2 reward accounting can split `manual_pool_fee_claim` into fee claim reward rows, but deposit materialization does not count those as deposit rewards.
- This may be correct if `totalRewardsUsd` is intended to mean incentive rewards only, but the UI currently lacks a visible split that explains fee claims vs reward claims.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/accounting/reward-accounting.ts`
- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/deposits/deposits.service.ts`
- `docs/research/the-cab-aerodrome-claim-surfaces-research.md`

#### Fix

Make reward categories explicit and audit unstake/withdraw-related reward flows without guessing ownership.

#### Implementation Plan

1. Keep deposit incentive rewards and LP fee claims as separate fields:
   - `rewardClaimsUsd`
   - `feeClaimsUsd`
   - `totalYieldUsd` if product wants them combined
2. In Deposits, show zero incentive rewards with explicit fee/reward breakdown when fee claims exist.
3. Audit the nine zero-reward deposits against:
   - `manual_pool_fee_claim`
   - `manual_gauge_reward_claim`
   - reward movements emitted during unstake/withdraw transactions
4. If unstake transactions include reward transfers with explicit deposit identity, materialize them as reward rows linked to the deposit.
5. If ownership is not explicit, leave the row partial/unresolved and show the missing evidence reason.
6. Add regression checks for "deposit has no rewards" vs "reward unresolved" vs "fee-only deposit".

### REW-7: Rewards KPIs Are Filtered By Current Table Filters

#### Symptom

When the Rewards screen is filtered by source/token/entity, KPI totals change to the filtered subset. This may be useful for analysis, but it differs from the user's stated expectation on Strategies that primary KPIs should be global indicators.

#### Findings

- `findRewards()` returns `allRows: filtered`.
- `buildRewardsResponse()` builds summary/KPIs from `repository.allRows`.
- Therefore KPIs represent the current filtered query, not global wallet rewards.
- This is visible in the screenshots where deposits/USDC filtered views show small KPI totals.

Relevant files:

- `apps/web/src/server/rewards/rewards.repository.ts`
- `apps/web/src/server/rewards/rewards.service.ts`
- `apps/web/src/features/rewards/components/RewardsKpiStrip.tsx`

#### Fix

Decide a consistent product rule for DataView KPI semantics. Based on Strategies feedback, primary KPIs should likely be global, with filtered totals shown as contextual sub-metrics.

#### Implementation Plan

1. Repository should return:
   - global normalized rows for KPI summary.
   - filtered rows for table/chart/detail.
2. KPI cards should use global rows unless explicitly labeled as filtered.
3. When filters are active, show a compact "filtered selection" summary near the filter bar or chart.
4. Add service tests proving table filters do not mutate global KPI totals.

## Governance Bugs And Redesign

### GOV-1: Governance Page Has Drifted From The Intended DataView Subject

#### Symptom

The current Governance page feels like a mixed event/history feed rather than a DataView about governance locks. The `Estado del lock` card lists several lock blocks plus lifecycle snippets, but it is not clear what lock is selected or how to inspect another lock.

#### Findings

- The Governance spec requires first-screen surfaces:
  - KPI strip
  - persistent lock status panel
  - compact vote timeline by epoch
  - governance rewards table
  - reward-type/value breakdown
  - selected-detail inspection panel
- Current `GovernanceLockPanel` maps every lock row into a stacked key-value block, then appends up to four lifecycle events per lock.
- There is no lock table/list interaction equivalent to reward row selection.
- URL state supports selected `event`, `reward`, `epoch`, and `metric`, but not selected `lock`.
- The mockup was interpreted too narrowly as a single-lock view. The product needs a lock-centered DataView that supports multiple past/current locks, managed/relay locks, and direct wallet locks.

Relevant files/specs:

- `specs/015-governance-engine-dataview/spec.md`
- `specs/015-governance-engine-dataview/contracts/governance-ui.md`
- `apps/web/src/features/governance/components/GovernanceLockPanel.tsx`
- `apps/web/src/features/governance/components/GovernanceEpochTimeline.tsx`
- `apps/web/src/features/governance/components/SelectedGovernanceRail.tsx`
- `apps/web/src/server/governance/governance.types.ts`

#### Fix

Redesign Governance as a lock-centered DataView. The selected lock becomes the page subject, and rewards/events/epochs become filtered analytical surfaces for that selected lock.

#### Enhanced Page Design

Top KPI strip, global wallet governance:

- `AERO locked`: sum of current active locks where current lock amount is known.
- `veAERO exposure`: sum of active/direct plus managed exposure where known.
- `Locks`: active / managed / historical count, replacing a vague single expiry card when multiple locks exist.
- `Governance rewards`: global claimed governance rewards with coverage state.
- `Estimated governance APR`: only when denominator and time basis are available; otherwise unavailable with reason.
- `Coverage`: compact overall coverage state.

Main content:

1. `Locks Register` table/list as the primary left/upper panel:
   - columns: lock id, kind, status, relay/managed state, locked AERO, veAERO, expiry, last activity, rewards claimed, coverage.
   - rows include current locks, historical locks, managed deposits, relay participation, and partial/unknown lock shells.
   - row click selects the lock.
   - filters: active, expired, withdrawn, relay/managed, direct, partial/unknown.
2. `Selected Lock Header`:
   - compact chips for lock id, status, kind, managed token id, coverage, confidence.
   - primary metric cards scoped to the selected lock:
     - locked AERO
     - veAERO
     - expiry/remaining days
     - rewards claimed
     - last vote/last activity
3. `Lock Lifecycle Rail`:
   - horizontal or vertical timeline for create, increase, extend, deposit-managed, relay join/exit, relock, withdraw.
   - each node shows event type, timestamp, amount/duration delta, tx hash in popover, and coverage.
4. `Voting Timeline By Epoch`:
   - epoch cards or compact timeline filtered to selected lock.
   - each epoch shows voted pools, weights, vote mode, reset state, relay/manual state, claim status, fees/bribes/rebases.
   - clicking an epoch selects epoch detail in the rail.
5. `Governance Rewards` table:
   - rows filtered by selected lock by default, with a toggle for all governance rewards.
   - columns: date, reward type, token, formatted amount, USD value, epoch, pool when explicit, coverage, confidence.
   - clicking a reward selects reward detail.
6. `Reward Distribution`:
   - donut + horizontal bars by type: fees, bribes, rebases, relay rewards, unknown.
   - scoped to selected lock by default.
7. `Selected Detail Rail`:
   - changes based on selected reward, epoch, lifecycle event, vote, or lock.
   - shows transaction, protocol surface, token movements, value effect, pool/epoch context, evidence, missing evidence, and explicit links.

Layout guidance:

- Keep the mockup's visual language: dense panels, teal/cobalt/gold/violet semantic accents, compact chips, mono identifiers, and timeline nodes.
- Avoid turning the page into a raw transaction explorer.
- Avoid large warning/badge blobs; use small chips and diagnostic strips.
- No generic related-links button panels. Links should live inside detail context rows.

### GOV-2: Persisted Lock Rows Lack Current Lock Amount And veAERO Exposure

#### Symptom

KPI cards show "No disponible" for AERO locked, veAERO exposure, lock expiry, and estimated return.

#### Findings

DB read-model check for the reviewed wallet:

- Governance surface rows: 67.
- Lock rows: 3.
- Event rows: 42.
- Reward rows: 19.
- Metric rows: 1.
- Epoch rows: 0.
- Lock rows include:
  - direct lock `10879930269062516265282`, status active, lifecycle count 2.
  - unknown lock `110971`, status active, lifecycle count 41.
  - deposited-managed lock `113464`, status partial, lifecycle count 1.
- All three lock rows currently have:
  - `lockedAeroAmount: null`
  - `veAeroExposure: null`
- Summary KPI builder uses the primary lock row, so null lock fields become unavailable KPIs.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/governance/governance.service.ts`
- `apps/web/src/server/governance/governance.repository.ts`

#### Fix

Engine V2 must persist current lock state per lock, not just lifecycle event history.

#### Implementation Plan

1. Define a first-class lock exposure projection:
   - `lockExposureId`
   - `lockId`
   - `lockKind`
   - `status`
   - `currentLockedAeroRaw`
   - `currentLockedAeroDecimal`
   - `currentLockedAeroValueUsd`
   - `currentVeAero`
   - `createdAt`
   - `expiresAt`
   - `managedTokenId`
   - `relayState`
   - `ownerMode`
   - `coverageState`
   - `confidence`
   - `reasonCodes`
2. Source current values from explicit lock events plus current protocol state snapshots when available.
3. For managed/relay locks, distinguish:
   - user's deposited lock
   - managed lock token
   - relay/managed position state
4. Materialize lock rows even when partial, but keep null fields visibly unavailable with missing evidence reasons.
5. Add regression tests for direct lock, managed deposit, unknown/partial lock shell, and withdrawn/expired lock.

### GOV-3: Epoch Timeline Is Empty Despite Vote Events

#### Symptom

The central panel says no epoch vote summaries were materialized, even though the screen and DB include many `vote_cast` governance events.

#### Findings

- The reviewed Engine V2 governance surface has many `vote_cast` events for lock token `110971`.
- The same surface has zero `epoch` rows.
- `GovernanceEpochTimeline` can render epoch cards, but it receives an empty array.
- The mockup's epoch cards are the right direction, but the engine is not grouping votes/rewards into epoch summaries.

Relevant files/specs:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/governance/governance.repository.ts`
- `specs/015-governance-engine-dataview/spec.md`
- `specs/015-governance-engine-dataview/data-model.md`

#### Fix

Materialize lock-scoped governance epoch summaries from vote, poke/reset, relay, and claim events.

#### Implementation Plan

1. Determine epoch id/start/end from explicit governance event metadata or protocol epoch boundaries.
2. Group events by:
   - `chainId`
   - `walletAddress`
   - `lockId`
   - `epochId`
3. Persist per-epoch summary:
   - voted pools
   - weights when explicit
   - vote mode: manual, relay, mixed, unknown
   - reset state
   - claim state
   - fees/bribes/rebases USD where explicit
   - coverage/confidence
4. Link rewards to epoch only when reward event or claim call evidence carries the lock/epoch relation.
5. Keep epoch partial when pool or reward distributor evidence is missing.
6. Add regression test proving `vote_cast` events produce epoch cards for the selected lock.

### GOV-4: Lock Selection Is Missing From URL State And UI

#### Symptom

The page can show selected reward/event detail, but there is no obvious way to select a lock. The detail panel does not make the selected subject clear.

#### Findings

- `GovernanceFilters.selectedKind` supports `event`, `reward`, `epoch`, and `metric`, not `lock`.
- `resolveSelectedDetailTarget()` can resolve reward, event, or epoch, then falls back to the first visible reward/event/epoch.
- `GovernanceLockPanel` has no `onLockSelect` behavior.
- The page therefore starts with a selected reward detail even though the user is trying to reason about locks.

Relevant files:

- `apps/web/src/server/governance/governance.types.ts`
- `apps/web/src/features/governance/governance.validation.ts`
- `apps/web/src/features/governance/governance.urlState.ts`
- `apps/web/src/server/governance/governance.repository.ts`
- `apps/web/src/server/governance/governance.service.ts`
- `apps/web/src/features/governance/components/GovernanceLockPanel.tsx`

#### Fix

Add `selectedKind: "lock"` and make lock row selection the default subject when locks exist.

#### Implementation Plan

1. Extend selected kind enum to include `lock`.
2. Add URL support for `selectedLockId` or `kind=lock&selected=...`.
3. Add repository selected-target resolution for lock rows.
4. Add `selectedDetailFromLock()`:
   - lock id/status/kind
   - current locked/veAERO metrics
   - lifecycle summary
   - managed/relay context
   - coverage/evidence
5. Update selection fallback:
   - first selected/current active lock
   - then reward/event/epoch only if no locks exist.
6. On lock table row click, set `selectedKind: "lock"` and `selectedGovernanceId`.
7. On reward/epoch/lifecycle click, preserve selected lock context and set a secondary detail selection if needed.

### GOV-5: Governance Rewards Amounts Are Raw Units

#### Symptom

Governance rewards table shows values such as:

- AERO `8.818.257.679.528.628.000`
- WETH `12.910.403.926`
- USDC `1004`

These are raw token amounts, not human-readable token amounts.

#### Findings

- Governance reward rows persist `reward.amount = reward.amountRaw`.
- `mapReward()` uses `row.amountDecimal ?? row.amountRaw` for normalized table rows.
- Engine V2 governance reward rows do not currently persist formatted `amountDecimal`.
- This is the same raw amount problem identified in Rewards.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/dataview-materializers.ts`
- `apps/web/src/server/governance/governance.repository.ts`
- `apps/web/src/features/governance/components/GovernanceRewardsTable.tsx`

#### Fix

Persist raw and decimal-formatted amounts for governance rewards using token decimals.

#### Implementation Plan

1. Add to governance reward read models:
   - `amountRaw`
   - `amountDecimal`
   - `tokenDecimals`
2. Format amounts using Engine V2 token metadata.
3. If decimals are unavailable, show amount unavailable/partial while keeping raw amount in diagnostic detail.
4. Keep this implementation shared with Rewards amount formatting where possible.
5. Add tests for AERO 18 decimals, WETH 18 decimals, USDC 6 decimals, and missing decimals.

### GOV-6: Governance Reward Pool Attribution Is Partial And Must Stay Evidence-Backed

#### Symptom

Governance bribes show `No disponible` for pool, even when claim inputs expose bribe contracts and token arrays.

#### Findings

- This overlaps with `REW-4`.
- Governance reward rows preserve bribe/rebase rows and coverage, but pool association is partial unless distributor-to-pool evidence exists.
- Specs require Governance to keep unsupported/partial rows visible and not fabricate pool links.

#### Fix

Use the same explicit bribe/fee distributor-to-pool mapping described in `REW-4`, then surface pool links only when the evidence exists.

#### Implementation Plan

1. Reuse the `claimBribes` child item model:
   - bribe contract
   - token list
   - lock token id
   - matched transfer log
2. Resolve pool using `Voter.GaugeCreated` or persisted distributor mapping.
3. In Governance detail, show unresolved pool reason and the bribe contract/token evidence.
4. In epoch cards, show partial fee/bribe state when reward is known but pool is not.
5. Add tests proving token-pair-only evidence does not assign a pool.

### GOV-7: Estimated Governance Return Is Unavailable And Needs A Defined Basis

#### Symptom

`Retorno de gobernanza estimado` shows unavailable.

#### Findings

- Metric snapshot includes `estimatedGovernanceReturn`, but current value is unavailable.
- Without current locked AERO/veAERO exposure and invested time, an APR-like return cannot be computed reliably.
- Rebase claims may be non-liquid relocks, so they must not be mixed with liquid bribes/fees unless the return basis is explicit.

#### Fix

Define governance return basis before implementing the KPI.

#### Implementation Plan

Preferred v2 basis:

1. `Liquid governance reward APR`:
   - numerator: fees + bribes + liquid relay rewards.
   - excludes non-liquid rebase relocks unless shown separately.
   - denominator: time-weighted locked AERO value or veAERO value, whichever product label chooses.
2. `Rebase value`:
   - separate metric or reward type segment, not liquid cash return.
3. For partial lock state or missing denominator:
   - show unavailable with reason `missingGovernanceCapitalBasis`.
4. Add tests for:
   - liquid bribe/fee return.
   - rebase-only reward not being treated as liquid APR.
   - missing denominator producing unavailable return.

### GOV-8: Proposed Governance Screen Implementation Sequence

#### Phase 1: Read Model Contract

1. Add/complete lock-scoped projections:
   - lock rows with current lock state.
   - lock lifecycle rows/events.
   - lock-scoped reward rows.
   - lock-scoped epoch summaries.
2. Add `selectedKind: "lock"` to request/URL/detail contracts.
3. Ensure all governance ids carry `chainId`.
4. Preserve partial rows with reason codes.

#### Phase 2: UI Redesign

1. Replace current `GovernanceLockPanel` with `GovernanceLocksRegister`.
2. Add `SelectedLockSummary` and `LockLifecycleTimeline`.
3. Make `GovernanceEpochTimeline` selected-lock-aware.
4. Make `GovernanceRewardsTable` selected-lock-aware, with an "all locks" toggle.
5. Keep `GovernanceRewardBreakdown`, but scope it to selected lock by default.
6. Keep `SelectedGovernanceRail`, but support lock, lifecycle event, epoch, and reward subjects.
7. Remove visually noisy/generic link panels; move links into detail rows.

#### Phase 3: Regression And Manual Signoff

1. Regression fixture with:
   - direct lock.
   - managed/relay deposit.
   - vote/poke/reset.
   - bribe/fee/rebase claims.
   - partial distributor-to-pool case.
2. DB check for the reviewed wallet:
   - lock count visible.
   - current active locks selectable.
   - managed/relay lock visible.
   - epoch cards materialized for vote events.
   - rewards formatted and scoped to selected lock.
3. Manual UI check against the governance mockup style.

## Activity Bugs And Redesign

### ACT-1: Engine V2 Action Taxonomy Is Collapsed Into `ambiguous`

#### Symptom

The Activity table shows many rows as `Ambiguo`, including rows whose summary already says `approval_router`, `approval_position_manager`, `manual_position_approval`, or `failed_transaction`.

#### Findings

- Engine V2 read-model rows are already classified with richer action names.
- A read-only DB check for the reviewed wallet showed these persisted Activity rows:
  - `approval_position_manager`: 56
  - `approval_strategy_wrapper`: 55
  - `approval_router`: 53
  - `manual_position_approval`: 31
  - `approval_protocol_contract`: 2
  - `approval_governance_lock`: 1
  - `failed_transaction`: 49
  - `manual_position_created`: 28
- The Activity API/UI contract only allows a small action enum: `deposit`, `withdraw`, `swap`, `claim`, `strategy`, `governance`, `transfer`, `airdrop`, `unsupported`, `ambiguous`.
- `normalizeAction()` maps Engine V2 rows by substring. It has no `approval`, `failed`, `stake`, `unstake`, `mint`, `position_created`, `cash_in`, or `cash_out` branches.
- `materializeActivityRows()` persists `rowJson.action = event.eventType`, but `normalizeEngineV2ActivityRow()` remaps that richer action through the legacy enum.

Relevant files:

- `apps/web/src/server/analysis/engine-v2/materializers/activity-materializer.ts`
- `apps/web/src/server/activity/activity.contract.ts`
- `apps/web/src/server/activity/activity.repository.ts`
- `apps/web/src/features/activity/activity.types.ts`
- `apps/web/src/i18n/locales/es/activity.json`
- `apps/web/src/i18n/locales/en/activity.json`

#### Fix

Expand the Activity action model instead of flattening Engine V2 events into the old enum.

#### Implementation Plan

1. Add first-class Activity actions for:
   - `approval`
   - `failed`
   - `position_created`
   - `stake`
   - `unstake`
   - `cash_in`
   - `cash_out`
   - `noop`
2. Keep the specific Engine V2 event type in a separate field such as `eventType` or `actionDetail`.
3. Map v2 action families additively:
   - `approval_*` -> `approval`
   - `failed_transaction` -> `failed`
   - `manual_position_created` and deterministic position-manager `mint` -> `position_created` or `deposit`, depending on final UI naming.
   - `manual_gauge_stake` -> `stake`
   - `manual_gauge_unstake` -> `unstake`
   - `cash_in_*` -> `cash_in`
   - `cash_out_*` -> `cash_out`
4. Preserve `rowJson.action`, `summary`, classification evidence, and raw Engine V2 event type for detail and filtering.
5. Add mapper tests proving known v2 rows do not become `ambiguous`.

### ACT-2: Approvals Are Deterministic But Display As Ambiguous

#### Symptom

Approval rows appear as `Ambiguo` even when the persisted row says `approval_router`, `approval_position_manager`, `approval_strategy_wrapper`, or `manual_position_approval`.

#### Findings

- Approval rows have explicit evidence:
  - selector `0x095ea7b3`
  - decoded `approve`
  - spender/contract labels such as router, position manager, Mellow wrapper, gauge, or governance lock.
- These rows have `coverage_status = full` and `confidence = high`.
- The bug is not missing classification evidence; it is a display/API normalization bug.

#### Fix

Add an `approval` Activity action and show the approval target as the detail/subtype.

#### Implementation Plan

1. Add `approval` to `ACTIVITY_ACTION_VALUES`.
2. Add i18n labels:
   - table action: `Aprobación`
   - detail subtype examples: router, position manager, strategy wrapper, governance lock, protocol contract.
3. In the detail rail, show:
   - approved token/NFT.
   - spender/target contract.
   - approved amount or tokenId when evidence has it.
   - tx hash and decoded function.
4. Keep approvals out of economic inflow/outflow totals unless explicitly needed as operational count.
5. Add regression coverage for the high-volume approval buckets found in the DB.

### ACT-3: Failed Transactions Are Deterministic But Display As Ambiguous

#### Symptom

Rows whose persisted action is `failed_transaction` display as `Ambiguo`.

#### Findings

- Engine V2 already has `classifyBaseTransaction identifies failed transactions` test coverage.
- Failed rows include explicit evidence such as `receipt_status=0 with internal error`.
- The Activity contract has no `failed` action, so the UI folds them into `ambiguous`.

Relevant file:

- `apps/web/src/server/analysis/engine-v2/classification/base-classifiers.test.ts`

#### Fix

Add a `failed` Activity action.

#### Implementation Plan

1. Add `failed` to the Activity action enum and i18n dictionaries.
2. Map `failed_transaction` to `failed`.
3. Display failed rows as operational failed attempts, not ambiguous data.
4. Keep value impact at zero/null unless a persisted movement exists and is explicitly marked as a failed/non-economic movement.
5. Add tests proving failed rows remain `coverage = full`, `confidence = high`, `action = failed`.

### ACT-4: Position-Manager Mint Rows Are Displayed As `ambiguous:0x...`

#### Symptom

Transactions like `0x77a9a087a8eb7ac5136a7da2353eeb35971b5ac8b0afbeb607b5c38c1ee8f9c5` show as `ambiguous:0x...` in the Activity movement/summary column, even though the decoded input is a CL `mint`.

The user also observed there are many more than this one mint transaction with the same display failure.

#### Findings

- The specific tx is persisted as:
  - `action = manual_position_created`
  - `surface = deposit`
  - `confidence = high`
  - `coverage = partial`
  - decoded function `mint`
  - contract `NonfungiblePositionManager`
  - token0 `0x4200000000000000000000000000000000000006`
  - token1 `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`
  - `tickSpacing = 100`
  - minted ERC721 tokenId `56125986`
- The UI summary becomes `ambiguous:0x...` because:
  - `manual_position_created` does not match the legacy `deposit` substring rule.
  - the primary movement token symbol falls back to a shortened token address.
  - `buildSummary()` returns `${action}:${primary.tokenSymbol}` when no explicit summary is mapped.
- This is not an ownership-guessing problem. The position-manager mint and ERC721 tokenId are explicit evidence.

#### Fix

Map deterministic position-manager mint/position-created rows to a deposit/position-created activity display without weakening the partial coverage reason.

#### Implementation Plan

1. Treat `manual_position_created` as a supported Activity action.
2. Render it as `Nueva posición CL` or `Depósito CL`, with the exact final copy chosen during UI pass.
3. Use decoded `token0`, `token1`, `tickSpacing`, and minted ERC721 tokenId to show pool identity and position identity.
4. Keep `coverage = partial` when Engine V2 says `missing_explicit_evidence`; do not fake full accounting.
5. Add an Activity regression fixture for the reported tx hash.
6. Query/count all persisted `manual_position_created` rows during implementation and assert they no longer normalize to `ambiguous`.

### ACT-5: `Retiro` Currently Means Protocol Position Withdrawal, Not Wallet Cashout

#### Symptom

The Activity action `Retiro` appears on deposit withdrawals and reads like a capital withdrawal from the wallet.

#### Current Meaning

Today `withdraw` is produced when `normalizeAction()` sees `withdraw` or `decrease` in an event type/classification. In practice, this means a protocol lifecycle action:

- liquidity withdrawn from a manual deposit.
- unstake/withdraw from a gauge or strategy.
- decrease/burn/close of a position.

It does not necessarily mean money left the wallet. A manual pool withdrawal can leave WETH/cbBTC/USDC residual balances in the wallet and can later be redeployed or swapped. A true wallet cashout is different: funds leave the wallet to an external recipient or off-portfolio address.

#### Fix

Split display semantics:

- Protocol lifecycle withdrawal: `Retiro de posición`, `Salida de pool`, or `Unstake`, depending on event type.
- Wallet-level cashout: `Cashout` / `Salida de wallet`, only for explicit `cash_out_*` events.

#### Implementation Plan

1. Keep existing protocol withdrawal attribution intact.
2. Add separate `cash_out` action mapping for `cash_out_native` and `cash_out_token_transfer`.
3. Change Spanish label for generic protocol `withdraw` away from plain `Retiro` if it remains in the enum.
4. In charts/KPIs, keep protocol withdrawals separate from wallet cash-outs.
5. Update docs and tests so `withdraw` no longer implies realized portfolio exit.

### ACT-6: Activity Table Uses DataTable But Sorting Is Disabled

#### Symptom

The Activity table cannot be ordered, making it look like it is not using the proper DataTable design-system component.

#### Findings

- The table does use `DataTable`.
- All visible columns set `enableSorting: false`.
- The API contract already has sort keys: `occurredAt`, `valueUsd`, `action`, `coverage`, `confidence`.

Relevant file:

- `apps/web/src/features/activity/components/ActivityEventsTable.tsx`

#### Fix

Enable DataTable sorting and wire it to the existing URL/API sort state.

#### Implementation Plan

1. Enable sorting for supported columns:
   - date/time.
   - action.
   - surface.
   - value.
   - coverage.
   - confidence.
2. Keep movement/summary sorting disabled unless a deterministic sort key is added.
3. On sort changes, update Activity URL state and reload server data.
4. Clear selected detail when sort/page/filter changes if the selected row is no longer visible.
5. Add mapper/component tests for sort state if existing screen patterns support it.

### ACT-7: Activity Detail Movements Show Raw Token Units

#### Symptom

The detail rail movements section displays raw token amounts instead of token-decimal formatted amounts.

#### Findings

- `ActivityMovement` only carries `amountRaw` and `amountUsd`.
- `ActivityMovementList` calls `labels.formatAmount(movement.amountRaw)`.
- No token decimals are passed into the formatter.
- The same root issue appears in Rewards/Governance amount display.

Relevant files:

- `apps/web/src/server/activity/activity.types.ts`
- `apps/web/src/server/activity/activity.repository.ts`
- `apps/web/src/features/activity/components/ActivityMovementList.tsx`
- `apps/web/src/features/activity/Activity.component.tsx`

#### Fix

Persist and render token-decimal amounts for Activity movements.

#### Implementation Plan

1. Extend `ActivityMovement` with:
   - `tokenDecimals`
   - `amountFormatted`
   - optional `amountDisplay`
2. Populate decimals from token metadata/read-model token enrichment, not from UI guesses.
3. Format ERC20 raw units using decimals before rendering.
4. Keep raw units available in metadata/detail evidence for debugging.
5. For ERC721 movements, render tokenId and count semantics instead of decimal amount.
6. Add tests with WETH 18 decimals, USDC 6 decimals, cbBTC 8 decimals, and ERC721 tokenId movement.

### ACT-8: Activity Charts Show Coverage Instead Of Useful Activity Dimensions

#### Symptom

The donut and bar charts emphasize coverage. The donut is visually clipped, and coverage is not the most useful primary Activity metric.

#### Findings

- `ActivityInsightsPanel` renders:
  - bar chart by coverage status over time.
  - donut chart by coverage breakdown.
  - surface breakdown only as a footer legend.
- The user wants more meaningful data such as movement and surface.

Relevant files:

- `apps/web/src/server/activity/activity.service.ts`
- `apps/web/src/features/activity/components/ActivityInsightsPanel.tsx`
- `apps/web/src/features/activity/ActivityWorkspace.module.css`

#### Fix

Rework Activity insights around operational activity, not coverage.

#### Proposed DataView

1. Timeline chart:
   - x axis: day.
   - stacked bars by primary action family: deposits, withdrawals, swaps, claims, approvals, failed, governance, strategies.
   - optional overlay line for USD value moved, excluding approvals/failed/noops.
2. Donut chart:
   - distribution by surface: deposits, strategies, rewards, governance, cashflow, approvals, unknown.
3. Movement flow panel:
   - inbound token movements.
   - outbound token movements.
   - swaps/rebalances.
   - approvals/failed/no-value operations separated from economic flows.
4. Coverage should remain a small diagnostic strip or badge group, not the main chart.

#### Implementation Plan

1. Add action/surface/movement breakdowns to `ActivityResponse.charts`.
2. Keep coverage breakdown in the response for diagnostics.
3. Replace coverage donut with surface/action donut.
4. Fix chart sizing so donut center content is not clipped.
5. Add tests for chart aggregation from persisted rows.

### ACT-9: `Value Not Excluded` KPI Is Not Meaningful

#### Symptom

The KPI `Valor no excluido` shows `5.069.073,05 US$`, but the screen does not explain what was excluded and the value is not useful for portfolio understanding.

#### Findings

- `buildActivitySummary()` sums `row.valueUsd` for all non-excluded rows.
- `row.valueUsd` is itself the sum of absolute movement values for each activity.
- This can double count swap legs, deposits, withdrawals, approvals with no movement, and repeated protocol lifecycle movements.
- The product intent is not "sum of all non-excluded movement values"; the user wants practical wallet/portfolio flow indicators.

Relevant file:

- `apps/web/src/server/activity/activity.service.ts`

#### Fix

Replace the KPI with explicit flow metrics.

#### Proposed KPIs

1. Total events.
2. Classified/interpreted events.
3. Wallet capital in:
   - explicit external inflows to wallet.
   - based on `cash_in_*`, not inferred from protocol deposits.
4. Wallet capital out / realized cashout:
   - explicit external outflows from wallet.
   - based on `cash_out_*`, not protocol withdrawals.
5. Optional protocol value moved:
   - deposit/withdraw/swap movement volume, clearly labeled as volume, not portfolio value.
6. Excluded spam count/value:
   - shown only when non-zero.

#### Implementation Plan

1. Stop presenting `totalValueUsd` as "value not excluded".
2. Add a dedicated flow summary from persisted Activity rows.
3. Exclude approvals, failed txs, noops, and spam from economic KPI sums.
4. Treat swaps as volume only, not earnings or capital in/out.
5. Add tests proving a swap does not double count portfolio value and protocol withdrawal does not equal cashout.

### ACT-10: Selection State Should Reset When Page/Filter Context Changes

#### Symptom

Like Rewards, Activity can keep a selected detail while the visible page/filter context changes.

#### Findings

- `ActivityEventsTable` updates page state without clearing `selectedActivityId`.
- This can leave a detail rail showing an activity that is not on the current page or no longer matches filters.

#### Fix

Clear selected activity on page, page-size, filter, and sort changes unless the selected row is explicitly still in the current result set.

#### Implementation Plan

1. Update Activity URL-state transitions to clear `selectedActivityId` on broad context changes.
2. Preserve selection only for direct row click or deep link.
3. Add a small route-state test if the existing Activity container has test support.

### ACT-11: Implementation Order For Activity

1. Expand contract/i18n action taxonomy.
2. Fix mapper normalization for deterministic Engine V2 actions:
   - approvals.
   - failed transactions.
   - position-manager mint / `manual_position_created`.
   - stake/unstake.
   - cash-in/cash-out.
3. Add token decimal movement formatting.
4. Enable table sorting and reset stale selection.
5. Rework charts and KPIs.
6. Run Activity mapper/unit tests and a DB read-model check for:
   - no deterministic approvals displayed as ambiguous.
   - no failed transactions displayed as ambiguous.
   - no `manual_position_created` rows displayed as `ambiguous:0x...`.
   - reported tx `0x77a9a087a8eb7ac5136a7da2353eeb35971b5ac8b0afbeb607b5c38c1ee8f9c5` displays as position-created/deposit with partial coverage preserved.

## Implementation Task List

Detailed implementation tasks were split into `docs/frontend-calculation-bugfix-implementation-tasks.md` so implementation work can keep the executable backlog in context while this file remains the diagnostic bug report.

## Verification Plan

After implementation:

1. Run focused unit tests for:
   - Engine V2 residual accounting.
   - Engine V2 pool accounting/materialization.
   - Overview composition pricing.
   - Overview chart event mapping.
   - Pools mappers and timeline graph data.
2. Run DB/read-model checks for the reviewed wallet:
   - Current pool total matches open manual + active strategy + open residual.
   - Closed volatile pools show closed.
   - Open pools count is 5.
   - Active range count reflects current open positions.
   - APR and invested days are non-null where denominator/time exists.
3. Rebuild Engine V2 read models.
4. Manual UI smoke:
   - Overview WETH underlying value present.
   - Overview chart markers present.
   - Pools table values no longer inflated.
   - Pools detail timeline graph replaces related links.
   - Residual panel shows only open residual balances.
   - Deposits KPI grid spans available width.
   - Deposit row selection opens detail for Engine V2 scoped ids.
   - Deposits APR values are populated where duration and denominator exist.
   - Zero-reward deposit tracking list is reconciled against the Rewards screen review.
   - Reward row selection opens detail for Engine V2 reward ids.
   - Reward pagination clears selected detail.
   - Reward amounts render in token decimals, not raw units.
   - AERO icon renders in table and detail.
   - Governance bribe rows keep unresolved pool status unless distributor-to-pool evidence exists.
   - Rewards chart no longer labels one-day annualized APR as plain return.
   - Governance renders a lock register instead of a long lock/history feed.
   - Activity approvals display as approvals, not ambiguous.
   - Activity failed transactions display as failed, not ambiguous.
   - Activity CL mint/position-created rows do not display as `ambiguous:0x...`.
   - Activity movement amounts render with token decimals.
   - Activity table sorting works through the DataTable component.
   - Activity KPIs show explicit wallet/protocol flow semantics instead of "value not excluded".
   - Selecting a lock updates selected lock metrics, lifecycle, epoch timeline, rewards, reward distribution, and detail rail.
   - Governance lock KPIs use persisted current lock state or show explicit missing-evidence reasons.
   - Governance epoch cards exist for vote history when epoch grouping evidence is available.
   - Governance reward amounts render in token decimals, not raw units.
