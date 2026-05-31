# Contract: Governance UI

## Route

```text
/governance
```

Governance is a connected, analysis-gated DataView. It uses the connected shell and behaves like Pools, Deposits, Strategies, Rewards, and Activity: no landing-page hero, no transaction execution controls, no wallet-write actions, and no full-page visual reload during filters, pagination, or row selection.

## First Screen Composition

Desktop first screen is dashboard-first and mandatory:

1. Page title: Governance.
2. Supporting copy: localized equivalent of "Inspect and analyze locks, votes, relays, and governance rewards."
3. Top KPI strip.
4. Persistent lock status panel.
5. Compact vote timeline by epoch.
6. Governance rewards list/table.
7. Reward-type/value breakdown.
8. Selected-detail inspection panel.

Expanded raw history, deep evidence inspection, unsupported/excluded review, and linked-surface drilldowns are secondary. They must not replace the first-screen control surface.

## KPI Strip

Mandatory KPI categories:

- Locked AERO.
- veAERO exposure.
- Lock expiry or remaining duration.
- Governance rewards claimed.
- Estimated governance return.
- Overall coverage state.

Each KPI uses shared impact metric primitives and includes localized label, primary value or unavailable state, compact context line, coverage/confidence cue, and semantic styling for partial/unavailable/error states. Estimated return must be explicitly labeled as estimated.

## Persistent Lock Status Panel

The lock panel is not selected-detail. It is persistent first-screen state.

Required content:

- Lock identity when available.
- Current status: active, expired, withdrawn, partial, or unknown.
- Creation date when available.
- Expiry or remaining duration when available.
- Locked AERO and optional USD value.
- veAERO exposure.
- Lifecycle markers: creation, increase, extension, relock, withdrawal where available.
- Coverage and confidence.
- Missing evidence notes when partial.

The panel must remain meaningful when a reward row, epoch card, KPI, or unsupported row is selected.

## Vote Timeline

The vote timeline is an epoch-level analytical surface, not a raw ledger table.

Each compact epoch card must show:

- Epoch identity.
- Epoch date bounds when available.
- Voted pools when explicit.
- Vote weights when available.
- Manual versus relay context when available.
- Reset state.
- Fees/bribes/rebases/rewards state.
- Claim or pending status.
- Coverage and confidence.

Epoch cards may be selectable and load the selected-detail rail.

## Governance Rewards List/Table

Minimum first-screen row model:

- Reward date or epoch.
- Reward type.
- Token.
- Amount.
- USD value at claim.
- Associated epoch.
- Associated pool when explicit.
- Coverage.
- Confidence.
- Context or linked source.

Rows must distinguish supported, partial, unresolved, unsupported, excluded, and unavailable states. Governance rewards must be inspectable here and reconcilable with Rewards/Pools without double counting.

## Reward-Type/Value Breakdown

The first screen must include a compact analytical breakdown of governance reward value by reward type:

- Fees.
- Bribes.
- Rebases.
- Relay rewards.
- Unknown governance rewards.

A ring/donut presentation is preferred when multiple categories exist. Empty, no-value, or single-category states may degrade to an equivalent compact summary. The breakdown must expose coverage state and must not imply unavailable values are complete.

## Selected-Detail Inspection Panel

The selected-detail panel explains the currently selected governance row, reward row, epoch card, or metric.

Required sections:

1. Action summary.
2. Transaction hash and timestamp when available.
3. Protocol surface.
4. Token movements.
5. Value at claim or value effect.
6. Epoch, vote, and pool context where available.
7. Classification evidence.
8. Linked product contexts.
9. Coverage notes.
10. Evidence sources.

For supported rows, applicable sections must be populated from evidence-backed data. For partial/unresolved/unsupported/excluded rows, the panel keeps structural sections and explains missing, unsupported, excluded, or partial evidence.

## Filter Bar And URL State

Required controls:

- Search.
- Date preset/custom range.
- Event type.
- Reward type.
- Protocol surface.
- Epoch.
- Pool.
- Token.
- Coverage.
- Confidence.
- Clear-all.

Incoming context from Rewards, Pools, or Activity appears as a removable active chip. Filters, selected row, sort, page, and page size update without full-page visual reload.

## Cross-Surface Navigation

Governance may link to:

- Activity, when a governance row has explicit transaction/activity identity.
- Rewards, when a governance reward has explicit reward identity.
- Pools, when a reward or epoch has explicit pool association.
- External chain explorer transaction links through chain config.

Links explain or reference other surfaces. They must not duplicate or double-count totals.

## Empty, Locked, And Partial States

States:

- Analysis locked.
- Analysis ready but no governance activity.
- Filters match no governance rows.
- No active lock but governance rewards exist.
- Partial lock reconstruction.
- Partial epoch grouping.
- Partial/unresolved reward association.
- Unsupported governance action.
- Excluded/spam governance-like activity.
- Selected row unavailable after filtering.
- Error with stable localized message.

Empty and partial states preserve the shell and first-screen layout.

## Non-Goals

Governance must not be:

- A transaction execution surface.
- A raw transaction explorer.
- A governance news feed.
- A speculative APR marketing page.
- A generic table-first activity page.
- A feature that fabricates pool or epoch associations without evidence.
