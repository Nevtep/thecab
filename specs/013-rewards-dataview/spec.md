# Feature Specification: Rewards DataView

**Feature Branch**: `013-rewards-dataview`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Create the next feature spec in the roadmap as described by the technical and architecture documents. I suggest next step is rewards dataview, so we can consistently see the data flow from deposits and strategies to rewards to pools."

## Feature Selection Context

The current roadmap separates manual Deposits, automated Strategies, Pools, and future Governance into distinct analytical surfaces. The next most useful feature is a first-class **Rewards DataView** because rewards are the connective tissue between those surfaces: a reward may belong to a manual deposit, a strategy exposure, or governance activity, while also contributing to pool and portfolio totals.

This feature makes reward ownership inspectable. It must show where claimed value came from, which entity owns it, whether it contributes to pool aggregates, and why unresolved or excluded reward-shaped activity is not counted. The goal is a dense analysis workspace that lets users verify the data flow from deposits and strategies to rewards to pools without relying on hidden reconciliation.

## Clarifications

### Session 2026-05-30

- Q: How closely should the Rewards DataView follow the supplied mockup? → A: Treat the mockup as the product-level DataView contract for information architecture, required panels, visual hierarchy, and interaction behavior, while allowing exact values, labels, chart rendering, and responsive layout details to adapt to real data and design-system constraints.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review All Claimed Rewards (Priority: P1)

As an analyzed user, I need a Rewards view that lists every supported claim or fee event found in my covered history so I can understand how much value I earned and where it came from.

**Why this priority**: Rewards is promised as a top-level product surface. It is the only place where users can inspect claims across manual deposits, automated strategies, governance, tokens, and pools in one workflow.

**Independent Test**: Can be fully tested by opening Rewards after historical analysis is ready for a wallet with at least one resolved reward and verifying that the first screen presents the mockup-aligned DataView: page title and subtitle, five KPI cards, search and filter bar, rewards-over-time chart, distribution panels, reward events table, and selected reward rail.

**Acceptance Scenarios**:

1. **Given** a wallet with completed historical analysis and resolved reward events, **When** the user opens Rewards, **Then** the view shows total claimed rewards, reward event count, estimated reward return, resolved rewards value, unresolved or excluded value, source breakdown, pool contribution breakdown, token breakdown, rewards-over-time chart, chronological reward list, and selected reward detail for the active chain.
2. **Given** rewards exist for manual deposits, automated strategies, and governance activity, **When** the user views the source breakdown, **Then** each reward is grouped under the correct source without merging the ownership models.
3. **Given** historical analysis is not ready for the connected wallet and active chain, **When** the user opens Rewards, **Then** the feature remains locked with the same analyzed-surface gating pattern used elsewhere.
4. **Given** completed analysis found no supported reward events, **When** the user opens Rewards, **Then** the feature shows a clear empty state that distinguishes "no rewards found" from "analysis unavailable."
5. **Given** the wallet has both resolved and unresolved or excluded reward-shaped activity, **When** the user opens Rewards, **Then** the resolved and unresolved or excluded values appear as separate KPI cards and are not blended into one confident total.

---

### User Story 2 - Trace Reward Ownership And Pool Contribution (Priority: P1)

As an analyzed user, I need each reward to show its owner, source surface, and pool contribution so I can verify whether it came from a manual deposit, strategy, or governance activity and whether it affects pool totals.

**Why this priority**: The product must avoid double counting and must not guess ownership from pool plus time window. Reward ownership is the feature's core trust contract.

**Independent Test**: Can be fully tested with a wallet containing manual deposit rewards and Mellow strategy rewards for the same underlying pool, verifying that each reward links to the correct owner, contributes to pool totals only once, and does not inflate the other owner's totals.

**Acceptance Scenarios**:

