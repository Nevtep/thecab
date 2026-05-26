# Feature Specification: Analyzed Pools History

**Feature Branch**: `009-pools-history`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "create the spec for the pools feature as described in the product technical spec and architecture. It should allow to review up to 1y history of the pools the user participated in, tracking performance, underlying assets, deposit lifecycle, rebalances and redeploys, total rewards of the pool, and show visually rich data. use the image as guidelines for ui and design, follow brand guidelines, and review the Analysis engine to confirm current data will suffice for the requierements."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review All Participated Pools At A Glance (Priority: P1)

As an analyzed user, I need a Pools view that summarizes every pool I participated in across the covered history window so I can quickly understand where my capital went, what is still active, and which pools performed well or poorly.

**Why this priority**: The list view is the entry point to the feature. Without it, users cannot understand the scope of their pool participation or choose which market to inspect more deeply.

**Independent Test**: Can be fully tested by opening Pools after historical analysis is ready and verifying that every participated pool in the covered window appears with core metrics, filters, and visible coverage status.

**Acceptance Scenarios**:

1. **Given** a wallet with completed historical analysis and at least one participated pool, **When** the user opens Pools, **Then** the list shows every participating pool within the covered window with pool identity, current attributed value, capital entered, capital withdrawn, rewards claimed, estimated return, active status, and coverage.
2. **Given** the pool list is visible, **When** the user filters by active or closed state, manual or automated exposure, positive or negative return, or partial coverage, **Then** the results update to match the selected criteria without hiding relevant coverage warnings.
3. **Given** a wallet has no analyzed pool participation, **When** the user opens Pools, **Then** the feature shows a clear empty state explaining that no pool participation was reconstructed for the wallet.
4. **Given** historical analysis has not completed, **When** the user attempts to reach Pools, **Then** the feature remains locked and clearly explains that deeper pool analytics require analyzed history.

---

### User Story 2 - Inspect One Pool Across Up To One Year Of History (Priority: P1)

As an analyzed user, I need a rich pool detail view that preserves the economic continuity of a market over time so I can inspect value evolution, current and historical underlying assets, deposit lifecycle activity, rebalances, redeploys, residual attribution, and rewards in one place.

**Why this priority**: The product promise for Pools is not just discovery. It is the ability to reconstruct what happened in a market over time, including continuity across withdrawals, swaps, redeploys, and strategy participation.

**Independent Test**: Can be fully tested by opening a pool with historical activity and verifying that the detail view supports the covered history window, preserves continuity through rebalances and redeploys, and exposes the required charts, breakdowns, and timelines.

**Acceptance Scenarios**:

1. **Given** a pool with analyzed history, **When** the user opens its detail view, **Then** the feature shows a rich summary with pool identity, current attributed value, total capital entered, total rewards, estimated return, coverage status, and time-range controls for the covered history window up to one year.
2. **Given** the selected pool includes withdraw, swap, and redeploy activity that remains attributable to the same market, **When** the user views the value history and event timeline, **Then** the feature preserves value continuity, marks the rebalance or redeploy event, and explains the attributable portion without showing a misleading reset to zero.
3. **Given** the selected pool contains both manual Aerodrome exposure and Mellow automated strategy exposure, **When** the user views the detail page, **Then** the feature separates manual exposure, automated strategy exposure, and residual attributed assets while still showing the total pool exposure.
4. **Given** the selected pool has covered history shorter than one year, **When** the user selects the longest available range, **Then** the detail view shows the full covered window and makes the limits of coverage explicit.

---

### User Story 3 - Trust Partial And Inferred Pool Analytics (Priority: P2)

As an analyzed user, I need Pools to stay honest when reconstruction is partial so I can still use the feature without mistaking inferred, share-level, or incomplete values for fully certain accounting.

**Why this priority**: Honest explainability is a core product promise. Pools becomes misleading if it hides incomplete cases, fabricates precision, or collapses automated strategy uncertainty into manual certainty.

**Independent Test**: Can be fully tested by using a wallet with missing price coverage, partial strategy visibility, or unresolved attribution and verifying that pools remain visible with explicit coverage states, reasons, and constrained metric treatment.

**Acceptance Scenarios**:

