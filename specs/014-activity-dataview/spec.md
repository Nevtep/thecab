# Feature Specification: Activity DataView

**Feature Branch**: `014-activity-dataview`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Create the next product feature spec from the product docs and latest product status"

## Feature Selection Context

The latest product status report identifies Activity as the next highest-value product feature. Rewards, Pools, Deposits, and Strategies now expose enough historical surfaces to reveal classification and attribution issues, but users still lack a single transaction-level audit trail that explains how wallet transactions become product metrics.

Activity must become the canonical interpreted ledger for Aerodrome and Mellow wallet behavior. It should let a user inspect every supported transaction, understand the normalized action labels, see token and USD movement evidence, trace links to Pools, Deposits, Strategies, Rewards, and future Governance, and understand why ambiguous, unsupported, partial, or malicious activity did not become confident analytics.

This feature is explicitly not a transaction execution surface. It is an analytics and explainability surface.

### Scope Update - Engine Evidence Enrichment

Chain explorer indexed evidence is now available to the analysis flow when existing provider data is incomplete. Within this Activity spec, that expands the feature from "show the interpreted ledger" to "improve the evidence pipeline that feeds the interpreted ledger."

Explorer-indexed transaction evidence may be used as supplemental evidence for transaction receipts, logs, internal transfers, contract interactions, and verification of suspicious or unsupported activity. It must not override explicit protocol semantics, invent missing ownership, or convert spam/airdrops into rewards. If explorer evidence still cannot prove classification, ownership, valuation, or entity linkage, Activity must preserve the row as partial, unresolved, unsupported, malicious, ambiguous, discarded, or unavailable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review The Interpreted Activity Ledger (Priority: P1)

As an analyzed user, I need a chronological Activity view that lists every supported Aerodrome and Mellow action found in my historical analysis so I can see the transaction-level source of the dashboard.

**Why this priority**: The product spec defines Activity as the audit trail behind every major metric. Without this ledger, users must trust aggregates without being able to inspect the underlying transactions.

**Independent Test**: Can be fully tested by opening Activity after historical analysis is ready for a wallet with supported Aerodrome or Mellow transactions and verifying that the first screen shows a dense ledger with timestamp, action label, transaction reference, protocol surface, linked entities, token movements, value, coverage, and confidence.

**Acceptance Scenarios**:

1. **Given** a wallet with completed historical analysis and supported Aerodrome or Mellow transactions, **When** the user opens Activity, **Then** the user sees a chronological ledger for the active wallet and chain.
2. **Given** an activity row represents a deposit, claim, swap, vote, strategy action, or unsupported event, **When** the row appears, **Then** it shows an interpreted label, source surface, transaction reference, linked product entities where available, coverage state, and confidence.
3. **Given** historical analysis is not ready, **When** the user opens Activity, **Then** Activity remains locked or shows only an explicitly limited recent-mode preview if the product enables that mode.
4. **Given** analysis found no supported Aerodrome or Mellow activity, **When** the user opens Activity, **Then** the feature shows a clear empty state that distinguishes "no supported activity found" from "analysis unavailable."

---

### User Story 2 - Trace Metrics Back To Transactions (Priority: P1)

As an analyzed user, I need activity rows to link back to Pools, Deposits, Strategies, Rewards, and Governance context so I can verify how a metric was produced without guessing.

**Why this priority**: The Cab's trust model depends on traceability. Every major metric should be explainable through transactions, ledger events, asset movements, pricing, and attribution decisions.

**Independent Test**: Can be fully tested by selecting activity rows that contributed to Pool, Deposit, Strategy, and Reward metrics and verifying that each row shows the related entities and why it does or does not affect each aggregate.

**Acceptance Scenarios**:

1. **Given** a row contributed to a Pool metric, **When** the user inspects the row, **Then** the row links to the relevant Pool where the evidence supports that relationship.
2. **Given** a row opened, increased, reduced, or closed a manual position, **When** the user inspects the row, **Then** the row links to the relevant Deposit or position identity where available.
3. **Given** a row belongs to a Mellow strategy exposure, **When** the user inspects the row, **Then** it links to the Strategy and StrategyExposure where evidence supports the relationship.
4. **Given** a row produced or explains a reward, **When** the user inspects the row, **Then** it links to the Reward context without double counting reward value.
5. **Given** a row is ambiguous or unsupported, **When** the user inspects the row, **Then** the feature explains what evidence is missing instead of linking it to the nearest pool or position.