1. **Given** a concentrated-liquidity gauge reward tied to a known manual deposit identity, **When** the reward appears in Rewards, **Then** it is labeled as manual-deposit owned and links to the deposit and pool.
2. **Given** a Mellow wrapper or staking reward tied to a known strategy exposure, **When** the reward appears in Rewards, **Then** it is labeled as strategy-owned and links to the strategy exposure and underlying pool where known.
3. **Given** a governance fee, bribe, or rebase reward tied to governance activity, **When** the reward appears in Rewards, **Then** it is distinguishable from LP deposit and strategy rewards and does not inflate deposit or strategy reward totals.
4. **Given** a reward contributes to a pool aggregate, **When** the user compares Rewards and Pool detail, **Then** the reward appears once in total reward accounting and its pool contribution is explainable from the reward row.
5. **Given** a reward-shaped event lacks enough owner evidence, **When** the user opens Rewards, **Then** it is unresolved, partial, excluded, or unavailable rather than silently assigned to the nearest pool, deposit, or strategy.

---

### User Story 3 - Inspect Selected Reward Evidence (Priority: P1)

As an analyzed user, I need a selected reward panel that explains ownership, pool contribution, claim details, coverage, and nearby unresolved or excluded activity so I can audit a reward without leaving the DataView.

**Why this priority**: The mockup's right rail is the feature's main explainability surface. It turns a table row into a traceable reward event and prevents the user from needing to infer ownership from table columns alone.

**Independent Test**: Can be fully tested by selecting a resolved reward row and verifying that the selected reward rail shows the reward summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved or excluded activity list without changing routes.

**Acceptance Scenarios**:

1. **Given** a reward row is selected, **When** the selected reward rail loads, **Then** it shows token symbol, token identity cue, reward type, token amount, claim-time value, owner category, coverage badge, and confidence indicator.
2. **Given** the selected reward has resolved ownership, **When** the user views Ownership Trace, **Then** it shows owner category, linked entity, source surface, and evidence summary.
3. **Given** the selected reward contributes to a pool aggregate, **When** the user views Pool Contribution, **Then** it shows contribution status, linked pool, counting rule, and double-counting note.
4. **Given** claim details are available, **When** the user views Claim Details, **Then** it shows transaction hash, claim time, reward type, source contract or surface, and external transaction path where available.
5. **Given** the selected reward has non-full coverage, **When** the user views Coverage Notes, **Then** the rail states what is counted, what is missing, and whether the value is included in confident aggregates.
6. **Given** unresolved or excluded reward-shaped activity exists in the current filtered context, **When** the user views the rail, **Then** a compact list shows the most relevant unresolved or excluded rows with token, time, amount, value when available, and reason.

---

### User Story 4 - Analyze Reward Performance Over Time (Priority: P2)

As an analyzed user, I need rewards over time and capital-adjusted reward return so I can understand whether claimed value was meaningful relative to deployed capital.

**Why this priority**: Total claimed value alone is incomplete. The product spec requires rewards by time range and estimated reward return against historical invested capital, with approximation clearly labeled when exact capital timing is unavailable.

**Independent Test**: Can be fully tested with a wallet that has multiple rewards across the covered history, verifying that date filtering updates totals, timeline distribution, and estimated reward-return metrics while preserving coverage labels.

**Acceptance Scenarios**:

1. **Given** rewards across multiple dates, **When** the user selects a time range, **Then** totals, source breakdowns, timeline, and reward list update to that range.
2. **Given** historical capital data is available for the selected range, **When** the user views reward return, **Then** the metric is calculated relative to historical invested capital rather than current capital only.
3. **Given** exact time-weighted capital is unavailable or partial, **When** reward return is shown, **Then** the metric is labeled estimated or unavailable with a coverage reason.
4. **Given** a reward is missing valuation at claim time, **When** the reward appears in summaries, **Then** its token amount remains visible while USD totals and return metrics show partial coverage.

---

### User Story 5 - Filter And Compare Reward Flows (Priority: P2)

As an analyzed user, I need to filter and compare rewards by source, pool, strategy, deposit, token, reward type, coverage, and time range so I can investigate a specific flow without manual reconciliation.

**Why this priority**: Rewards sits across several product surfaces. Filtering makes it useful as an audit and comparison workspace rather than a long undifferentiated ledger.