1. **Given** a pool has incomplete prices, partial decoded lifecycle data, or unresolved attribution, **When** the user views the list or detail, **Then** the pool remains visible with an explicit coverage state and explanation rather than disappearing.
2. **Given** a pool includes automated strategy exposure that is reliable only at the share level, **When** the user inspects the strategy portion of the pool, **Then** the feature labels it as share-level coverage rather than presenting fully decomposed underlying accounting.
3. **Given** some rewards or historical values cannot be assigned with full confidence, **When** the user views the related metrics, **Then** the feature shows the covered amount, degrades the coverage state, and avoids overstating realized performance.

### Edge Cases

- A pool has multiple manual positions, automated strategy exposure, and residual wallet-held assets at the same time.
- A pool appears inactive because no position remains open, but residual attributed assets still belong economically to that pool.
- A rebalance or redeploy spans slice boundaries in the historical analysis window.
- A larger wallet swap only partially belongs to a given pool, so only part of the swap should appear in that pool's rebalance timeline.
- A Mellow strategy maps to the pool, but only share-level accounting is available for part of the selected range.
- Price history is missing for one or more underlying assets on some covered days.
- A wallet participated in pools more than one year ago; the feature must show only the covered analyzed window and not imply older history is missing due to a UI bug.
- A pool has rewards but no confidently reconstructed current value, or current value but only partially assigned rewards.
- The wallet has completed analysis but no qualifying pool participation, so the feature must distinguish between "no pools" and "analysis not ready".
- Mobile layouts must preserve coverage badges, range context, and the distinction between manual, automated, and residual exposure without collapsing them into ambiguous labels.

## Requirements *(mandatory)*

### Functional Requirements

#### 1) Feature Scope And Availability

- **FR-001**: The system MUST provide a dedicated analyzed Pools feature that summarizes and explains historical participation by pool.
- **FR-002**: Pools MUST remain unavailable until historical analysis is ready, and the locked state MUST explain why the feature is gated.
- **FR-003**: Pools MUST support the full analyzed history window up to 365 days and MUST show the actual covered range when less than one year is available.
- **FR-004**: Pools MUST treat each pool as a stable analytical unit that can aggregate manual deposits, automated strategy exposure, residual attributed assets, rewards, and lifecycle events.
- **FR-005**: Pools MUST remain a read-only analytics and monitoring surface and MUST NOT become a trading or execution workflow.
- **FR-006**: The feature MUST use analyzed domain records as its source of truth, and any additional pool-level rollups needed for the UI MUST be derived from those normalized records rather than from browser-direct provider responses.

#### 2) Pools List

- **FR-007**: The system MUST display all pools the wallet participated in during the covered history window.
- **FR-008**: Each pool row or card MUST show the pool name, underlying tokens, protocol family, current attributed value, capital entered, capital withdrawn, rewards claimed, estimated annualized return, active or inactive status, and coverage state.
- **FR-009**: The pool list MUST let users distinguish whether exposure is manual, automated, or mixed.
- **FR-010**: The pool list MUST support filtering by active pools, closed pools, manual exposure, automated exposure, positive return, negative return, and partial coverage.
- **FR-011**: The pool list SHOULD support searching by pool name or token symbol.
- **FR-012**: The pool list SHOULD support sorting by current value, rewards, return, or recent activity.
- **FR-013**: When no analyzed pools exist, the feature MUST show a pool-specific empty state rather than a generic error or blank page.

#### 3) Pool Detail Structure And Visuals

- **FR-014**: Each pool detail view MUST show a header with pair name, pool address or equivalent identity, token icons or symbols, active strategies, current attributed value, total capital entered, total rewards, estimated return, and coverage badge.
- **FR-015**: Each pool detail view MUST include visually rich summary panels and charts that follow The Cab control-tower brand direction and the provided reference image's information density and hierarchy.
- **FR-016**: The detail view MUST allow users to inspect the selected pool across supported date ranges up to the full covered window.
- **FR-017**: The primary historical visualization MUST show total attributed exposure over time and distinguish deployed exposure, residual attributed value, rewards, capital in or out markers, and rebalance markers.
- **FR-018**: Pool value history MUST NOT reset to zero only because assets were withdrawn from an active position when those assets remain attributable to the same pool.
- **FR-019**: The detail view MUST preserve a visible separation between manual deposits, automated strategy exposure, and residual attribution while also presenting the pool total.
- **FR-020**: The detail view MUST show the current underlying asset composition of the pool exposure when that composition is reconstructable.
- **FR-021**: The detail view SHOULD show historical composition changes or dated composition snapshots when those changes are reconstructable for the selected range.
- **FR-022**: The detail view MUST include an activity or lifecycle section that surfaces the most important pool events across the selected range.
- **FR-023**: The detail view SHOULD provide clear navigation to related strategy or deposit detail views when those related analytical surfaces exist.

