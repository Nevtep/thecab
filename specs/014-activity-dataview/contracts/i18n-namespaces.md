# Contract: Activity i18n Namespaces

## New Namespace

### `activity`

Required key groups:

- `page.title`
- `page.subtitle`
- `kpis.*`
- `filters.*`
- `filterChips.*`
- `actions.*`
- `protocolSurfaces.*`
- `coverage.*` when Activity-specific wording is needed
- `confidence.*` when Activity-specific wording is needed
- `resolution.*`
- `table.columns.*`
- `table.empty.*`
- `selected.*`
- `selected.summary.*`
- `selected.transaction.*`
- `selected.classificationEvidence.*`
- `selected.assetMovements.*`
- `selected.linkedEntities.*`
- `selected.rebalance.*`
- `selected.coverageNotes.*`
- `selected.sourceEvidence.*`
- `reasonCodes.*`
- `errors.*`

English is canonical. Spanish must have parity.

## Existing Namespace Updates

### `navigation`

- Enable Activity label and ready/locked/coming-soon copy updates if needed.

### `coverage`

- Add or confirm labels for:
  - `full`
  - `partial`
  - `unresolved`
  - `excluded`
  - `unsupported`
  - `malicious`
  - `ambiguous`
  - `discarded`
  - `unavailable`

### `errors`

- Add or confirm stable message mappings for:
  - `ANALYSIS_NOT_READY`
  - `INVALID_ACTIVITY_FILTER`
  - `ACTIVITY_EVENT_NOT_FOUND`
  - `UNSUPPORTED_CHAIN`
  - `WALLET_MISMATCH`

### `common`

- Reuse existing labels for search, clear all, pagination, open transaction, loading, selected, empty, and rows per page where available.

## Formatting Requirements

Use centralized locale formatters for:

- Currency values.
- Token amounts.
- Percentages.
- Dates and times.
- Durations.
- Compact row counts.
- Transaction hash display.

No feature component may use local `new Intl`, raw `toFixed`, or hardcoded date formatting.

## Copy Tone

Activity copy must be precise and audit-friendly:

- Prefer "unsupported", "ambiguous", "excluded", "malicious", "partial", and "unavailable" over casual terms.
- Avoid hype, trading, execution, or recommendation language.
- Avoid implying that excluded or malicious transfers are earned value.