**Independent Test**: Can be fully tested with a wallet containing multiple reward types across more than one pool, verifying that filters compose, active filters are visible, and incoming links from Pools, Deposits, and Strategies preserve context.

**Acceptance Scenarios**:

1. **Given** rewards from multiple sources, **When** the user filters by manual deposits, strategies, governance, pool, token, reward type, or coverage state, **Then** the list and summaries reflect all active filters.
2. **Given** the user arrives from a Pool, Deposit, or Strategy detail page, **When** Rewards opens, **Then** it is pre-filtered to the related entity and the active filter is visible and clearable.
3. **Given** a filter removes all rewards, **When** the user views the DataView, **Then** a contextual empty state explains that no rewards match the current filters.
4. **Given** the user clears filters, **When** the DataView refreshes, **Then** the full rewards set for the covered wallet and active chain returns without losing the analysis-ready state.

---

### User Story 6 - Understand Unresolved And Excluded Reward-Shaped Activity (Priority: P2)

As an analyzed user, I need reward-shaped transactions with incomplete, unsupported, or spam-like evidence to be surfaced honestly so I can see why they do or do not affect my totals.

**Why this priority**: The Cab's accuracy depends on visible uncertainty. Unknown reward surfaces, ambiguous wrapper withdraws, governance claims outside LP ownership, and spam airdrops must not be converted into confident totals.

**Independent Test**: Can be fully tested with sample events that include an unknown reward contract, an ambiguous wrapper withdraw, a governance claim, and a spam-like airdrop, verifying that each receives the correct unresolved, excluded, or scoped status and does not distort deposit, strategy, or pool totals.

**Acceptance Scenarios**:

1. **Given** a claim-like transaction touches an unmapped reward contract, **When** it appears in Rewards, **Then** it is marked unresolved with the missing mapping reason and excluded from confident owner totals.
2. **Given** a wrapper withdrawal may include rewards but the reward token inflow cannot be isolated from principal, **When** Rewards processes the event, **Then** no fabricated reward is counted and the limitation is visible where relevant.
3. **Given** a spam-like airdrop is detected before reward resolution, **When** the user views Rewards, **Then** it is excluded from reward totals and can only appear as excluded evidence if the product exposes audit context.
4. **Given** a non-full coverage state affects rewards, **When** the user views summaries or rows, **Then** coverage messaging explains which totals are full, partial, unresolved, or unavailable.

### Edge Cases