#### 4) Lifecycle, Rebalances, Redeploys, And Residual Attribution

- **FR-024**: The feature MUST surface pool-relevant lifecycle events including deposit, increase, decrease, withdraw, claim, rebalance, redeploy, and close when those events can be reconstructed.
- **FR-025**: Each surfaced lifecycle event MUST include timestamp, event type, related assets, attributable USD value, confidence, and transaction reference.
- **FR-026**: Rebalance presentation MUST group the attributable withdraw, swap, and redeploy sequence into one explainable pool event when those actions belong to the same pool-level economic continuity.
- **FR-027**: Redeploy presentation MUST preserve continuity when capital leaves one position instance and re-enters the same pool or a mapped automated strategy tied to that pool.
- **FR-028**: When only part of a larger swap is attributable to the selected pool, the feature MUST show only the attributable portion and label the event as partial attribution.
- **FR-029**: Residual assets withdrawn from a pool MUST remain attributed to that pool until attribution is resolved, transferred away, liquidated into unrelated assets, or reassigned through supported attribution rules.
- **FR-030**: Automated strategy internal operations MUST NOT be mislabeled as manual user rebalances or manual deposit lifecycle events.

#### 5) Metrics, Rewards, And Underlying Assets

- **FR-031**: The pool detail view MUST show total capital entered, total capital withdrawn, current attributed value, total rewards, realized PnL, unrealized PnL, and estimated return when enough inputs exist.
- **FR-032**: If a metric cannot be reconstructed exactly, the feature MUST either omit it or label it as estimated or approximate rather than presenting it as certain.
- **FR-033**: Total pool rewards MUST aggregate rewards attributable to both manual deposits and automated strategies without double counting the same economic value.
- **FR-034**: Rewards presentation MUST allow the user to understand reward totals by token and by source pathway where known.
- **FR-035**: Underlying asset tracking MUST show token amounts and USD values for active and residual exposure where reconstructable.
- **FR-036**: The feature MUST preserve separate current values and statuses for individual manual deposits and automated strategies that contribute to the pool total.
- **FR-037**: Any annualized return or capital-efficiency metric MUST be based on historical invested capital over time rather than current capital alone.

#### 6) Coverage And Explainability

- **FR-038**: The feature MUST support at least these coverage states: `full`, `share_level`, `partial`, and `unknown`.
- **FR-039**: Pools list and pool detail MUST show coverage state and enough explanatory context for a user to understand whether the feature is relying on full, inferred, share-level, or partial reconstruction.
- **FR-040**: A pool with incomplete history or prices MUST remain visible when the product can still truthfully show some of its participation or value.
- **FR-041**: The feature MUST NOT fabricate current value, realized PnL, unrealized PnL, or rewards when pricing, attribution, or lifecycle evidence is incomplete.
- **FR-042**: The feature MUST clearly distinguish measured values from inferred or estimated values.
- **FR-043**: When the covered range is shorter than the requested one-year maximum, the feature MUST make the covered date range explicit in both list and detail contexts.
- **FR-044**: The feature MUST identify when pool totals reflect manual exposure only, automated exposure only, or a combined view with partial coverage.

#### 7) Presentation, Responsiveness, And Product Tone

- **FR-045**: The visual language for Pools MUST follow The Cab brand system: dark control-tower surfaces, gold identity accents, cyan or blue data accents, high-contrast KPI hierarchy, disciplined chart styling, and technically precise tone.
- **FR-046**: Pools MUST avoid meme, casino, retail-trading, or hype-oriented presentation and copy.
- **FR-047**: The feature MUST present dense analytical information in a way that remains legible on desktop and mobile layouts.
- **FR-048**: Visual richness MUST add analytical clarity, not decorative noise; charts, badges, breakdowns, and timelines must communicate state changes and confidence rather than act as ornament.
- **FR-049**: The feature MUST preserve a clear distinction between current state, historical series, and reconstructed events so the user can tell what is happening now versus what happened earlier in the window.

