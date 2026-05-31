# Research: Governance Engine Processing And Metrics DataView

## Decision: Governance Classification Stays Inside Historical Analysis

Governance classification will run in the background analysis/materialization boundary, not in `/api/governance` and not in feature UI.

**Rationale**: The constitution requires feature APIs to read normalized persistence only. Governance classification needs wallet history, decoded transactions, logs, contract evidence, reward rows, token movements, prices, and coverage reasoning. Doing that work at request time would create slow, non-reproducible, provider-dependent screens.

**Alternatives considered**:

- Request-time provider calls for missing rows: rejected because it violates provider/API discipline and creates reload-prone UI.
- UI-side classification from Activity rows: rejected because it would duplicate domain logic and encourage table-first Governance.
- Persist only raw `governance_events`: rejected because the first-screen view model needs lock, epoch, reward, breakdown, coverage, and detail projections.

## Decision: Protocol Surface Detection Requires Explicit Governance Evidence

Governance actions are classified only when evidence touches Aerodrome governance surfaces: veAERO/voting escrow, voter, relay, bribe contracts, fee distributors, reward distributors, related AERO movements, or persisted governance reward evidence.

**Rationale**: Product and repo rules prohibit guessed ownership/classification. Router-only activity, pool/time proximity, token symbol matching, or generic transfers are insufficient for Governance promotion.

**Alternatives considered**:

- Pool and timestamp inference: rejected as an invented heuristic.
- Any AERO transfer as governance: rejected because AERO may be swapped, transferred, airdropped, claimed, or unrelated.
- Only decoded wallet history: rejected because bribe/fee/rebase and lock lifecycle often require protocol log/contract evidence.

## Decision: Lock Lifecycle Uses A Chain-Scoped Lock Exposure Model

Lock exposure will be modeled separately from event detail. It summarizes current lock state and lifecycle from explicit lock identity when available, or from partial evidence with coverage notes when lock identity is missing.

**Rationale**: The persistent lock panel is a first-screen state surface, not a selected-row detail. It must continue to explain current exposure even when the user selects a reward, vote, or unsupported row.

**Alternatives considered**:

- Derive lock status from the selected row: rejected because it couples persistent exposure state to arbitrary selection.
- Hide lock panel when identity is partial: rejected because partial governance exposure is still user-relevant and must be visible.
- Treat veAERO locks as deposits: rejected because product spec separates Governance from LP/manual positions.

## Decision: Epoch Timeline Is A Compact Analytical Projection

The vote timeline groups governance activity by epoch when possible and renders compact epoch summaries, not ledger rows. Each epoch summary carries epoch identity, voted pools, weights where available, manual/relay context, reset state, fee/bribe/reward state, claim/pending state, coverage, and confidence.

**Rationale**: Governance must not devolve into a generic activity table. Epochs are the natural product unit for votes, rewards, and claim state.

**Alternatives considered**:

- Raw chronological vote table: rejected for first screen because it duplicates Activity.
- One aggregate vote chart only: rejected because users need evidence-backed epoch-level inspection.
- Fabricated epoch grouping from date only: rejected unless the protocol epoch can be derived or the grouping is explicitly partial.

## Decision: Governance Rewards Reconcile Through RewardEvent Identity

Governance rewards remain visible in Governance and Rewards, and may link to Pools when explicit association exists. The same underlying reward claim contributes once to product aggregates through reward identity and contribution rules.

**Rationale**: Product spec requires governance rewards in Rewards and explainable in Governance, with pool display where Aerodrome provides association. Double counting would corrupt portfolio and pool totals.

**Alternatives considered**:

- Duplicate governance rewards into separate governance-only totals: rejected because it risks double counting.
- Always allocate governance rewards to pools by voted pool/time proximity: rejected as evidence fabrication.
- Exclude unallocated governance rewards from Governance: rejected because incomplete association is still important and must be marked partial.

## Decision: Pool Association Requires Explicit Evidence