- A manual deposit reward has explicit deposit identity but no USD price at claim time; ownership is resolved, token amount is shown, and USD metrics are partial.
- A strategy reward resolves to a strategy exposure but the underlying pool mapping is unavailable; the reward remains strategy-owned and pool contribution is unavailable.
- A governance reward maps to a pool but is not LP-owned; it appears as governance and does not inflate manual deposit or strategy rewards.
- A reward-shaped token transfer enters the wallet without a known protocol surface; it remains unresolved or excluded rather than assigned by pool or time proximity.
- A single transaction contains multiple economic components; each component is represented independently so principal movement, reward claims, and closures are not collapsed into one misleading row.
- A pool has both manual deposit rewards and strategy rewards; pool-level totals aggregate resolved rewards once while preserving owner breakdown.
- Multiple deposits or strategies exist for the same pool during a v2 fee claim; the feature must use only spec-backed ownership rules and disclose aggregate attribution where per-position ownership is not available.
- A reward is visible in Rewards, Pool detail, Deposit detail, Strategy detail, or future Governance; portfolio and pool totals count it once.
- A date filter includes reward token amounts with mixed valuation coverage; totals disclose partial USD coverage rather than hiding unpriced rewards.
- The active chain changes; all reward identities, summaries, filters, and links must be scoped to the selected chain.
- A narrow viewport cannot fit summary, distributions, and the reward list side by side; the same information remains reachable without removing ownership or coverage context.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Rewards MUST remain locked until the connected wallet has a successful historical analysis run for the active chain.
- **FR-002**: Rewards MUST show supported reward and fee events for the connected wallet and active chain across manual deposits, automated strategies, governance activity, and unresolved supported surfaces.
- **FR-003**: Rewards MUST NOT create, count, or display a confident reward from spam-like airdrops, unmapped token inflows, or unsupported reward-shaped transfers.
- **FR-004**: Each reward row MUST show timestamp, reward token, token amount, value at claim time when available, reward type, source category, owner status, pool contribution status, transaction reference, coverage state, and confidence.
- **FR-005**: Reward identity MUST be stable and chain-aware, based on the reward event's transaction evidence and event position or movement identity.
- **FR-006**: Reward ownership MUST resolve to manual deposit, strategy exposure, governance, unresolved, excluded, or unavailable status; pool-only ownership MUST NOT be sufficient for manual deposit or strategy attribution.
- **FR-007**: Manual deposit rewards MUST resolve through explicit deposit identity or same-transaction deposit evidence and MUST NOT include strategy-owned rewards.
- **FR-008**: Strategy rewards MUST resolve through strategy exposure identity and MUST NOT include manual deposit rewards.
- **FR-009**: Governance rewards MUST be distinguishable from LP deposit and strategy rewards and MUST NOT inflate deposit or strategy reward totals.
- **FR-010**: Pool totals MAY aggregate resolved manual deposit rewards, resolved strategy rewards, and supported governance rewards where pool mapping is known, but each reward MUST be counted once.
- **FR-011**: Rewards MUST surface unresolved reward events with a reason when owner, source, valuation, or pool mapping cannot be determined with spec-backed confidence.
- **FR-012**: Rewards MUST surface excluded reward-shaped activity only when useful for audit context and MUST keep excluded activity out of reward totals.
- **FR-013**: Rewards MUST support summaries for total claimed value, reward count, rewards by source, rewards by pool, rewards by strategy, rewards by token, rewards by reward type, and valuation coverage.
- **FR-014**: Rewards MUST provide a chronological timeline of rewards over the selected time range with token, amount, value at claim time when available, source category, owner, pool where known, and transaction reference.
- **FR-015**: Rewards MUST show capital-adjusted reward return when historical invested capital coverage is sufficient.
- **FR-016**: Rewards MUST label reward return as estimated, partial, or unavailable when exact historical capital coverage is incomplete.
- **FR-017**: Rewards MUST value rewards at claim time when valuation is available; missing claim-time valuation MUST degrade USD totals instead of substituting misleading values.
- **FR-018**: Rewards MUST support filters for source category, pool, deposit, strategy, token, reward type, coverage state, resolution status, and date range.
- **FR-019**: Rewards MUST support stable sorting by claim date, value at claim, token amount, source category, owner status, and coverage state.
- **FR-020**: Rewards MUST preserve incoming navigation context from Pools, Deposits, and Strategies by opening with the related entity filter applied and visible.
- **FR-021**: Rewards MUST link resolved manual deposit rewards to the relevant Deposit and Pool where known.
- **FR-022**: Rewards MUST link resolved strategy rewards to the relevant Strategy exposure and Pool where known.
- **FR-023**: Rewards MUST link governance rewards to governance context when available and to Pool where supported by reliable mapping.
- **FR-024**: Rewards MUST provide an explicit empty state for no rewards found and a separate contextual empty state for filters that match no rewards.
- **FR-025**: Rewards MUST reconcile with Pools, Deposits, and Strategies: source-level totals in Rewards must match those surfaces or explain partial, unavailable, unresolved, or excluded portions.
- **FR-026**: Rewards MUST provide coverage notes for non-full summaries, unresolved rows, approximate reward-return metrics, and mixed valuation coverage.
- **FR-027**: Rewards MUST use the coverage states `full`, `partial`, `unresolved`, `excluded`, and `unavailable` consistently across summary metrics, distributions, rows, and cross-linked surfaces.
- **FR-028**: Rewards MUST support transaction decomposition so one transaction can produce multiple economic components without collapsing principal movements, reward claims, and closures into one reward.
- **FR-029**: Rewards MUST NOT infer reward ownership by pool address plus time window when explicit owner identity is required.
- **FR-030**: Rewards MUST provide localized labels and explanations for reward sources, reward types, filters, sort options, coverage states, resolution reasons, timeline labels, chart legends, empty states, and return disclaimers.
- **FR-031**: The Rewards first screen MUST be a DataView analysis workspace rather than a marketing page. It MUST combine summary metrics, filter controls, distribution panels, a timeline, and a reward event list in one cohesive surface.
- **FR-032**: The DataView MUST preserve The Cab's dense control-tower interaction model with compact metrics, technical dividers, status badges, confidence indicators, and restrained cyan/gold/semantic accents.
- **FR-033**: The DataView MUST remain usable on narrow screens by preserving summaries, filters, ownership, coverage, timeline, and row detail through stacking, tabs, or drill-in behavior.
- **FR-034**: The page heading MUST present Rewards as the primary title and localized supporting copy equivalent to "Inspect claimed value across deposits, strategies, governance, pools, and tokens."
- **FR-035**: The KPI strip MUST contain five primary cards in this order: total claimed rewards, reward events, estimated reward return, resolved rewards value, and unresolved or excluded value.
- **FR-036**: Each KPI card MUST show the primary metric, a compact context line such as comparison, percentage of total, or coverage note, and a small trend or activity cue where data exists.
- **FR-037**: The estimated reward return KPI MUST be visibly labeled as estimated unless exact historical capital coverage is complete.
- **FR-038**: The resolved rewards value KPI MUST show what share of total claimed value is fully resolved and included in confident aggregates.
- **FR-039**: The unresolved or excluded value KPI MUST show the amount and share of reward-shaped value that is unresolved, excluded, or unavailable and MUST use warning or danger styling distinct from resolved rewards.
- **FR-040**: The filter bar MUST include search across reward text, transaction hash, pools, tokens, and linked entities; date presets for 7d, 30d, 90d, 1y, all, and custom date selection; source filters for all, deposits, strategies, and governance; token, pool, reward type, and coverage filters; active filter chips; and clear-all behavior.
- **FR-041**: Incoming context from a Pool, Deposit, or Strategy MUST appear as an active removable filter chip, such as a pool-specific filter, rather than hidden navigation state.
- **FR-042**: The rewards-over-time panel MUST combine claimed value, estimated reward return, and reward count over the selected range, with claim-event markers, coverage percentage, and a note when values are partial.
- **FR-043**: The rewards-over-time panel MUST support daily or equivalent time grouping and provide controls for switching chart/table emphasis where the product has enough data to show both.
- **FR-044**: The source breakdown panel MUST show total rewards grouped by manual deposits, strategies, and governance, including value and percentage share for each group.
- **FR-045**: The pool contribution breakdown panel MUST show the top contributing pools by reward value and percentage, plus an aggregate "other pools" group when more pools exist than can be shown comfortably.
- **FR-046**: The token breakdown panel MUST show rewards by token with value and percentage share, preserving token identity cues where available and grouping small or unknown tokens as "other" when needed.
- **FR-047**: Distribution panels MUST provide clear paths to the corresponding filtered view, such as viewing details for a source group, pool group, or token group.
- **FR-048**: The reward events table MUST include, at minimum, selectable row state, date/time, token, token amount, value at claim, owner/source, linked entity, pool, reward type, pool contribution, coverage, confidence, and transaction action.
- **FR-049**: The reward events table MUST visually distinguish resolved contributing rewards, resolved non-contributing rewards, unresolved rewards, and excluded activity without relying on color alone.
- **FR-050**: Reward row confidence MUST be represented as a compact graded indicator and paired with a readable confidence label or accessible equivalent.
- **FR-051**: The reward events table MUST support pagination or equivalent incremental browsing, visible result count, and configurable rows-per-page behavior for larger histories.
- **FR-052**: Selecting a reward row MUST update the selected reward rail without losing filters, sort order, pagination, or scroll context.
- **FR-053**: When no row is selected and rows exist, Rewards MUST select the most recent visible reward by default; when filtering removes the selected row, Rewards MUST select the first visible row or show a contextual empty selected state.
- **FR-054**: The selected reward rail MUST show a reward summary card with token identity, reward type, owner category, token amount, claim-time value, coverage, and confidence.
- **FR-055**: The selected reward rail MUST include Ownership Trace, Pool Contribution, Claim Details, Coverage Notes, and Unresolved and Excluded Activity sections.
- **FR-056**: Ownership Trace MUST explain the owner category, linked entity, source surface, and evidence that supports or limits the ownership decision.
- **FR-057**: Pool Contribution MUST explain whether the reward contributes to a pool, which pool receives the contribution where known, and the counting rule that prevents double counting across layers.
- **FR-058**: Claim Details MUST show transaction hash, claim time, reward type, source contract or source surface, and external transaction path where available.
- **FR-059**: Coverage Notes MUST explain whether the selected reward is full, partial, unresolved, excluded, or unavailable and whether it is included in confident aggregates.
- **FR-060**: The Unresolved and Excluded Activity section MUST list the most relevant unresolved or excluded rows in the current filter context with token, time, amount, value when available, and reason, plus a path to view all matching rows.
- **FR-061**: The desktop first screen SHOULD follow the mockup's balance: KPI strip above filters, analysis panels and reward table on the left, selected reward rail on the right, with no landing-page hero or decorative marketing section.
- **FR-062**: On narrow screens, the selected reward rail MAY become a detail drill-in, drawer, or stacked section, but all selected reward evidence sections MUST remain reachable in no more than two interactions from a reward row.
- **FR-063**: The DataView MUST use localized technical labels for panel prefixes and section labels equivalent to Rewards Over Time, Source Breakdown, Pool Contribution Breakdown, Token Breakdown, Reward Events, Selected Reward, Ownership Trace, Pool Contribution, Claim Details, Coverage Notes, and Unresolved and Excluded Activity.
- **FR-064**: The DataView MUST preserve tabular numeric alignment for financial values, token amounts, percentages, timestamps, and hashes so dense reward data remains scannable.
- **FR-065**: The DataView MUST avoid presenting unresolved or excluded values as losses, realized returns, or user-earned rewards unless the evidence supports that interpretation.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone: dark layered surfaces, thin technical borders, compact instrumentation, restrained cyan and gold accents, readable high-contrast tables, tabular numerics, and no hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define localized content impact for rewards, charts, coverage, common navigation, and errors, and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for currency values, token amounts, percentages, dates, durations, transaction references, and estimated return labels.
- **CA-004 Chain Awareness**: Feature MUST define chainId handling across reward identity, owner identity, pool contribution, cross-surface links, source evidence, and user-facing filters.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership: wallet history and transfer evidence can identify candidates, historical pricing owns claim-time valuation, protocol event and contract evidence owns reward surface and owner resolution, and official protocol or strategy metadata owns known pool and strategy mappings.
- **CA-006 Explainability**: Feature MUST describe coverage/confidence behavior when ownership, valuation, pool mapping, governance association, or transaction decomposition is partial, unresolved, excluded, or unavailable.
- **CA-007 Testing Boundary**: Feature MUST define automated validation without Playwright, browser E2E, or automated browser/a11y suites. Auth-gated UI validation, when needed, MUST be manual and recorded as product/developer signoff evidence.