#### 8) Localization And Internal Data Boundaries

- **FR-050**: All user-facing copy, labels, filters, tooltips, legends, empty states, and coverage explanations introduced by Pools MUST be localized.
- **FR-051**: Pools MUST use locale-aware formatting for currency, percentages, token amounts, dates, times, and date-range labels.
- **FR-052**: The feature MUST consume only internal application data contracts in the browser and MUST NOT expose raw provider responses directly to the user.
- **FR-053**: The feature MUST preserve the product's separation between manual Aerodrome deposits and Mellow automated strategies even when both contribute to the same pool.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower tone and visual direction, using the provided reference image only as a layout and hierarchy guide, not as a reason to introduce hype-oriented or off-brand UI patterns.
- **CA-002 Localization**: Feature MUST define i18n impact across the `pools`, `coverage`, `charts`, and `common` namespaces and MUST prohibit hardcoded user-facing copy in the UI.
- **CA-003 Localization Formatting**: Feature MUST use locale-aware formatting for currency, token amounts, percentages, dates, times, and covered-range messaging.
- **CA-004 Chain Awareness**: Feature MUST treat pool identity, rewards, strategies, deposits, residual attribution, query scope, and API scope as chain-aware, while keeping Base mainnet as the only product-v1 enabled chain.
- **CA-005 Provider Boundaries**: Feature MUST preserve the data-source ownership defined by the architecture: Moralis for discovery signals, Alchemy Prices for price history, RPC and contract reads for protocol reconstruction, and normalized analyzed domain data as the browser-facing source of truth.
- **CA-006 Explainability**: Feature MUST make coverage state, covered date range, partial attribution, and estimated-versus-measured status visible anywhere the accounting is incomplete or inferred.

### Key Entities *(include if feature involves data)*

- **Pool Participation Summary**: The wallet-scoped aggregate view of one pool over the covered history window, including identity, current status, current attributed value, capital in and out, rewards, return posture, and coverage.
- **Pool History Series**: The time-based representation of a pool's attributed exposure across the covered range, including deployed value, residual attributed value, rewards, and important event markers.
- **Pool Exposure Segment**: One component of total pool exposure, such as manual deposit exposure, automated strategy exposure, or residual attributed assets.
- **Pool Lifecycle Event**: A chronological event tied to the selected pool, such as deposit, increase, decrease, withdraw, claim, rebalance, redeploy, or close, with attributable value and confidence.
- **Residual Attribution Record**: The representation of wallet-held assets that remain economically tied to a pool after withdrawal until they are resolved or reassigned.
- **Pool Reward Summary**: The user-facing accounting of reward value attributable to a pool across manual deposits and automated strategies, including token breakdown and coverage posture.
- **Pool Coverage Summary**: The explicit explanation of how complete or partial the pool's analytical reconstruction is for the selected range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a wallet with analyzed pool participation, 100% of pools reconstructed in the covered window appear in the Pools list with visible status and coverage labeling.
- **SC-002**: Users can reach a specific pool detail view and identify current attributed value, total rewards, and the latest major lifecycle event in no more than two interactions from the Pools entry state.
- **SC-003**: In pools where attributable rebalance or redeploy continuity exists, the historical value view preserves continuity and avoids misleading zero-value drops in at least 95% of validated cases.
- **SC-004**: 100% of metrics derived from partial, inferred, or share-level accounting display visible coverage or approximation labeling.
- **SC-005**: Users can inspect any covered pool history range up to one year without losing the distinction between manual exposure, automated strategy exposure, and residual attributed assets.

## Assumptions

- Historical analysis is the prerequisite for Pools, and the analyzed history window is capped at up to 365 days in product v1.
- Product v1 remains Base mainnet only, but pool identities, rewards, strategies, deposits, and attribution records remain chain-aware.
- The provided reference image is a design-direction input for analytical density, hierarchy, and panel structure; final copy and states still follow The Cab brand and localization rules.
- The existing analysis engine already stores the core primitives needed for this feature, including pools, deposits, strategy exposure, rewards, ledger events, asset movements, attribution records, and daily snapshots, but richer pool-level UI metrics will require derived rollups or series built from those normalized records.
- Pools may link to related Deposit or Strategy detail surfaces for deeper inspection rather than duplicating every subordinate analysis workflow inside the pool detail itself.