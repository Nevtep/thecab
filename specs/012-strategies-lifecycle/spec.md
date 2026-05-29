# Feature Specification: Strategies Lifecycle

**Feature Branch**: `012-strategies-lifecycle`  
**Created**: 2026-05-29  
**Status**: Draft  
**Input**: User description: "Given the current app code status, and the full product spec, create the next most valuable feature spec."

## Feature Selection Context

The current product already has the connected Overview, historical Pools, manual Deposits, Settings, and the background analysis foundation needed to reconstruct Aerodrome and Mellow activity with explicit coverage states. The most valuable next feature is a first-class **Strategies** surface because Deposits now intentionally keeps automated Mellow exposure separate from manual Aerodrome positions and promises a cross-link that is not yet active. Strategies turns that separated exposure into an inspectable product area instead of leaving it as context inside Pools or Deposits.

This feature focuses on Mellow automated Aerodrome exposure first. It must answer what automated strategies the wallet used, which underlying Aerodrome pools they map to, how much capital and shares moved through them, which rewards were claimed, what current exposure remains, and how complete the accounting is.

## Clarifications

### Session 2026-05-29

- Q: How should the Strategies surface land the product and architecture requirements while using the mockup as guidance? → A: Build a dense DataView analysis panel: KPI strip, filterable strategy master list, selected-strategy lifecycle/detail panel, and prominent coverage note. The mockup is a visual and interaction guideline, not an exact data-layout contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Automated Strategy Exposure (Priority: P1)

As an analyzed user, I need a Strategies view that lists every Mellow automated strategy exposure found in my covered history so I can understand which automated products I used without confusing them with manual Aerodrome deposits.

**Why this priority**: The product explicitly separates manual Deposits from automated Strategies. Without a dedicated Strategies list, Mellow exposure remains visible only as secondary context, which weakens pool-level explainability and leaves the Deposits cross-link unresolved.

**Independent Test**: Can be fully tested by opening Strategies after historical analysis is ready for a wallet with at least one Mellow exposure and verifying that the first screen presents a dense DataView with a KPI strip, filterable exposure list, selected-strategy analysis panel, and every detected strategy exposure appears with identity, protocol, underlying pool, capital, shares, rewards, return, coverage, and status.

**Acceptance Scenarios**:

1. **Given** a wallet with completed historical analysis and at least one detected Mellow strategy exposure, **When** the user opens Strategies, **Then** the list shows each exposure with strategy label, protocol, underlying pool where known, status, capital deposited, capital withdrawn, current estimated value, share balance, rewards claimed, realized and unrealized result, estimated annualized return, coverage status, and confidence.
2. **Given** a wallet with manual Aerodrome deposits and Mellow strategy exposure in the same pool, **When** the user opens Strategies, **Then** the Mellow exposure appears as a strategy and the manual deposit does not appear as a strategy row.
3. **Given** a wallet with no detected Mellow strategy exposure but completed analysis, **When** the user opens Strategies, **Then** the feature shows an explicit empty state that distinguishes "no automated strategy exposure" from "analysis unavailable."
4. **Given** historical analysis has not completed successfully for the wallet and active chain, **When** the user attempts to open Strategies, **Then** the feature remains locked with the same operational gating pattern used by other analyzed surfaces.
5. **Given** multiple strategy exposures are available, **When** the user selects a row in the master list, **Then** the selected-strategy analysis panel updates without leaving the DataView and keeps the selected row visibly active.

---

### User Story 2 - Inspect One Strategy Lifecycle (Priority: P1)

As an analyzed user, I need to open a strategy detail view and see the lifecycle of my automated exposure from entry through shares, staking, rewards, withdrawal, and closure so I can understand what happened to that capital.

**Why this priority**: The main value of Strategies is lifecycle explainability. A list alone would show exposure but would not explain how capital moved, how shares changed, or why coverage is only share-level or partial.

**Independent Test**: Can be fully tested by opening a strategy exposure with at least one entry movement, one share movement, and one reward or withdrawal movement, and verifying that the selected-strategy DataView panel reconciles the header, exposure panel, rewards panel, lifecycle timeline, and coverage note.

**Acceptance Scenarios**:

1. **Given** a strategy exposure with analyzed history, **When** the user opens its detail view, **Then** the header shows strategy label, protocol, underlying pool where known, wrapper or staking references where relevant, status, current estimated value, share balance, total return, and coverage status.
2. **Given** the same strategy, **When** the user views the user exposure panel, **Then** the feature shows deposited value, withdrawn value, current estimated value, shares received, shares redeemed, current share balance, entry events, exit events, and the coverage status of share-level accounting.
3. **Given** the same strategy, **When** the user views the lifecycle timeline, **Then** the feature shows strategy deposit, share receive, stake, reward claim, unstake, withdrawal, share redeem, and close events in chronological order where those events are known, with timestamp, transaction reference, event type, token or share movements, value, confidence, and external transaction link.
4. **Given** the same strategy has rewards, **When** the user views the rewards panel, **Then** rewards are listed with token, amount, value at claim time, source category, associated pool where known, transaction reference, and coverage or unresolved status.
5. **Given** the selected strategy has share-level or partial coverage, **When** the user views the selected-strategy panel, **Then** a visually prominent coverage note explains what is counted, what is not counted, and which values may differ from real underlying sub-vault behavior.

---

### User Story 3 - Cross-Link Strategies With Pools And Deposits (Priority: P1)

As an analyzed user moving between Pools, Deposits, and Strategies, I need automated exposure to stay connected to the underlying pool while remaining separate from manual positions so I can compare total market exposure without mixing accounting models.

**Why this priority**: Pools already need automated exposure for aggregate market context, and Deposits already needs to point away from Mellow exposure instead of absorbing it. Cross-linking makes the product model visible and prevents double counting.

**Independent Test**: Can be fully tested with a wallet that has a manual deposit and a Mellow strategy in the same pool, verifying that Pool detail links to associated strategies, Deposit detail links to relevant strategy exposure when present, and Strategy detail links back to the underlying pool without merging manual and automated lifecycle events.

**Acceptance Scenarios**:

1. **Given** a pool with associated Mellow strategy exposure, **When** the user opens Pool detail, **Then** the feature provides a path to the related Strategies view or strategy detail while labeling the exposure as automated.
2. **Given** a manual deposit whose pool also has Mellow exposure, **When** the user opens Deposit detail, **Then** the strategy cross-link is active and clearly labeled as automated strategy exposure rather than part of the manual deposit lifecycle.
3. **Given** a strategy mapped to an underlying Aerodrome pool, **When** the user opens Strategy detail, **Then** the feature links back to that pool and explains whether the mapping is confirmed, inferred, or unavailable.
4. **Given** strategy rewards from a pool that also has manual deposits, **When** the user compares Pools, Deposits, and Strategies totals, **Then** resolved strategy rewards contribute to pool-level automated aggregates and do not inflate manual deposit reward totals.

---

### User Story 4 - Understand Coverage Limits Honestly (Priority: P2)

As an analyzed user, I need Strategies to be explicit when accounting is full, share-level, partial, or unknown so I can trust the numbers without assuming The Cab can see inside every automated strategy.

**Why this priority**: Mellow strategy internals can be less observable than wallet-level share movements. The feature must be valuable at share level while avoiding fabricated internal rebalances, share prices, or fee dilution.

**Independent Test**: Can be fully tested by viewing strategies across coverage states and verifying that full, share-level, partial, and unknown coverage each produce distinct user-facing explanations, metric behavior, confidence labels, and coverage-note styling in the DataView.

**Acceptance Scenarios**:

1. **Given** a strategy where user deposits, withdrawals, shares, and rewards are reliable but internal strategy operations are incomplete, **When** the user views the strategy, **Then** coverage is labeled `share_level` and internal activity is omitted or marked unavailable rather than invented.
2. **Given** a strategy with missing prices, missing share valuation, incomplete mapping, or unresolved rewards, **When** the user views list or detail metrics, **Then** affected values are marked partial or unavailable with reasoned coverage messaging.
3. **Given** a strategy detected from weak evidence only, **When** the user opens its row or detail, **Then** the feature presents `unknown` coverage and avoids return, share, or reward claims that cannot be supported.
4. **Given** internal strategy activity is confidently detectable, **When** it appears in Strategy detail, **Then** it is labeled as internal strategy activity and never as a manual deposit rebalance.
5. **Given** the feature shows high-level KPIs, **When** coverage is share-level, partial, or unknown, **Then** the KPI strip avoids implying pool-level precision and reflects unavailable or partial metrics consistently with the selected-strategy coverage note.

---

### User Story 5 - Filter And Compare Strategies Efficiently (Priority: P3)

As an analyzed user with several automated exposures, I need filters and stable sorting so I can quickly find active, closed, high-value, low-confidence, or pool-specific strategies.