---

### User Story 3 - Inspect Transaction Detail Evidence (Priority: P1)

As an analyzed user, I need to select an activity item and see the evidence behind its classification so I can audit important or suspicious transactions.

**Why this priority**: Activity is only useful if the ledger rows are explainable. The detail surface must show why a transaction was classified and what evidence was used.

**Independent Test**: Can be fully tested by selecting a row and verifying that the detail view shows transaction hash, block/time, action classification, contract interactions, asset movements, linked entities, pricing evidence, confidence, coverage, and raw provider evidence reference where available.

**Acceptance Scenarios**:

1. **Given** an activity row is selected, **When** the detail view opens, **Then** it shows the transaction reference, timestamp, interpreted action, protocol surface, linked entities, token movements, value, coverage, and confidence.
2. **Given** pricing evidence exists, **When** the user inspects detail, **Then** the user can see which values were priced and which values are unpriced or partial.
3. **Given** raw provider evidence exists, **When** the user inspects detail, **Then** the user can identify that the row is traceable to source evidence without exposing distracting raw data by default.
4. **Given** a row is malicious, spam, unsupported, ambiguous, or discarded, **When** the user inspects detail, **Then** the detail explains the classification reason and confirms whether the row affects product totals.

---

### User Story 4 - Understand Rebalances And Residual Attribution (Priority: P1)

As an analyzed user, I need rebalance and swap-related activity to explain how token flows were attributed so I can understand pool performance without hidden over-attribution.

**Why this priority**: The product spec requires residual attribution and partial swap attribution to be visible. Activity is the best place to explain these decisions transaction by transaction.

**Independent Test**: Can be fully tested with a wallet containing decrease/swap/increase flows and verifying that Activity links the related events, shows residual attribution state, and indicates whether the event is a full-pool rebalance or partial swap attribution.

**Acceptance Scenarios**:

1. **Given** an event is classified as a rebalance, **When** the user opens its detail, **Then** Activity shows related withdraw/decrease, swap, residual attribution, and deposit/increase events where known.
2. **Given** a swap consumed more token amount than one pool residual can support, **When** the user inspects the row, **Then** Activity shows the source allocation breakdown and identifies partial swap attribution.
3. **Given** token flow cannot be confidently attributed to a pool or residual source, **When** the row appears, **Then** Activity marks it partial, unresolved, or unavailable instead of forcing full attribution.
4. **Given** a rebalance affects Pool analytics, **When** the user compares Activity and Pool detail, **Then** the pool attribution effect is consistent and explainable.

---

### User Story 5 - Filter And Investigate Activity (Priority: P2)

As an analyzed user, I need to filter Activity by action type, protocol surface, pool, strategy, deposit, token, date range, coverage, confidence, and resolution status so I can investigate a specific issue quickly.

**Why this priority**: Activity can become large. Filtering makes it practical as both a product surface and a debug surface for engine quality.

**Independent Test**: Can be fully tested with a wallet containing multiple activity categories and verifying that filters compose, active filters are visible, result counts update, and empty states remain stable.

**Acceptance Scenarios**:

1. **Given** the wallet has multiple action types, **When** the user filters by action type, **Then** the ledger, summaries, and active filter chips reflect the selection.
2. **Given** the wallet has activity across pools, strategies, deposits, rewards, and tokens, **When** the user filters by entity or token, **Then** only matching rows remain and the active context is visible.
3. **Given** filters match no rows, **When** the user views Activity, **Then** the ledger area shows a contextual empty state without breaking the surrounding layout.
4. **Given** the user clears filters, **When** the view updates, **Then** the full analyzed activity set returns without losing the analysis-ready state.

---

### User Story 6 - Surface Unsupported, Ambiguous, And Malicious Activity (Priority: P2)

As an analyzed user, I need raw, unsupported, ambiguous, malicious, or spam-like activity to be visible when relevant so I can understand what was excluded from confident analytics.

**Why this priority**: The Cab must prefer visible uncertainty over fabricated classifications. Activity is the place where excluded and unresolved rows can be shown honestly without polluting metrics.

**Independent Test**: Can be fully tested with sample transactions that include unsupported transfers, ambiguous protocol activity, and malicious or spam-like inflows, verifying that each row is labeled correctly and excluded from confident totals.