### Key Entities *(include if feature involves data)*

- **Reward Event**: A chain-scoped claim, fee, or reward component with token, token amount, claim-time valuation, source evidence, owner status, pool contribution status, coverage state, confidence, and transaction reference.
- **Reward Owner**: The entity that owns the reward for analysis purposes: manual deposit, strategy exposure, governance context, unresolved, excluded, or unavailable. Ownership must include linked entity identity and evidence where resolved.
- **Reward Source Surface**: The protocol surface that produced the reward, such as manual deposit gauge claim, pool fee claim, strategy wrapper reward claim, governance voter claim, unknown reward surface, ambiguous wrapper withdraw, or excluded airdrop.
- **Pool Contribution**: The link that determines whether a resolved reward contributes to a pool aggregate and how it appears in Pool detail without double counting. It includes contribution status, linked pool where known, and counting rule.
- **Selected Reward Evidence**: The right-rail detail state for the selected reward, containing summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved or excluded activity context.
- **Reward Distribution**: A grouped view of rewards by source, pool, strategy, token, reward type, governance activity, resolution status, or coverage state.
- **Reward Return**: A capital-adjusted reward performance metric for a selected time range, labeled full, estimated, partial, or unavailable based on capital and valuation coverage.
- **Coverage State**: The trust state for reward data: full, partial, unresolved, excluded, or unavailable, with a reason visible to users when totals are limited.
- **Confidence Indicator**: A user-facing signal that communicates evidence strength for ownership, valuation, and pool contribution, paired with readable text so color is not the only signal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of analyzed wallets with supported reward events can reach a Rewards DataView that shows at least one reward row without first navigating through Pools, Deposits, or Strategies.
- **SC-002**: In validation wallets containing manual deposit rewards and strategy rewards for the same pool, 0 strategy-owned rewards appear in manual deposit totals and 0 manual-deposit-owned rewards appear in strategy totals.
- **SC-003**: 100% of reward rows in the validation set display an owner status of manual deposit, strategy exposure, governance, unresolved, excluded, or unavailable.
- **SC-004**: For validation wallets, pool reward totals equal the sum of resolved manual deposit rewards plus resolved strategy rewards plus supported pool-mapped governance rewards, with no duplicate reward counted more than once.
- **SC-005**: 100% of rewards missing claim-time valuation remain visible by token amount and produce partial or unavailable USD summary coverage rather than fabricated USD values.
- **SC-006**: 95% of users in task testing can identify a reward's source category, owner, pool contribution, and coverage state from the DataView in under 20 seconds.
- **SC-007**: For wallets with rewards across at least three pools or sources, users can filter to a specific pool, source, token, or coverage state in no more than two interactions.
- **SC-008**: 100% of unresolved or excluded reward-shaped events in the validation set include a visible reason and do not contribute to confident reward totals.
- **SC-009**: 100% of reward return metrics are labeled full, estimated, partial, or unavailable according to capital and valuation coverage.
- **SC-010**: On desktop-sized viewports, the first Rewards screen shows all five KPI cards, active filters, rewards-over-time panel, source breakdown, pool contribution breakdown, token breakdown, selected reward rail, and at least five reward rows when available without requiring initial vertical scrolling.
- **SC-011**: On narrow viewports, users can move from summary metrics to a reward row's ownership and coverage details in no more than two interactions.
- **SC-012**: Manual product/developer signoff confirms that the Rewards DataView is consistent with The Cab control-tower brand, localization coverage, and cross-surface reconciliation behavior.
- **SC-013**: 95% of users in task testing can select a reward row and find its owner evidence, pool contribution rule, transaction reference, and coverage note in under 15 seconds.
- **SC-014**: 100% of filterable incoming links from Pool, Deposit, or Strategy surfaces display a removable active filter chip on Rewards.
- **SC-015**: 100% of unresolved or excluded values shown in KPI cards or side panels are visually and textually distinct from resolved rewards value.

## Assumptions

- The first release targets rewards already discoverable through the covered historical analysis window for the connected wallet and active chain.
- Rewards is an analyzed surface and remains unavailable until historical analysis is ready.
- Manual Deposits and automated Strategies are already distinct analytical concepts; Rewards must consume that distinction rather than redefining it.
- Governance rewards are included as a source category when supported by existing analysis evidence, but dedicated Governance detail remains a separate future surface.
- Rewards are valued at claim time when historical valuation exists; missing valuation degrades USD totals and reward-return metrics.
- Capital-adjusted return depends on historical invested capital coverage. If exact time weighting is unavailable, the metric is estimated, partial, or unavailable.
- Pool aggregation is a contribution lens, not an ownership fallback. Pool totals are built from resolved owner-scoped rewards and supported pool-mapped governance rewards.
- Excluded spam-like activity is not part of reward totals. It may appear only as audit context if the product exposes excluded evidence.
- The Rewards DataView may adapt exact layout to available data and design-system constraints while preserving the required summary, distribution, timeline, list, ownership, and coverage capabilities.