**Why this priority**: This is not required for a minimal trustworthy Strategies surface, but it improves usability for active wallets and makes cross-links from Pools and Deposits more useful.

**Independent Test**: Can be fully tested with a wallet that has several strategy exposures across statuses, pools, returns, and coverage states, verifying that filters compose and that navigation preserves the selected view.

**Acceptance Scenarios**:

1. **Given** a wallet with multiple strategy exposures, **When** the user filters by active, closed, underlying pool, positive or negative return, and coverage status, **Then** the list reflects all active filters and shows clearable filter indicators.
2. **Given** the user arrives from a Pool detail or Deposit detail link, **When** Strategies opens, **Then** the list is pre-filtered to the relevant pool or strategy and the active filter is visible and clearable.
3. **Given** the user sorts by current value, opened date, return, or coverage, **When** they open a detail view and return, **Then** the selected filters and sort order remain intact for the session.

### Edge Cases

- A wallet has Mellow share movements but the underlying Aerodrome pool cannot be mapped; the strategy remains visible with unknown pool mapping and degraded coverage.
- A strategy maps to a pool that also has manual deposits; the feature must keep manual and automated lifecycle events separate while allowing pool-level comparison.
- A share balance exists but no reliable share price or underlying valuation is available; share amount remains visible while value and return metrics are partial or unavailable.
- A reward claim is proven to belong to a strategy but cannot be tied to a specific external dashboard reference; the reward remains strategy-owned with an explanation of the missing external reference.
- A reward-shaped transaction touches a known strategy contract but cannot be proven as user-owned; it must not be counted as a strategy reward.
- A strategy withdrawal returns underlying tokens that later move through the wallet; residual or subsequent activity must not be retroactively turned into a manual deposit unless a separate manual deposit is proven.
- A strategy has internal operator or vault activity that does not directly affect the user's wallet; it appears only when confidently tied to the known strategy and never as user manual activity.
- A strategy exposure is active at the end of the covered window; the feature must show it as active within coverage rather than closed or unknown merely because no later event was observed.
- A strategy's first known event is a transfer-in or share receipt rather than a deposit; the exposure remains visible with degraded confidence and an explicit baseline limitation.
- Multiple strategy wrappers share the same underlying token pair; strategy identity must remain wrapper- or strategy-specific, not just pool-specific.
- The DataView has no selected strategy after filtering removes the previous selection; the feature must choose the highest-ranked visible exposure or show a contextual empty detail state without clearing the user's filters.
- A narrow viewport cannot fit the master list and selected-strategy panel side by side; the feature must preserve the same information architecture as a stacked or drill-in DataView without hiding lifecycle, rewards, or coverage notes.
- A KPI aggregate includes values from strategies with mixed coverage states; the KPI must either label the aggregate as partial or split unavailable portions rather than presenting a false fully covered total.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Strategies feature MUST remain locked until the connected wallet has a successful historical analysis run for the active chain.
- **FR-002**: The Strategies list MUST include every detected automated Mellow strategy exposure within the covered history window for the connected wallet and active chain.
- **FR-003**: The Strategies list MUST NOT include manual Aerodrome deposits unless the wallet's exposure is also independently proven as automated strategy exposure.
- **FR-004**: Each strategy row MUST show, at minimum, strategy label, protocol, underlying pool where known, status, capital deposited, capital withdrawn, current estimated value, share balance, rewards claimed, realized result, unrealized result, estimated annualized return, coverage status, and confidence.
- **FR-005**: Strategy identity MUST be stable and chain-aware, based on strategy metadata and wrapper, staking, vault, or share references where available; pool-only identity MUST NOT be sufficient to merge strategy exposures.
- **FR-006**: Strategy exposure identity MUST be wallet-specific and chain-aware, and MUST distinguish separate exposures when the same wallet interacts with multiple wrappers or strategy instances for the same underlying pool.
- **FR-007**: The feature MUST support list filters for active status, closed status, protocol, underlying pool, positive or negative return, coverage status, and share-level or partial coverage.
- **FR-008**: The list MUST support stable sorting by at least current value, opened date, total return, and coverage status, with a deterministic default sort.
- **FR-009**: The feature MUST provide an explicit empty state for wallets with no detected automated strategy exposure and a distinct locked state for wallets without completed analysis.
- **FR-010**: Strategy detail MUST show a header with strategy label, protocol, underlying pool where known, relevant contract or strategy references, status, current value, share balance, total return, coverage status, and confidence.
- **FR-011**: Strategy detail MUST show a user exposure section containing deposited value, withdrawn value, current estimated value, shares received, shares redeemed, current share balance, entry events, exit events, and share-level coverage state.
- **FR-012**: Strategy detail MUST show a chronological lifecycle timeline for known strategy deposit, share receive, stake, reward claim, unstake, withdrawal, share redeem, close, and confidently detected internal strategy events.
- **FR-013**: Each lifecycle timeline event MUST expose timestamp, transaction reference, event type, token or share movements, value when available, confidence, coverage impact, and external transaction link.
- **FR-014**: Strategy detail MUST show a rewards panel for rewards resolved to the strategy or its exposure, including token, amount, value at claim time, source category, associated pool where known, transaction reference, and coverage or unresolved status.
- **FR-015**: Strategy rewards MUST remain separated from manual deposit rewards and MUST NOT increase manual deposit reward totals.
- **FR-016**: Resolved strategy rewards MAY contribute to pool-level automated aggregates when the underlying pool is known.
- **FR-017**: Strategy detail MUST show the relationship to the underlying Aerodrome pool where known, including whether the mapping is confirmed, inferred, or unavailable.
- **FR-018**: Pool and Deposit surfaces MUST provide active cross-links to relevant strategy exposure where the relationship is known, while labeling that exposure as automated.
- **FR-019**: Strategies MUST preserve incoming pool- or strategy-scoped navigation context so a user arriving from Pools or Deposits lands on the relevant filtered view or detail.
- **FR-020**: The feature MUST use the coverage states `full`, `share_level`, `partial`, and `unknown` consistently across list, detail, rewards, timeline, and cross-linked surfaces.
- **FR-021**: The feature MUST default to `share_level` coverage when user deposits, withdrawals, shares, and rewards are reliable but underlying internal strategy operations are not fully reconstructed.
- **FR-022**: The feature MUST mark metrics partial or unavailable when prices, share valuation, pool mapping, reward ownership, or internal activity evidence is missing.
- **FR-023**: Internal strategy rebalances, fee dilution, vault movement, or operator activity MUST appear only when confidently tied to a known strategy and MUST NOT be labeled as manual user rebalances.
- **FR-024**: A strategy exposure detected from weak or incomplete evidence MUST remain visible with degraded confidence rather than being hidden or over-resolved.
- **FR-025**: First-known share receipts or transfer-in style strategy baselines MUST be included with explicit baseline limitations and degraded confidence.
- **FR-026**: Strategy metrics MUST reconcile within the feature: list values, detail header values, exposure panel values, reward totals, lifecycle values, and pool cross-link aggregates must describe the same economic state or explain any partial/unavailable portions.
- **FR-027**: The feature MUST provide localized labels and explanations for strategy statuses, lifecycle events, filters, sort options, metric labels, coverage states, and empty or locked states.
- **FR-028**: The Strategies first screen MUST be a DataView analysis panel rather than a marketing page or loose collection of cards. It MUST combine a KPI strip, filter/search controls, a strategy master list, and a selected-strategy analysis panel in one cohesive workspace.
- **FR-029**: The KPI strip MUST summarize strategy-level value, active strategy count, claimed strategy rewards, total strategy return, and protocol coverage or equivalent coverage health. Each KPI MUST clearly show whether its value is full, share-level, partial, or unavailable.
- **FR-030**: The strategy master list MUST support row selection and MUST keep the selected exposure visually distinct while updating the selected-strategy analysis panel without forcing a full page transition.
- **FR-031**: The selected-strategy analysis panel MUST include, at minimum, a header summary, exposure summary, rewards summary, lifecycle timeline, and coverage note for the selected strategy.
- **FR-032**: The DataView MUST use the mockup as a look-and-feel guideline: dense operational layout, dark control-tower surfaces, technical dividers, compact metrics, token-pair identity, status badges, confidence indicators, subtle trend cues, and restrained cyan/gold/semantic accents. Exact column order, values, and pixel layout are not fixed by the mockup.
- **FR-033**: The DataView MUST remain usable on narrow screens by preserving the same master-detail information architecture through stacking, progressive disclosure, or drill-in behavior while keeping lifecycle, rewards, and coverage information reachable.
- **FR-034**: The coverage note MUST be visually prominent whenever coverage is not full and MUST state whether values are share-level, partial, unknown, or unavailable, including whether pool-level PnL, rewards, or internal activity are excluded.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define i18n namespace impact and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for currency values, token amounts, share amounts, percentages, dates, and transaction references where applicable.
- **CA-004 Chain Awareness**: Feature MUST define chainId handling across strategy identity, strategy exposure identity, pool relationships, reward ownership, API contracts, and query keys.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership: Moralis can provide candidate wallet history and token-transfer evidence, Alchemy Prices owns historical USD valuation, RPC/log/contract reads own wrapper, staking, share, and current balance evidence, and official Mellow metadata owns preferred strategy-to-pool mapping when available.
- **CA-006 Explainability**: Feature MUST describe coverage/confidence behavior when strategy reconstruction is share-level, partial, unknown, or internally incomplete.