**Acceptance Scenarios**:

1. **Given** a transaction touches the wallet but lacks protocol-surface evidence, **When** it appears in Activity, **Then** it is marked unsupported, ambiguous, or discarded with a reason.
2. **Given** a spam-like airdrop enters the wallet, **When** Activity shows it, **Then** it is labeled malicious or spam-like and does not become a reward, cash-in, or earned value.
3. **Given** an ambiguous event might be related to a strategy or deposit but lacks identity evidence, **When** Activity shows it, **Then** it remains ambiguous instead of being assigned by pool and time proximity.
4. **Given** excluded activity appears near relevant resolved activity, **When** the user inspects the detail, **Then** Activity explains why it was excluded and whether it affects any aggregate.

---

### User Story 7 - Improve Classification With Supplemental Explorer Evidence (Priority: P1)

As an analyzed user, I need the engine to consult supplemental chain explorer evidence when primary decoded history is incomplete so Activity rows are classified as accurately as possible without fabricating links.

**Why this priority**: The latest product status identified engine classification as the main product risk. Activity should not merely expose poor classification; it should drive better classification when additional trustworthy transaction evidence is available.

**Independent Test**: Can be fully tested with transactions where initial provider decoding is incomplete but explorer-indexed evidence contains additional logs, internal transfers, or contract interaction context, verifying that resolved rows improve only when evidence supports them and unresolved rows remain honest when evidence is still insufficient.

**Acceptance Scenarios**:

1. **Given** decoded wallet history lacks enough information to classify a transaction, **When** supplemental explorer evidence provides relevant receipts, logs, internal transfers, or contract interactions, **Then** the engine can improve the activity classification and record which evidence made the improvement possible.
2. **Given** supplemental explorer evidence confirms that a transaction is spam-like or malicious, **When** Activity displays the row, **Then** it is marked malicious or excluded and does not contribute to earned value, rewards, cash-in, or portfolio return.
3. **Given** supplemental explorer evidence is unavailable, incomplete, rate-limited, or contradictory, **When** the engine classifies the transaction, **Then** Activity preserves the row as partial, unresolved, unsupported, malicious, ambiguous, discarded, or unavailable with a visible reason.
4. **Given** supplemental explorer evidence helps identify protocol surfaces but not explicit deposit, strategy, reward, or governance ownership, **When** Activity displays the row, **Then** it can improve the protocol/action label while leaving entity ownership unresolved.

### Edge Cases

