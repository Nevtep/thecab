# Contract: i18n Namespaces

## Required Namespaces

Rewards DataView affects these namespaces in English and Spanish:

```text
rewards
charts
coverage
common
navigation
errors
```

No user-facing text may be hardcoded in route, feature, or component files.

## `rewards` Namespace

Required key groups:

```text
rewards.title
rewards.subtitle
rewards.kpis.*
rewards.filters.*
rewards.datePresets.*
rewards.sources.*
rewards.rewardTypes.*
rewards.coverage.*
rewards.resolution.*
rewards.poolContribution.*
rewards.confidence.*
rewards.panels.*
rewards.table.columns.*
rewards.selected.*
rewards.ownershipTrace.*
rewards.claimDetails.*
rewards.coverageNotes.*
rewards.unresolvedExcluded.*
rewards.evidence.*
rewards.countingRules.*
rewards.empty.*
rewards.locked.*
rewards.actions.*
rewards.a11y.*
```

Minimum semantic labels:

- Rewards
- Inspect claimed value across deposits, strategies, governance, pools, and tokens.
- Total claimed rewards
- Reward events
- Est. reward return
- Resolved rewards value
- Unresolved / excluded value
- Rewards over time
- Source breakdown
- Pool contribution breakdown
- Token breakdown
- Reward events
- Selected reward
- Ownership trace
- Pool contribution
- Claim details
- Coverage notes
- Unresolved & excluded activity
- Manual Deposit
- Strategy
- Governance
- Unresolved
- Excluded
- Unavailable
- Contributes
- None
- Full
- Partial
- High
- Medium
- Low

## `charts` Namespace

Add chart labels and legends for:

- claimed value;
- estimated reward return;
- reward count;
- claim event marker;
- daily grouping;
- coverage percentage;
- partial values note.

## `coverage` Namespace

Add or confirm reason codes:

- `missingOwnerEvidence`
- `unknownRewardSurface`
- `excludedAirdrop`
- `ambiguousWrapperWithdraw`
- `missingClaimTimePrice`
- `missingPoolMapping`
- `mixedValuationCoverage`
- `historicalCapitalPartial`
- `governancePoolMappingUnavailable`
- `walletPoolAggregateAttribution`

Coverage copy must distinguish:

- full;
- partial;
- unresolved;
- excluded;
- unavailable;
- estimated reward return.

## `common` Namespace

Add or reuse:

- Search
- Clear all
- Rows per page
- Showing range
- View details
- View all
- Copy
- Open external link
- All
- Other
- Yes
- No

## `navigation` Namespace

Add or confirm:

- Rewards navigation label;
- cross-link labels from Pools, Deposits, and Strategies into Rewards;
- return/link labels to Pool detail, Deposit detail, Strategy detail, and future Governance.

## `errors` Namespace

Map stable backend codes:

- `UNAUTHENTICATED_WALLET`
- `UNSUPPORTED_CHAIN`
- `INVALID_REWARDS_FILTERS`
- `ANALYSIS_NOT_FOUND`
- `REWARDS_READ_FAILED`

Errors must be localized in English and Spanish while retaining machine codes for logs and tests.

## Formatting Rules

- Currency uses centralized locale formatters.
- Percentages use centralized locale formatters.
- Token amounts use token-aware precision and locale formatting.
- Dates and times use centralized locale date/time formatters.
- Hashes are shortened consistently and not translated.
- Protocol terms such as AERO, veAERO, Mellow, Aerodrome, Gauge, and Pool may remain canonical when translation would reduce precision.

## Parity Requirements

- English and Spanish files must contain the same key structure.
- i18n parity check must pass before signoff.
- Missing translation fallback may not be used as a planned steady state.
