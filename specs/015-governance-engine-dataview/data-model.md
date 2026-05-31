# Data Model: Governance Engine Processing And Metrics DataView

## Overview

Governance data is chain-scoped, wallet-scoped, evidence-backed, read-only, and materialized before request time. Request paths consume persisted rows and read models only.

## Entities

### GovernanceEvent

Represents an interpreted governance action.

| Field | Description |
|-------|-------------|
| `governanceEventId` | Stable UUID. |
| `chainId` | Chain identity, Base `8453` for v1. |
| `walletAddress` | Connected wallet address. |
| `txHash` | Source transaction hash when available. |
| `logIndex` / `sequenceIndex` | Stable ordering and uniqueness within a transaction. |
| `occurredAt` | Event timestamp. |
| `eventType` | `lock_created`, `lock_increased`, `lock_extended`, `relock`, `lock_withdrawn`, `vote`, `vote_reset`, `relay_joined`, `relay_exited`, `fee_claim`, `bribe_claim`, `rebase_claim`, `governance_reward`, `unknown_governance`, `unsupported_governance`, `excluded_governance`. |
| `protocolSurface` | `voting_escrow`, `veaero`, `voter`, `relay`, `bribe`, `fee_distributor`, `reward_distributor`, `aero_token`, `unknown`. |
| `lockId` | Lock identity when explicit. |
| `epochId` | Epoch identity when derivable. |
| `rewardEventId` | Linked reward when this event represents or explains a reward. |
| `activityEventId` | Linked Activity row when materialized. |
| `valueUsd` | Evidence-backed USD value or null. |
| `coverageState` | `full`, `partial`, `unresolved`, `unsupported`, `excluded`, `unavailable`. |
| `confidence` | `high`, `medium`, `low`, `none`. |
| `affectsTotals` | Whether the event contributes to confident totals. |
| `reasonCodes` | Coverage/classification reason codes. |
| `evidenceRefs` | Source evidence references. |

**Validation rules**:

- Uniqueness includes `chainId`, `walletAddress`, `txHash`, event/log/sequence identity, and `eventType`.
- Events without explicit governance evidence remain unknown/unsupported/partial, not promoted to supported Governance.
- Excluded/spam rows stay inspectable and do not affect confident totals.

### GovernanceLockExposure

Represents persistent lock state and lifecycle.

| Field | Description |
|-------|-------------|
| `lockExposureId` | Stable UUID or deterministic chain/wallet/lock identity. |
| `chainId` | Chain identity. |
| `walletAddress` | Connected wallet address. |
| `lockId` | veAERO/voting escrow lock identity when available. |
| `status` | `active`, `expired`, `withdrawn`, `partial`, `unknown`. |
| `createdAt` | Lock creation timestamp when available. |
| `expiresAt` | Lock expiry when available. |
| `remainingDurationSeconds` | Derived remaining duration when expiry is available. |
| `lockedAeroAmount` | Current evidence-backed locked AERO. |
| `lockedAeroValueUsd` | Current valuation when available. |
| `veAeroExposure` | Current veAERO or lock exposure when available. |
| `veAeroValueUsd` | Optional valuation/equivalent when available. |
| `lifecycleEvents` | Ordered lock lifecycle event ids. |
| `coverageState` | Coverage state for lock reconstruction. |
| `confidence` | Confidence in lock state. |
| `reasonCodes` | Missing/evidence reason codes. |

**Validation rules**:

- Lock exposure is separate from selected detail and remains visible on first screen.
- Missing `lockId` does not hide lock exposure; it marks the panel partial/unresolved.
- LP/manual deposits are not modeled as governance locks.

### GovernanceEpoch

Represents an epoch-level summary card.

| Field | Description |
|-------|-------------|
| `epochId` | Protocol epoch identity or partial epoch key. |
| `chainId` | Chain identity. |
| `walletAddress` | Connected wallet address. |
| `epochStartAt` / `epochEndAt` | Period bounds when derivable. |
| `voteEventIds` | Related vote/reset events. |
| `votedPools` | Pool identities and labels when explicit. |
| `voteWeights` | Weights by pool when available. |
| `voteMode` | `manual`, `relay`, `mixed`, `unknown`. |
| `resetState` | `not_reset`, `reset`, `unknown`. |
| `rewardState` | `claimed`, `pending`, `none`, `partial`, `unknown`. |
| `feesUsd` / `bribesUsd` / `rebasesUsd` | Evidence-backed epoch reward values. |
| `coverageState` | Epoch coverage. |
| `confidence` | Epoch confidence. |

**Validation rules**:

- Epoch cards are compact analytical summaries, not raw ledger rows.
- Date-derived epoch grouping is partial unless protocol epoch evidence is available.
- Voted pool links require explicit pool identity.

### GovernanceReward

Represents a governance reward row.