Governance reward-to-pool links require protocol-derived or persisted evidence such as bribe/fee contract context, decoded event metadata, reward row metadata, or another normalized row that explicitly carries pool identity.

**Rationale**: Governance rewards can be fee/bribe/rebase/relay-related. A pool link is useful only when defensible and inspectable.

**Alternatives considered**:

- Associate by latest vote target: rejected because votes and claims can diverge.
- Associate by token pair symbol: rejected because symbols are not identity.
- Associate by user-selected filter: rejected because filters should not change attribution.

## Decision: First-Screen Read Model Is A Single GovernanceViewModel

The route serves a first-screen `GovernanceViewModel` containing analysis status, filters, KPI strip model, lock status panel, epoch timeline, governance rewards page, reward-type breakdown, selected detail, available filters, and coverage/confidence summaries.

**Rationale**: The clarified spec makes first-screen composition mandatory. A single read contract prevents page reload-style stitching and ensures KPI, timeline, rewards, breakdown, and detail reconcile to the same filter/selection context.

**Alternatives considered**:

- Separate endpoints per panel: rejected for initial implementation because it increases selection/filter race conditions.
- Table-first endpoint with UI-computed panels: rejected because it weakens product intent and coverage propagation.
- Full raw event stream only: rejected because it is Activity, not Governance.

## Decision: Selected Detail Owns Evidence Explanation

The selected-detail panel explains the currently selected governance event, epoch, reward, or metric. It includes action summary, tx/timestamp where available, protocol surface, token movements, value effect, epoch/vote/pool context, classification evidence, linked product contexts, coverage notes, and source evidence refs.

**Rationale**: First-screen panels must remain compact while still allowing users to audit every metric and row within two interactions.

**Alternatives considered**:

- Put full evidence in every row/card: rejected because it destroys density.
- Use external explorer as primary detail: rejected because Governance must be product-native and evidence-backed.
- Omit detail for partial/unresolved rows: rejected because uncertainty must be inspectable.

## Decision: Coverage And Confidence Propagate Through Every Visible Layer

Coverage/confidence are materialized for KPI values, lock status, epoch summaries, reward rows, selected detail, and overall extraction coverage. Partial/unresolved/unsupported/excluded values remain visible and are excluded from confident totals.

**Rationale**: The Cab's trust model depends on visible uncertainty. Governance is especially sensitive because managed rewards, relay participation, rebase semantics, and pool association can be partial.

**Alternatives considered**:

- Page-level coverage only: rejected because users need row/metric-level context.
- Hide low-confidence rows: rejected because it conceals data quality issues.
- Include partial values in primary totals without labeling: rejected because it creates false precision.

## Decision: Cross-Surface Links Require Persisted Identity

Governance links to Activity when a governance row has explicit transaction/activity identity, to Rewards when a governance reward has explicit reward identity, and to Pools only when pool association is explicit. Links explain related surfaces but do not duplicate totals.

**Rationale**: Cross-surface navigation is central to The Cab's audit flow, but links must not create inferred ownership or aggregation drift.

**Alternatives considered**:

- Link every governance reward to a pool by label: rejected because labels are not evidence.
- Link every Activity governance row to Governance by fuzzy matching: rejected because links require persisted entity identity.
- Omit links until perfect coverage: rejected because explicit links already provide product value.

## Decision: Validation Uses Unit, Route, Service, Mapper, Materializer, And Regression Tests

Automated validation will cover classification, read-model materialization, repository/service/route contracts, UI mappers, URL state, navigation links, i18n parity, DS compliance, and deterministic governance regression fixtures. Manual signoff covers auth-gated visual behavior.

**Rationale**: This matches constitution v1.1.0 and existing Activity/Rewards/Strategies patterns.

**Alternatives considered**:

- Playwright/browser E2E: rejected by constitution.
- Manual-only validation: rejected because engine classification and reconciliation require deterministic tests.
- Provider-live regression only: rejected because repeatability matters.
