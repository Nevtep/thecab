# Data Model: Rewards DataView

## Entity Overview

Rewards DataView is a read surface over persisted analysis evidence. It does not redefine protocol ownership. It presents normalized `RewardEvent` records with derived UI state for ownership, pool contribution, valuation coverage, and selected-row evidence.

## Reward Event

Represents one economic reward or fee component.

### Fields

- `rewardEventId`: Stable event identity.
- `chainId`: Active chain identity; required for all reward rows.
- `walletAddress`: Connected wallet address.
- `txHash`: Source transaction hash.
- `eventIndex`: Log index, movement index, or component index that disambiguates multiple reward components in one transaction.
- `occurredAt`: Claim or reward event timestamp.
- `rewardType`: Canonical type such as `fee_claim`, `reward_claim`, `mellow_reward`, `governance_reward`, `unknown_reward`, or `reward_accrual_snapshot`.
- `sourceSurface`: Protocol surface such as `manual_deposit_gauge_claim`, `pool_fee_claim_v2`, `pool_fee_claim_slipstream`, `strategy_wrapper_reward_claim`, `governance_voter_claim`, `gauge_reward_unknown_surface`, `ambiguous_wrapper_withdraw`, or `airdrop_spam`.
- `economicComponentKind`: Component classification used when one transaction decomposes into multiple economic events.
- `tokenAddress`: Reward token address when available.
- `tokenSymbol`: Display symbol derived from token metadata.
- `tokenAmount`: Normalized token amount when available.
- `amountRaw`: Raw token amount when available.
- `usdValueAtClaim`: Claim-time USD value when available.
- `priceCoverage`: `full`, `partial`, or `unavailable`.
- `ownerStatus`: `manual_deposit`, `strategy`, `governance`, `unresolved`, `excluded`, or `unavailable`.
- `ownerEntityId`: Deposit, strategy exposure, or governance identity when resolved.
- `ownerLabel`: Localized display label for the linked owner.
- `resolutionStatus`: `resolved`, `unresolved`, `excluded`, or `unavailable`.
- `resolutionBasis`: Evidence basis such as `explicit_token_id`, `same_tx_token_context`, `strategy_wrapper_pair`, `staking_rewards_pair`, `wallet_pool_single_holder`, `wallet_pool_aggregate`, or `unresolved`.
- `resolutionReasonCodes`: Reason codes used for coverage notes and unresolved/excluded messaging.
- `poolContributionStatus`: `contributes`, `none`, `unresolved`, `excluded`, or `unavailable`.
- `poolId`: Linked pool when known.
- `poolLabel`: Display label for linked pool when known.
- `countingRule`: Explanation key for why the reward is counted in, or excluded from, pool aggregates.
- `coverageState`: `full`, `partial`, `unresolved`, `excluded`, or `unavailable`.
- `confidence`: `high`, `medium`, `low`, or `none`.
- `confidenceReasons`: Evidence reason codes for confidence display.
- `externalTxUrl`: External transaction URL or route token when supported.
- `metadata`: Contract references, source payload references, wrapper/staking addresses, tokenId, external strategy reference, and other evidence needed for selected reward detail.

### Validation Rules

- `chainId`, `walletAddress`, `txHash`, `occurredAt`, `rewardType`, `resolutionStatus`, and `coverageState` are required.
- Resolved manual deposit rewards require `ownerStatus = manual_deposit` and an explicit owner identity.
- Resolved strategy rewards require `ownerStatus = strategy` and a strategy exposure identity.
- Governance rewards must not use manual deposit or strategy owner status.
- Excluded rows must not contribute to confident totals.
- Missing `usdValueAtClaim` requires partial or unavailable USD coverage.
- Pool contribution must be explicit and must not be inferred from pool/time proximity.
- One transaction may have multiple reward events as long as event/component identity is unique within chain and transaction.

## Reward Owner

Represents the analysis owner of a reward.

### Fields