| Field | Description |
|-------|-------------|
| `governanceRewardId` | Stable governance reward identity or linked reward id. |
| `rewardEventId` | Linked Rewards identity when available. |
| `chainId` | Chain identity. |
| `walletAddress` | Connected wallet address. |
| `txHash` | Claim transaction hash when available. |
| `claimedAt` | Claim timestamp. |
| `rewardType` | `fee`, `bribe`, `rebase`, `relay_reward`, `unknown_governance`. |
| `tokenAddress` / `tokenSymbol` | Reward token identity and display symbol. |
| `amountRaw` / `amountDecimal` | Token amount. |
| `valueUsdAtClaim` | USD value at claim when available. |
| `epochId` | Associated epoch when explicit or partial. |
| `poolId` | Associated pool only when explicit. |
| `contextLabel` | Linked source context such as epoch, pool, vote, or reward row. |
| `coverageState` | Reward coverage. |
| `confidence` | Reward confidence. |
| `affectsTotals` | Whether it contributes to confident totals. |

**Validation rules**:

- Governance rewards appear in Governance and Rewards as the same underlying claim.
- Pool association requires explicit protocol-derived or persisted evidence.
- Excluded/spam/unresolved rewards remain visible but do not inflate confident totals.

### GovernanceMetricSummary

First-screen KPI and coverage summary.

| Field | Description |
|-------|-------------|
| `lockedAero` | Mandatory KPI value or unavailable state. |
| `veAeroExposure` | Mandatory KPI value or unavailable state. |
| `lockExpiry` | Mandatory KPI as expiry date or remaining duration. |
| `governanceRewardsClaimedUsd` | Mandatory KPI, confident reward total. |
| `estimatedGovernanceReturn` | Mandatory KPI, explicitly estimated. |
| `coverageState` | Mandatory KPI/overall coverage. |
| `supportingMetrics` | Fee/bribe/rebase split, relay participation, active epochs, claim status. |
| `coverageReasonCodes` | Reasons for partial/unavailable values. |

**Validation rules**:

- Mandatory KPI slots remain present even when data is partial/unavailable.
- Estimated return excludes unresolved, unsupported, excluded, spam, and unavailable values.

### GovernanceViewModel

The API/UI first-screen contract.

| Field | Description |
|-------|-------------|
| `analysis` | Analysis ready/stale/covered range state. |
| `filters` | URL/query state and active chips. |
| `summary` | `GovernanceMetricSummary`. |
| `lockPanel` | `GovernanceLockExposure` or empty/partial state. |
| `epochTimeline` | Compact `GovernanceEpoch` cards. |
| `rewards` | Paginated `GovernanceReward` rows. |
| `rewardBreakdown` | Reward-type/value breakdown. |
| `selectedDetail` | Selected event/reward/epoch/metric detail. |
| `availableFilters` | Filter option lists. |

**Validation rules**:

- The view model must be internally consistent for the same filter/selection context.
- It must not require request-time provider calls.
- It must preserve empty/no-results layout stability.

### GovernanceSelectedDetail

Explains one selected governance object.

| Field | Description |
|-------|-------------|
| `selectionKind` | `event`, `reward`, `epoch`, `metric`, `empty`. |
| `selectionId` | Selected identity. |
| `actionSummary` | Localizable action summary. |
| `transaction` | Tx hash, timestamp, block, explorer URL when available. |
| `protocolSurface` | Governance surface label/key. |
| `tokenMovements` | Token movement evidence. |
| `valueEffect` | Claim value or value effect. |
| `epochContext` | Epoch/vote/reset context where available. |
| `poolContext` | Pool context only when explicit. |
| `classificationEvidence` | Evidence basis, reason codes, missing evidence. |
| `linkedContexts` | Activity, Rewards, Pools links where explicit. |
| `coverageNotes` | Coverage/confidence and explanation. |
| `sourceEvidenceRefs` | Raw provider/protocol evidence references. |

**Validation rules**:

- Supported rows populate all applicable sections.
- Partial/unresolved/unsupported/excluded rows keep structural sections and explain missing data.
- Links require explicit persisted identity.

## State Transitions

### GovernanceEvent

```text
candidate -> supported
candidate -> partial
candidate -> unresolved
candidate -> unsupported
candidate -> excluded
partial/unresolved -> supported after new evidence
supported -> partial/excluded only if reanalysis finds stronger contradictory evidence
```

### LockExposure

```text
unknown -> active
active -> increased
active -> extended
active -> relocked
active -> expired
expired -> withdrawn
unknown/active -> partial when required evidence is missing
```

### GovernanceReward

```text
candidate -> governance_reward_resolved
candidate -> governance_reward_partial
candidate -> unresolved
candidate -> excluded
resolved/partial -> pool_associated only with explicit evidence
```

## Relationships

- `GovernanceEvent` may link to one `ActivityEvent`.
- `GovernanceReward` may link to one `RewardEvent`.
- `GovernanceReward` may link to one `Pool` only with explicit association evidence.
- `GovernanceEpoch` aggregates events and rewards by epoch when evidence supports grouping.
- `GovernanceLockExposure` aggregates lock lifecycle events without depending on selected row.
- `GovernanceViewModel` composes summary, lock, timeline, rewards, breakdown, and selected detail.

## Coverage And Confidence

Coverage/confidence fields are required at:

- KPI value level.
- Lock panel level.
- Epoch timeline card level.
- Governance reward row level.
- Selected detail level.
- Overall extraction level.

Rows or values with `partial`, `unresolved`, `unsupported`, `excluded`, or `unavailable` coverage remain visible and do not masquerade as confident totals.