- A single transaction produces multiple interpreted events; Activity shows each economic component without collapsing them into one misleading row.
- A transaction includes both principal movement and reward claim; Activity distinguishes principal, reward, and lifecycle components.
- A strategy internal rebalance is detected; Activity classifies it as strategy-level activity only when it can be tied to known strategy contracts with sufficient confidence.
- A Mellow internal event cannot be tied to a known strategy exposure; Activity marks it ambiguous or unsupported rather than treating it as a manual user rebalance.
- A token movement lacks historical pricing; Activity shows token amount and partial or unavailable USD coverage.
- A transaction touches multiple pools or residual sources; Activity shows source allocation where evidence supports it and marks remaining attribution partial.
- Activity rows exist before full historical analysis only if the product exposes a limited recent mode; that mode must be visibly scoped and not presented as complete history.
- A row links to future Governance context before Governance is fully implemented; Activity may show governance classification and transaction evidence while governance-specific analytics remain limited.
- A wallet changes active chain; Activity rows, filters, links, transaction references, and entity identities remain scoped to the selected chain.
- A narrow viewport cannot fit the full ledger and detail side by side; the same row detail and evidence remain reachable without losing filter context.
- Supplemental explorer evidence is available for a transaction but conflicts with decoded history; Activity preserves the conflict as a coverage or confidence limitation unless protocol semantics resolve it.
- Supplemental explorer evidence identifies contract calls but not economic ownership; Activity improves classification labels but keeps ownership unresolved.
- Supplemental explorer evidence is unavailable due to provider limits; Activity does not block the whole analysis and marks affected rows with an evidence-gap reason.
- A known phishing airdrop has transfer data and apparent token value; Activity labels it malicious/spam-like and keeps it out of rewards and earned value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Activity MUST remain locked until historical analysis is ready, unless a clearly labeled limited recent mode is available.
- **FR-002**: Activity MUST show a chronological interpreted ledger of supported Aerodrome and Mellow wallet activity for the connected wallet and active chain.
- **FR-003**: Activity MUST include rows for supported, unsupported, ambiguous, malicious, spam-like, discarded, partial, and unresolved activity when those rows are relevant to auditability.
- **FR-004**: Each activity row MUST show timestamp, transaction reference, interpreted action type, protocol surface, linked pool where known, linked deposit or position where known, linked strategy where known, linked reward or governance context where known, token movements, value when available, coverage state, and confidence.
- **FR-005**: Activity MUST support action classifications for cash in, cash out, deposit, mint position, increase liquidity, decrease liquidity, stake, unstake, withdraw, claim, swap, rebalance, lock AERO, vote, claim voting fees, Mellow deposit, strategy deposit, strategy withdraw, strategy stake, strategy unstake, strategy claim, strategy share mint, strategy share burn, strategy internal rebalance, strategy fee/share dilution, unsupported, malicious/spam, ambiguous, and discarded.
- **FR-006**: Activity MUST distinguish Mellow strategy activity from manual deposit activity and MUST NOT classify strategy internal activity as manual deposit or manual rebalance activity.
- **FR-007**: Strategy activity MUST link to Strategy and StrategyExposure only when evidence supports that identity.
- **FR-008**: Manual deposit activity MUST link to Deposit or position identity only when evidence supports that identity.
- **FR-009**: Activity MUST NOT assign activity to deposits, strategies, pools, rewards, or governance by pool address plus time window when explicit identity evidence is required.
- **FR-010**: Activity MUST show unsupported, malicious, spam-like, ambiguous, and discarded rows as excluded from confident product totals unless a specific product metric states otherwise.
- **FR-011**: Activity MUST provide a selected-row detail surface with transaction hash, block or transaction time, interpreted classification, contract interactions or source surfaces, asset movements, price points used where available, linked entities, classification reason, coverage, confidence, and source evidence reference where available.
- **FR-012**: Activity MUST explain non-full coverage with visible reasons for partial, unresolved, excluded, unsupported, malicious, ambiguous, discarded, or unavailable rows.
- **FR-013**: Activity MUST show token movement direction, token symbol or identity, token amount, and USD value when available for each meaningful movement.
- **FR-014**: Activity MUST degrade gracefully when price coverage is missing by keeping token amounts visible and marking USD value as partial or unavailable.
- **FR-015**: Activity MUST link resolved rows to Pool, Deposit, Strategy, Reward, and Governance context where those relationships are known and supported by evidence.
- **FR-016**: Activity MUST allow users to open external transaction evidence for a row through the active chain's explorer path.
- **FR-017**: Activity MUST support filters for action type, protocol surface, pool, deposit or position, strategy, reward context, governance context, token, date range, coverage state, confidence band, and resolution status.
- **FR-018**: Activity MUST support search across transaction reference, token, pool, linked entity, protocol surface, and interpreted label.
- **FR-019**: Activity MUST show active filters as visible, removable chips and MUST provide a clear-all behavior.
- **FR-020**: Activity MUST preserve selected row, filters, sorting, pagination, and scroll context during client-side interactions.
- **FR-021**: Activity MUST support stable sorting by time, value, action type, protocol surface, coverage state, confidence, and linked entity where available.
- **FR-022**: Activity MUST support incremental browsing of larger histories with visible result range and page-size control.
- **FR-023**: Activity MUST provide summary instrumentation for total interpreted activity, supported activity, unresolved or partial activity, excluded or malicious activity, and valuation coverage.
- **FR-024**: Activity MUST provide contextual empty states for no analyzed activity and for filters that match no activity.
- **FR-025**: Activity MUST show rebalance explainability for rows classified as rebalance or partial swap attribution.
- **FR-026**: Rebalance detail MUST show related withdraw/decrease events, residual attribution state, related swaps, related deposit/increase events where applicable, token flow, pool attribution effect, confidence, and source allocation breakdown where available.
- **FR-027**: Source allocation breakdown MUST distinguish amount attributed to candidate pool residual, amount attributed to cash-ins, amount attributed to liquidation-derived inventory, amount attributed pro rata to other residual pools, and any unsupported remainder when those categories are present.
- **FR-028**: Activity MUST indicate whether a rebalance is a full-pool rebalance, partial swap attribution, or unresolved attribution.
- **FR-029**: Activity MUST make every major metric from Overview, Pools, Deposits, Strategies, Rewards, and future Governance traceable to one or more activity rows or explicitly state when traceability is unavailable.
- **FR-030**: Activity MUST keep transaction execution, trading, claiming, staking, unstaking, voting, or approval actions out of scope.
- **FR-031**: Activity MUST present a dense analysis workspace with compact summary metrics, filters, ledger table, and selected detail, not a landing page or marketing surface.
- **FR-032**: Activity MUST remain usable on narrow screens by preserving summary, filters, ledger, selection, evidence, and coverage context through stacking or drill-in behavior.
- **FR-033**: Activity MUST provide localized labels and explanations for action types, protocol surfaces, filters, sort options, coverage states, confidence labels, exclusion reasons, empty states, and detail sections.
- **FR-034**: Activity MUST preserve tabular numeric alignment for values, token amounts, timestamps, and transaction references so dense event data remains scannable.
- **FR-035**: Activity MUST visually and textually distinguish resolved, partial, unresolved, unsupported, malicious, ambiguous, and discarded activity without relying on color alone.
- **FR-036**: Activity classification MUST use supplemental chain explorer indexed evidence when primary decoded wallet history is missing information needed to classify a transaction, decompose events, or identify protocol surfaces.
- **FR-037**: Supplemental explorer evidence MAY improve action classification, protocol surface detection, event decomposition, internal transfer visibility, suspicious-activity detection, and source evidence references.
- **FR-038**: Supplemental explorer evidence MUST NOT be used to infer deposit, strategy, reward, governance, or pool ownership unless the evidence contains the explicit identity or protocol semantics required by the product spec.
- **FR-039**: When supplemental explorer evidence improves classification, Activity MUST preserve a user-facing evidence note indicating that additional transaction evidence supported the interpretation.
- **FR-040**: When supplemental explorer evidence is missing, incomplete, rate-limited, contradictory, or insufficient, Activity MUST preserve visible uncertainty rather than inventing classifications, values, ownership, or links.
- **FR-041**: Activity MUST classify known spam-like or phishing airdrops as malicious or excluded when evidence supports that classification, even when the token transfer resembles a reward-shaped inflow.
- **FR-042**: Engine hardening for Activity MUST include deterministic regression cases for good, ambiguous, unsupported, and malicious transactions, including the known phishing airdrop transaction previously identified in Rewards work.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone: dark layered surfaces, thin technical borders, compact instrumentation, readable dense tables, tabular numerics, restrained cyan/gold/semantic accents, and no hype/casino/meme product language.
- **CA-002 Localization**: Feature MUST define localized content impact for Activity, coverage, confidence, common navigation, filters, action labels, empty states, and errors, and prohibit hardcoded user-facing copy.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for currency values, token amounts, percentages, dates, durations, transaction references, confidence labels, and coverage summaries.
- **CA-004 Chain Awareness**: Feature MUST define chainId handling across activity identity, transaction references, linked entities, source evidence, filters, external explorer paths, and cross-surface navigation.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership: wallet history and decoded activity identify candidate transactions; supplemental chain explorer indexed evidence can fill transaction receipt, log, internal transfer, and contract interaction gaps; historical pricing owns valuation; protocol event, contract, and known strategy/governance metadata own classification and entity links; raw provider records provide audit references.
- **CA-006 Explainability**: Feature MUST describe coverage/confidence behavior when classification, valuation, entity links, residual attribution, source allocation, or transaction decomposition is partial, ambiguous, malicious, unsupported, discarded, or unavailable.
- **CA-007 Testing Boundary**: Feature MUST define automated validation without Playwright, browser E2E, or automated browser/a11y suites. Auth-gated UI validation, when needed, MUST be manual and recorded as product/developer signoff evidence.

