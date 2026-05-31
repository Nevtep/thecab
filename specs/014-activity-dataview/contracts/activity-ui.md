# Contract: Activity UI

## Route

```text
/activity
```

Activity is a connected, analysis-gated DataView. It uses the connected shell and behaves like Pools, Deposits, Strategies, and Rewards: no landing-page hero, no transaction execution controls, and no full-page visual reload during filters, pagination, or row selection.

## First Screen Composition

Desktop first screen:

1. Page title: Activity.
2. Supporting copy: localized equivalent of "Audit interpreted Aerodrome and Mellow transactions behind every metric."
3. KPI strip:
   - Total activity.
   - Supported/interpreted.
   - Partial or unresolved.
   - Excluded or malicious.
   - Valuation coverage.
4. Filter/search bar.
5. Active filter chips.
6. Main ledger table.
7. Selected activity rail.

Narrow screens may stack or use drill-in detail, but row detail must remain reachable in no more than two interactions from a ledger row.

## KPI Behavior

KPI cards use shared impact metric primitives. Each card includes:

- Localized label.
- Primary numeric value.
- Compact context line.
- Coverage/confidence cue when relevant.
- Semantic styling for warning/danger states.

Excluded or malicious rows must not look like earned value or losses.

## Filter Bar

Required controls:

- Search.
- Date presets: `7d`, `30d`, `90d`, `1y`, `all`, `custom`.
- Action type.
- Protocol surface.
- Token.
- Pool.
- Deposit/position.
- Strategy/strategy exposure.
- Reward context.
- Governance context.
- Coverage.
- Confidence.
- Resolution status.
- Clear-all.

Incoming context from another page appears as a removable chip.

## Ledger Table

Minimum columns:

- Selected row state.
- Date/time.
- Action.
- Transaction.
- Protocol surface.
- Linked entity.
- Token movements.
- Value.
- Coverage.
- Confidence.
- External transaction action.

Rows must visually and textually distinguish:

- Resolved/supported.
- Partial.
- Unresolved.
- Unsupported.
- Malicious/spam.
- Ambiguous.
- Discarded.
- Unavailable.

The table uses shared `DataTable` and shared pagination. It must preserve filters, sorting, page, page size, and selected row without a full-page visual reload.

## Selected Activity Rail

Required sections:

1. Summary.
2. Transaction details.
3. Classification evidence.
4. Asset movements.
5. Linked entities.
6. Rebalance explanation when applicable.
7. Coverage notes.
8. Source evidence references.

The rail shows an inline loading state when selection changes and data is being refreshed. If the selected row is removed by filters, the UI selects the first visible row or shows a selected-empty state without collapsing the page.

## Rebalance Detail

For rebalance or partial swap attribution rows, show:

- Related withdraw/decrease events.
- Residual attribution state.
- Related swap events.
- Related deposit/increase events where known.
- Token flow.
- Pool effect.
- Source allocation breakdown.
- Confidence.
- Coverage limitations.

## Empty And Locked States

States:

- Analysis locked.
- Limited recent mode, if enabled.
- No supported activity found.
- Filters match no activity.
- Selected row unavailable.
- Error with stable localized message.

Empty states must preserve surrounding shell and layout.

## Cross-Surface Navigation

Activity rows may link to:

- Pool detail.
- Deposit detail.
- Strategy detail.
- Reward context.
- Future Governance context.
- External chain explorer transaction.

Links must be chain-aware and localized labels must not be hardcoded.