- `ownerStatus`: `manual_deposit`, `strategy`, `governance`, `unresolved`, `excluded`, or `unavailable`.
- `ownerEntityId`: Domain identity when resolved.
- `ownerLabel`: Localized label or shortened identifier.
- `ownerRoute`: Cross-surface route target when available.
- `sourceCategory`: `deposits`, `strategies`, `governance`, `unresolved`, `excluded`, or `unavailable`.
- `sourceSurface`: Protocol surface that produced the reward.
- `evidenceSummary`: Localized summary of owner evidence.
- `resolutionBasis`: Deterministic rule used for the ownership decision.
- `reasonCodes`: Reason codes for unresolved, excluded, partial, or unavailable owner state.

### Relationships

- Manual deposit owner links to `Deposit` and may link to `Pool`.
- Strategy owner links to `StrategyExposure`, `Strategy`, and may link to `Pool`.
- Governance owner may link to future `GovernanceEvent` and may link to `Pool` where supported.
- Unresolved, excluded, and unavailable owners do not link to manual deposit or strategy totals.

## Pool Contribution

Represents whether and how a reward contributes to a Pool aggregate.

### Fields

- `poolContributionStatus`: `contributes`, `none`, `unresolved`, `excluded`, or `unavailable`.
- `poolId`: Linked pool where known.
- `poolLabel`: Display label.
- `countingRule`: `owner_resolved_pool`, `strategy_underlying_pool`, `governance_pool_mapped`, `no_pool_contribution`, `unresolved_owner`, `excluded_activity`, or `unavailable_mapping`.
- `contributionUsd`: USD amount included in pool totals when claim-time valuation is available.
- `contributionTokenAmount`: Token amount included in pool context.
- `doubleCountProtection`: Boolean display flag that confirms the reward is counted once.
- `reasonCodes`: Coverage or contribution limitation reasons.

### Validation Rules

- `contributes` requires a known pool and a non-excluded owner/source.
- Unresolved or excluded reward-shaped activity cannot have confident pool contribution.
- Pool contribution does not imply deposit or strategy ownership.

## Reward Summary

Top-level KPI state for the active wallet, chain, and filter set.

### Fields

- `totalClaimedRewardsUsd`: Sum of visible claimed reward USD values, including resolved and separately identified unresolved/excluded value when known.
- `rewardEventCount`: Count of visible reward events.
- `estimatedRewardReturnPct`: Reward return relative to covered historical capital.
- `estimatedRewardReturnCoverage`: `full`, `estimated`, `partial`, or `unavailable`.
- `resolvedRewardsUsd`: Confident resolved reward value included in owner/pool aggregates.
- `resolvedRewardsSharePct`: Share of total known reward-shaped value that is resolved.
- `unresolvedExcludedUsd`: Known USD value for unresolved, excluded, or unavailable reward-shaped activity.
- `unresolvedExcludedSharePct`: Share of known reward-shaped value not included in confident aggregates.
- `coverageState`: Aggregate coverage state.
- `coverageReasonCodes`: Reasons affecting summary confidence.

### Validation Rules

- Resolved and unresolved/excluded values must be shown separately.
- Estimated reward return must not use current capital only.
- Mixed valuation coverage requires partial or unavailable summary coverage.

## Rewards Over Time Bucket

Represents one time bucket for the chart panel.

### Fields

- `bucketStart`: Start timestamp or date.
- `bucketEnd`: End timestamp or date.
- `claimedValueUsd`: Claim-time USD value in the bucket.
- `rewardEventCount`: Number of reward events in the bucket.
- `estimatedRewardReturnPct`: Estimated reward return for the bucket or rolling context when available.
- `claimMarkers`: Compact markers for claim events.
- `coverageState`: Bucket coverage state.
- `coverageReasonCodes`: Bucket coverage reasons.

### Validation Rules

- Bucket grouping must match the selected date/time preset.
- Missing valuation must degrade `claimedValueUsd` coverage.

## Reward Distribution

Represents a grouped breakdown panel.

### Fields

- `distributionType`: `source`, `pool`, `token`, `reward_type`, `coverage`, or `resolution`.
- `items`: Ordered distribution rows.
- `totalUsd`: Total visible USD value for this distribution.
- `coverageState`: Distribution coverage state.