### Key Entities *(include if feature involves data)*

- **Activity Event**: A chain-scoped interpreted wallet action with timestamp, transaction reference, action type, protocol surface, coverage, confidence, linked entities, and source evidence.
- **Activity Transaction**: The transaction-level container that may produce one or more Activity Events and provides transaction hash, time, block context, and explorer path.
- **Asset Movement**: A token-level delta associated with an Activity Event, including direction, token identity, amount, USD value when available, and valuation coverage.
- **Linked Entity**: A Pool, Deposit, Strategy, StrategyExposure, Reward, Governance context, or none, attached only when the evidence supports that relationship.
- **Classification Evidence**: The user-facing explanation of why an Activity Event received its action type, protocol surface, links, confidence, and coverage.
- **Coverage State**: The trust state for an event or value: full, partial, unresolved, excluded, unsupported, malicious, ambiguous, discarded, or unavailable.
- **Rebalance Explanation**: The relationship between withdraw/decrease events, residual attribution state, swaps, deposit/increase events, token flow, pool attribution effect, and source allocation.
- **Activity Filter Context**: The selected action types, protocol surfaces, entities, tokens, date range, coverage states, confidence bands, and resolution states used to narrow the ledger.
- **Supplemental Explorer Evidence**: Chain explorer indexed transaction evidence used to fill gaps in decoded wallet history, including receipts, logs, internal transfers, contract interactions, and suspicious-activity signals when available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of analyzed wallets with supported Aerodrome or Mellow transactions can reach Activity and see at least one interpreted row without navigating through another product section first.
- **SC-002**: 100% of Activity rows in validation wallets display timestamp, transaction reference, interpreted action, coverage state, and confidence.
- **SC-003**: 100% of rows linked to Pool, Deposit, Strategy, Reward, or Governance context include a visible linked entity or a visible reason when the link is unavailable.
- **SC-004**: 100% of malicious, spam-like, unsupported, ambiguous, discarded, partial, and unresolved validation events are visibly labeled and excluded from confident totals unless a metric explicitly states otherwise.
- **SC-005**: 100% of validation transactions that produce multiple economic components show those components separately or clearly disclose why decomposition is unavailable.
- **SC-006**: For validation wallets containing strategy and manual deposit activity in the same pool, 0 strategy internal events are labeled as manual deposit or manual rebalance activity.
- **SC-007**: For validation wallets containing rebalances or partial swap attribution, 100% of relevant rows expose related events, residual attribution state, pool effect, and confidence or disclose which part is unavailable.
- **SC-008**: 95% of users in task testing can find the transaction evidence behind a Pool, Deposit, Strategy, or Reward metric in under 30 seconds.
- **SC-009**: 95% of users in task testing can select an Activity row and identify its action type, linked entity, token movement, coverage state, and confidence in under 20 seconds.
- **SC-010**: Users can filter Activity by action type, token, entity, coverage, confidence, and date range in no more than two interactions per filter.
- **SC-011**: Filter combinations that return no rows show a stable contextual empty state 100% of the time and preserve surrounding summary and filter layout.
- **SC-012**: 100% of Activity external transaction links resolve through the active chain context.
- **SC-013**: Manual product/developer signoff confirms Activity is visually consistent with the existing DataView surfaces and uses the shared design system patterns for metrics, filters, tables, pagination, detail, badges, links, and empty states.
- **SC-014**: In validation cases where decoded wallet history is incomplete but supplemental explorer evidence contains relevant transaction receipts, logs, or internal transfers, at least 90% of classifiable transactions improve from unsupported or ambiguous to a more specific action label without introducing unsupported ownership links.
- **SC-015**: 100% of transactions that remain unresolved after supplemental explorer evidence review include a visible evidence-gap reason.
- **SC-016**: 100% of known malicious or phishing airdrop validation transactions are excluded from rewards, earned value, cash-in, and portfolio return.

## Assumptions

- Activity is the next feature after Rewards based on the latest product status report.
- Activity is an analyzed surface and remains locked until historical analysis is ready unless a limited recent mode is intentionally enabled and labeled.
- Product v1 remains Base-only but all Activity identities, links, and filters are chain-scoped.
- Activity consumes normalized historical analysis output; it does not execute transactions or perform user actions.
- Existing Pools, Deposits, Strategies, and Rewards surfaces remain separate product sections; Activity links to them rather than replacing them.
- Governance may not yet have a full DataView, but Activity can still show governance-classified rows and evidence when available.
- Missing or ambiguous evidence results in partial, unresolved, unsupported, malicious, ambiguous, discarded, or unavailable states rather than heuristic assignment.
- Supplemental chain explorer evidence is available through local configuration for environments that need it, but the product behavior must remain correct when that evidence is unavailable or insufficient.
- Supplemental evidence can improve classification and decomposition, but ownership still requires explicit identity or protocol-backed semantics.
- Visual smoke/signoff remains manual; automated validation focuses on mappers, contracts, query state, classification rules, and data consistency.