### Key Entities *(include if feature involves data)*

- **Strategy**: A chain-scoped automated product, initially Mellow, identified by label, protocol, wrapper or vault references, staking references, and its underlying Aerodrome pool relationship where known.
- **Strategy Exposure**: A wallet-specific relationship to a strategy, tracking share balance, deposits, withdrawals, entry and exit events, and coverage for the active chain.
- **Strategy Lifecycle Event**: A chronological event such as strategy deposit, share receive, stake, reward claim, unstake, withdrawal, share redeem, close, or internal strategy activity, with value and confidence when available.
- **Strategy Reward**: A reward claim resolved to a strategy or strategy exposure, valued at claim time and kept separate from manual deposit rewards.
- **Underlying Pool Link**: The relationship between a strategy and an Aerodrome pool, including mapping confidence and whether the strategy contributes to pool-level automated exposure.
- **Coverage State**: The feature's trust state for strategy accounting: full, share-level, partial, or unknown, with reason codes or explanations where the user-facing result is limited.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of analyzed wallets with detected Mellow strategy exposure can reach a Strategies list that shows at least one strategy row without requiring navigation through Deposits or Pools first.
- **SC-002**: In validation wallets containing both manual deposits and Mellow strategies in the same pool, 0 strategy exposures appear as manual deposit rows and 0 manual deposits appear as strategy rows.
- **SC-003**: For every strategy detail in the validation set, the header, exposure panel, rewards panel, and lifecycle timeline reconcile to the same total current value and reward total, or show an explicit partial/unavailable explanation.
- **SC-004**: 100% of strategy rewards shown in Strategies are labeled as strategy-owned, unresolved, or unavailable; none are silently counted as manual deposit rewards.
- **SC-005**: 95% of users in task testing can find a strategy from a related Pool or Deposit and return to the original context in under 30 seconds.
- **SC-006**: 100% of share-level strategies display a visible share-level coverage explanation before any internal strategy activity is shown.
- **SC-007**: 90% of users in task testing correctly identify whether a strategy's underlying pool mapping is confirmed, inferred, or unavailable after viewing the detail page.
- **SC-008**: For wallets with more than five strategy exposures, users can filter to a specific pool, active status, or coverage state in no more than two interactions.
- **SC-009**: 95% of users in task testing can identify the selected strategy, its coverage state, and its latest lifecycle event from the DataView in under 20 seconds.
- **SC-010**: On desktop-sized viewports, the first Strategies screen shows the KPI strip, at least five strategy rows when available, and the selected-strategy panel without requiring initial vertical scrolling.
- **SC-011**: On narrow viewports, users can move from the strategy list to selected-strategy lifecycle and coverage details in no more than two interactions.
- **SC-012**: 100% of non-full coverage strategies display a coverage note in the selected-strategy panel before or alongside detailed lifecycle interpretation.

## Assumptions

- The first release targets Mellow automated Aerodrome strategies on the supported active chain.
- The feature is available only for connected wallets with completed historical analysis.
- Share-level accounting is acceptable as the default useful level when user-level shares, deposits, withdrawals, and rewards are known but internal strategy operations are incomplete.
- Full internal strategy accounting is shown only when evidence is strong enough; otherwise the feature uses share-level, partial, or unknown coverage.
- Existing Pools and Deposits concepts remain authoritative: manual deposits stay in Deposits, automated strategies stay in Strategies, and pool pages can summarize both without merging their lifecycle models.
- Rewards are valued at claim time when historical valuation is available; missing valuation degrades coverage rather than falling back to a misleading current value.
- Strategy names and pool mappings prefer official strategy metadata when available, then verified on-chain evidence, then explicit inferred mapping with degraded confidence.
- Rewards, Governance, and full Activity remain separate future surfaces; this feature exposes only the strategy-specific reward and lifecycle slices required to make Strategies useful.
- The provided Strategy DataView mockup is directional for visual density, hierarchy, and interaction model; implementation may adapt exact layout, ordering, and labels to available data and design-system constraints.