### Distribution Row Fields

- `id`: Stable group identity.
- `label`: Localized display label.
- `valueUsd`: Group value.
- `sharePct`: Group percentage of visible distribution total.
- `count`: Reward event count.
- `coverageState`: Group coverage.
- `filterTarget`: Filter state represented by selecting the group.

### Validation Rules

- Source distribution must at minimum distinguish Manual Deposits, Strategies, and Governance.
- Pool distribution must include an Other group when the visible pool count exceeds the display envelope.
- Token distribution must group small or unknown tokens as Other when needed.

## Reward Filter State

Represents user controls and incoming context.

### Fields

- `search`: Text search across reward text, transaction hash, pools, tokens, and linked entities.
- `datePreset`: `7d`, `30d`, `90d`, `1y`, `all`, or `custom`.
- `dateRange`: Custom start/end range.
- `source`: `all`, `deposits`, `strategies`, `governance`, `unresolved`, `excluded`, or `unavailable`.
- `tokenAddress`: Optional token filter.
- `poolId`: Optional pool filter.
- `depositId`: Optional deposit filter.
- `strategyExposureId`: Optional strategy exposure filter.
- `rewardType`: Optional reward type filter.
- `coverageState`: Optional coverage filter.
- `resolutionStatus`: Optional resolution filter.
- `sort`: Sort key and direction.
- `selectedRewardEventId`: Optional selected reward.
- `page`: Table page.
- `pageSize`: Row count.
- `activeChips`: Visible active filter chips.

### Validation Rules

- All query/filter identities must be chain-scoped.
- Incoming links from Pools, Deposits, and Strategies must become visible removable chips.
- Clearing filters must preserve wallet, chain, and analysis-ready context.

## Selected Reward Evidence

Represents the selected reward right rail.

### Fields

- `summary`: Token identity, reward type, owner status, amount, claim-time value, coverage, and confidence.
- `ownershipTrace`: Owner category, linked entity, source surface, and evidence summary.
- `poolContribution`: Pool contribution status, linked pool, counting rule, and double-counting note.
- `claimDetails`: Transaction hash, claim time, reward type, source contract or source surface, and external transaction path.
- `coverageNotes`: Coverage state, included/excluded aggregate status, and reason descriptions.
- `unresolvedExcludedActivity`: Compact list of relevant unresolved or excluded rows in the active filter context.

### Validation Rules

- Selected reward evidence must update when table selection changes.
- If selected reward is filtered out, choose the first visible row or show contextual empty detail.
- Evidence sections must remain reachable on narrow screens.

## State Transitions

### Reward Resolution State

```text
candidate
  -> resolved_manual_deposit
  -> resolved_strategy
  -> governance_scoped
  -> unresolved
  -> excluded
  -> unavailable
```

- `candidate -> resolved_manual_deposit`: explicit deposit identity or same-transaction deposit evidence supports ownership.
- `candidate -> resolved_strategy`: strategy exposure identity supports ownership.
- `candidate -> governance_scoped`: governance reward evidence supports source and prevents LP owner inflation.
- `candidate -> unresolved`: evidence is insufficient or surface is unknown.
- `candidate -> excluded`: spam-like or unsupported activity must not enter reward totals.
- `candidate -> unavailable`: required source data, price, or mapping is not available.

### Pool Contribution State

```text
not_evaluated
  -> contributes
  -> none
  -> unresolved
  -> excluded
  -> unavailable
```

- `contributes`: resolved owner/source and reliable pool mapping exist.
- `none`: reward is valid but does not contribute to a pool.
- `unresolved`: ownership or mapping is not sufficient.
- `excluded`: activity is excluded from economic totals.
- `unavailable`: mapping or valuation data is unavailable.

## Scale and Indexing Notes

- Target envelope: 2,000 reward rows per wallet; stress envelope: 10,000 rows.
- Route queries should filter by `chainId`, `walletAddress`, `occurredAt`, `resolutionStatus`, `resolvedPoolId`, `strategyExposureId`, and reward type.
- Add indexes or compact read models only where query profiling shows the existing `reward_events` indexes are insufficient.
