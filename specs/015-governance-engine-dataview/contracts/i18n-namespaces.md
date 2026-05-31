# Contract: Governance i18n Namespaces

## New Or Updated Namespace

### `governance`

Required key groups:

- `page.title`
- `page.subtitle`
- `kpis.*`
- `lockPanel.*`
- `timeline.*`
- `timeline.epoch.*`
- `rewards.*`
- `rewards.table.columns.*`
- `breakdown.*`
- `filters.*`
- `filterChips.*`
- `eventTypes.*`
- `rewardTypes.*`
- `protocolSurfaces.*`
- `selected.*`
- `selected.summary.*`
- `selected.transaction.*`
- `selected.protocolSurface.*`
- `selected.tokenMovements.*`
- `selected.valueEffect.*`
- `selected.context.*`
- `selected.classificationEvidence.*`
- `selected.linkedContexts.*`
- `selected.coverageNotes.*`
- `selected.sourceEvidence.*`
- `states.locked.*`
- `states.empty.*`
- `states.partial.*`
- `states.unsupported.*`
- `reasonCodes.*`
- `errors.*`

English is canonical. Spanish must have parity.

## Existing Namespace Updates

### `navigation`

- Enable Governance label, ready/locked state, and route copy.

### `coverage`

Add or confirm labels for:

- `full`
- `partial`
- `unresolved`
- `unsupported`
- `excluded`
- `unavailable`
- `mixed`

### `errors`

Add or confirm stable message mappings for:

- `ANALYSIS_NOT_READY`
- `INVALID_GOVERNANCE_FILTER`
- `GOVERNANCE_SELECTION_NOT_FOUND`
- `UNSUPPORTED_CHAIN`
- `WALLET_MISMATCH`

### `common`

Reuse existing labels for search, clear all, pagination, rows per page, loading, selected, empty, open transaction, copied, and unavailable.

### `rewards`, `pools`, `activity`

Add or confirm cross-surface link copy for:

- View in Governance.
- Filter Governance by this reward.
- Filter Governance by this pool.
- Filter Governance by this activity/governance event.

## Formatting Requirements

Use centralized locale formatters for:

- Locked AERO and token amounts.
- veAERO exposure.
- USD values.
- Percentages and estimated return.
- Dates and times.
- Remaining duration.
- Epoch labels and compact counts.
- Transaction hash display.

No feature component may use local `new Intl`, raw `toFixed`, or hardcoded date formatting.

## Copy Tone

Governance copy must be precise and audit-friendly:

- Prefer "estimated", "partial", "unresolved", "unsupported", "excluded", and "unavailable" over casual phrasing.
- Preserve protocol terms such as AERO, veAERO, epoch, vote, reset, bribe, fee, rebase, and relay when translation would reduce precision.
- Avoid execution, recommendation, speculative APR, or marketing language.
- Do not imply partial values are complete or that excluded/spam transfers are earned rewards.
