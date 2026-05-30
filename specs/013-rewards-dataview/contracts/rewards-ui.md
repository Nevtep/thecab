# Contract: Rewards UI

## Route

```text
/rewards
```

Rewards is an analyzed connected-wallet route. It is locked until historical analysis is ready for the connected wallet and active chain.

## Desktop Information Architecture

The supplied Rewards mockup is the information-architecture contract. Exact pixel values and sample data are not fixed, but the first desktop viewport must preserve this hierarchy:

```text
Rewards page title + localized subtitle
└── KPI strip
    ├── Total claimed rewards
    ├── Reward events
    ├── Estimated reward return
    ├── Resolved rewards value
    └── Unresolved / excluded value
└── Filter bar
    ├── Search
    ├── Date presets + custom date
    ├── Source segmented control
    ├── Token menu
    ├── Pool menu
    ├── Reward type menu
    ├── Coverage menu
    ├── Active filter chips
    └── Clear all
└── Workspace
    ├── Left analysis area
    │   ├── Rewards over time panel
    │   ├── Source breakdown panel
    │   ├── Pool contribution breakdown panel
    │   ├── Token breakdown panel
    │   └── Reward events table
    └── Right selected reward rail
        ├── Selected reward summary
        ├── Ownership trace
        ├── Pool contribution
        ├── Claim details
        ├── Coverage notes
        └── Unresolved & excluded activity
```

## Required States

### Ready With Rewards

- Shows all panels listed above.
- Defaults to `30d` date preset where data exists.
- Selects the most recent visible reward by default.
- Keeps selected row visually distinct.
- Updates all panels from one filter state.

### Ready With No Rewards

- Shows page heading and locked-compatible frame.
- Shows no-rewards empty state, not analysis-unavailable copy.
- Does not fabricate zero-return confidence if reward history is absent.

### Analysis Locked

- Uses the same gating pattern as Pools, Deposits, and Strategies.
- Shows a localized reason and path to start or wait for analysis where the existing shell supports it.
- Does not show empty distributions as if analysis completed.

### Filtered Empty

- Preserves active filters and chips.
- Shows a contextual empty state that no rewards match the current filters.
- Clear-all is visible.

### Non-Full Coverage

- Coverage state appears in KPI cards, chart coverage note, table rows, and selected reward rail.
- Partial, unresolved, excluded, and unavailable states must be visible through text and shape/icon treatment, not color alone.

## Panel Contracts

### KPI Strip

Each KPI card includes:

- localized label;
- primary value;
- compact context line;
- optional trend/activity cue;
- coverage state when not full;
- tabular numeric formatting.

Estimated reward return must display an estimated marker unless exact historical capital coverage is complete.

### Rewards Over Time

Shows:

- claimed value as primary series;
- estimated reward return as secondary series when available;
- reward count series or count axis;
- claim markers;
- coverage percentage and note;
- time grouping control where available.

Charts must feel like instrumentation: dark background, restrained grid, teal/blue/gold semantic series, no noisy retail-trading styling.

### Breakdown Panels

Source breakdown:

- Manual Deposits;
- Strategies;
- Governance;
- unresolved/excluded only when included by the active filter or audit context.

Pool contribution breakdown:

- top pools by resolved contribution value;
- value and percentage;
- Other group when necessary;
- path to filter/view pool-specific rewards.

Token breakdown:

- token identity cue;
- value and percentage;
- Other group when necessary;
- path to filter token-specific rewards.

### Reward Events Table

Minimum columns:

- selection state;
- date/time;
- token;
- amount;
- value at claim;
- owner/source;
- linked entity;
- pool;
- reward type;
- pool contribution;
- coverage;
- confidence;
- transaction action.

Table behavior:

- supports sorting by date, value, token amount, source, owner, and coverage;
- supports pagination or incremental browsing;
- shows result count and rows-per-page;
- rows remain stable during selected reward updates;
- unresolved and excluded rows are visually distinct from resolved rows without color-only meaning.

### Selected Reward Rail

The rail updates when a reward row is selected and never performs reward reconstruction itself.

Required sections:

- Summary: token, reward type, owner category, amount, value, coverage, confidence.
- Ownership Trace: owner, linked entity, source surface, evidence.
- Pool Contribution: contributes yes/no/unresolved/excluded, linked pool, counting rule, note.
- Claim Details: transaction hash, claim time, reward type, source contract/surface, external transaction path.
- Coverage Notes: full/partial/unresolved/excluded/unavailable state, reason, aggregate inclusion.
- Unresolved & Excluded Activity: compact list in current filter context plus path to view all.

## Responsive Contract

- Desktop: keep left analysis area and selected reward rail visible together.
- Tablet/narrow: selected reward rail may move below the table or into a drawer/drill-in.
- Mobile: users must reach ownership trace and coverage details from a reward row in no more than two interactions.
- Filters may wrap, collapse into menus, or use horizontal scrolling, but active chips and clear-all remain available.

## Cross-Surface Navigation

Incoming links from Pools, Deposits, and Strategies must:

- open `/rewards`;
- apply the relevant filter;
- show the filter as a removable chip;
- select the most recent matching reward if no explicit reward is provided.

Reward rows and selected rail links must navigate back to:

- Deposit detail for manual deposit rewards;
- Strategy detail for strategy rewards;
- Pool detail for pool contribution where known;
- future Governance detail where supported.

## Accessibility and Readability Requirements

- Do not rely on color alone for coverage, confidence, contribution, or excluded states.
- Table and KPI numeric values use tabular numerics.
- Hashes and technical references use mono styling where established by the design system.
- Interactive controls need accessible labels sourced from i18n.
- Text must fit within compact panels at supported viewport sizes.

## Manual Signoff Checklist

- The first desktop viewport matches the mockup hierarchy.
- KPI strip, filter bar, over-time panel, three breakdown panels, table, and selected rail are visible or reachable as specified.
- Manual deposit, strategy, governance, unresolved, and excluded examples are distinguishable.
- Unresolved/excluded values are not presented as confident earned rewards.
- The route preserves brand tone: technical, premium, dense, readable, and restrained.
