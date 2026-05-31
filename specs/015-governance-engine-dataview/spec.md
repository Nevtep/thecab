# Feature Specification: Governance Engine Processing And Metrics DataView

**Feature Branch**: `015-governance-engine-dataview`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Agregar al engine el procesamiento de tx de gobernanza y el dataview de metricas. Si el engine no procesa governance, las pantallas quedan incompletas; avanzar con la implementacion para terminar pantallas y luego estabilizar el engine."

## Clarifications

### Session 2026-05-31

- Q: What product-facing surfaces are mandatory on the first Governance screen? -> A: KPI strip, persistent lock status panel, compact vote timeline by epoch, governance rewards list/table, reward-type/value breakdown, and selected-detail inspection panel are mandatory; expanded raw history and deep linked-surface inspection are secondary drilldowns.
- Q: Which KPI and analytical categories define the first-screen Governance view model? -> A: Locked AERO, veAERO exposure, lock expiry or remaining duration, governance rewards claimed, estimated governance return, and coverage state are mandatory first-screen KPIs; fee/bribe/rebase splits, relay participation, active epochs, and claim status are supporting metrics surfaced in panels, rows, or breakdowns.
- Q: How should lock state, vote timeline, rewards, and detail responsibilities be separated? -> A: The lock panel is a persistent exposure summary, epoch timeline cards are compact summaries rather than ledger rows, governance rewards rows carry the minimum inspectable reward model, and the selected-detail panel owns transaction-level evidence and explanation.
- Q: How must coverage, confidence, and cross-surface links behave? -> A: Coverage/confidence must appear at KPI, timeline, rewards row, and selected-detail levels; Governance links to Activity, Rewards, and Pools only when explicit persisted or protocol-derived evidence exists and must not duplicate or double-count totals.
- Q: What must Governance not become? -> A: Governance must not be a transaction execution surface, raw explorer, news feed, speculative APR marketing page, generic table-first activity page, or a feature that fabricates pool/epoch associations without evidence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconstruct Governance Activity (Priority: P1)

As a connected wallet user with completed historical analysis, I want The Cab to identify governance transactions separately from deposits, strategies, rewards, pools, and generic activity so that I can trust that veAERO locks, votes, relays, and governance claims are not being hidden or misclassified.

**Why this priority**: Governance cannot be a reliable product surface until the engine recognizes governance protocol surfaces explicitly. A visual dataview without correct classification would repeat the known rewards/activity drift problem.

**Independent Test**: Use a wallet fixture containing known veAERO lock, lock increase or extend, vote/reset, relay, and voting reward claim transactions. After analysis, each supported transaction appears as governance activity with a governance-specific action, timestamp, transaction identity, coverage state, confidence state, and evidence summary. Non-governance transactions remain outside Governance unless explicitly linked as a governance reward.

**Acceptance Scenarios**:

1. **Given** a wallet with a veAERO lock creation transaction, **When** historical analysis completes, **Then** Governance shows a lock event with locked AERO, lock identity when available, expiry or coverage gap, and source evidence.
2. **Given** a wallet with vote and reset transactions, **When** Governance is opened, **Then** the vote timeline groups those actions by epoch when the epoch can be derived and marks the epoch as partial when it cannot.
3. **Given** a transaction touching only router or pool surfaces without governance evidence, **When** the engine classifies activity, **Then** the transaction is not promoted into Governance by pool/time proximity or router-only inference.

---

### User Story 2 - Inspect Governance Metrics (Priority: P1)

As a user reviewing my governance position, I want a metric-first Governance view that summarizes current lock exposure, voting participation, governance rewards, and estimated governance return so that I can understand the impact of governance activity without reading every transaction.

**Why this priority**: The product spec defines Governance as a first-level dashboard surface. It must provide the same control-tower quality as Pools, Deposits, Strategies, Rewards, and Activity.

**Independent Test**: Open Governance after historical analysis for a wallet with governance activity. The first screen shows a horizontal KPI strip, persistent lock status panel, compact vote timeline by epoch, governance rewards list/table, reward-type/value breakdown, and selected-detail inspection panel without requiring deep scrolling for the primary information.

**Acceptance Scenarios**:

1. **Given** a wallet with an active veAERO lock, **When** Governance loads, **Then** the summary displays current locked AERO, current veAERO or lock exposure, lock expiry or remaining duration, and coverage status.
2. **Given** a wallet with governance reward claims, **When** Governance loads, **Then** the summary displays total governance rewards claimed, voting fees, bribes, rebases where applicable, and estimated governance return with explicit estimated labeling.
3. **Given** a wallet with partial governance reconstruction, **When** Governance loads, **Then** metric cards and charts show partial coverage rather than confident-looking totals.
4. **Given** a wallet with governance activity, **When** Governance first loads, **Then** the screen hierarchy prioritizes KPI summary, governance/lock state, epoch/reward analytical surfaces, and selected-detail inspection before generic history exploration.

---

### User Story 3 - Explain Governance Rewards Without Double Counting (Priority: P2)

As a user inspecting rewards and pool performance, I want governance rewards to be included in Rewards and explainable in Governance while avoiding duplicate portfolio, pool, or governance totals.

**Why this priority**: Governance rewards cross product boundaries. The product spec requires them in Rewards, Governance, and pool views when association exists, but never double-counted.

**Independent Test**: Use a wallet fixture with bribe, fee, or rebase claims that can be associated with pools for some claims and not for others. Governance, Rewards, and Pools reconcile to the same underlying claims with clear association or partial-coverage reasons.

**Acceptance Scenarios**:

1. **Given** a voting fee claim associated with a pool, **When** the user views Governance rewards, **Then** the reward includes reward type, token amount, USD value at claim, source epoch, and linked pool.
2. **Given** a governance reward with no reliable pool association, **When** the user views Governance and Rewards, **Then** the reward remains visible with partial association and is not fabricated into a pool.
3. **Given** the same governance reward appears in Rewards and Governance, **When** portfolio totals are calculated, **Then** the reward contributes only once to the relevant aggregate.

---

### User Story 4 - Investigate Evidence And Gaps (Priority: P2)

As a user auditing a governance row or metric, I want a detail view that explains the evidence used, what is missing, and what confidence The Cab has in the classification so that uncertainty is visible instead of hidden.

**Why this priority**: Governance classification depends on protocol-specific contracts and event semantics. The Cab must surface uncertainty, especially for managed rewards, relays, and unsupported actions.

**Independent Test**: Select supported, partial, unresolved, and unsupported governance rows. The detail panel updates without full page refresh and shows action summary, transaction identity, timestamp, contract or protocol surface, token movement, value at claim or value effect, epoch/pool/vote context when available, classification evidence, coverage notes, evidence sources, missing data, and links to related Activity/Rewards/Pools contexts where explicit.

**Acceptance Scenarios**:

1. **Given** a supported vote transaction, **When** the user selects it, **Then** the detail panel shows vote targets, weights when available, epoch, classification evidence, and confidence.
2. **Given** an unsupported governance transaction, **When** the user selects it, **Then** the detail panel keeps the transaction visible as unsupported or partial and explains the missing evidence.
3. **Given** a governance reward linked to Activity and Rewards, **When** the user opens the detail panel, **Then** links to those surfaces are available without changing the classification.

---

### User Story 5 - Filter And Share Governance History (Priority: P3)

As a power user, I want to filter, sort, page, and share Governance state by time range, epoch, action, pool, token, reward type, coverage, and confidence so that I can investigate specific periods or governance surfaces efficiently.

**Why this priority**: Filtering is important for research workflows, but it depends on the engine and primary dataview being reliable first.

**Independent Test**: Apply filters that produce populated and empty result sets. The Governance layout remains stable, active filters are visible, the table updates without full page reload, the selected detail behaves predictably, and the URL can be shared to reopen the same filtered context.

**Acceptance Scenarios**:

1. **Given** a governance table with many rows, **When** the user changes page or page size, **Then** the table updates inline and preserves filters and selection when applicable.
2. **Given** filters with no matching governance rows, **When** the view renders, **Then** the no-results message appears in the table area and metric/chart panels remain stable with empty or partial states.
3. **Given** a shared filtered URL, **When** another session opens it after analysis is ready, **Then** the same filters and selected context are restored when the referenced data exists.

### Edge Cases

- Wallet has no governance activity after historical analysis.
- Historical analysis is not ready, stale, failed, or canceled.
- Wallet has governance rewards but no detectable current veAERO lock.
- Wallet had an expired or withdrawn lock.
- Wallet has multiple lock identities or multiple lock lifecycle events.
- Vote epoch, pool association, vote weight, or relay strategy cannot be derived.
- Managed rewards, relay rewards, or rebases are visible but semantically ambiguous.
- Token price at claim time is unavailable or zero-confidence.
- Provider payloads disagree with protocol logs or contract-derived evidence.
- Governance-like airdrops, phishing tokens, spam transfers, or unrelated token receipts appear near governance activity.
- A governance transaction touches multiple surfaces and should produce multiple explainable events without duplicate totals.
- Unsupported future governance contract actions appear in the wallet history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify governance activity from explicit governance protocol surfaces, including veAERO or voting escrow activity, voter activity, relay participation, bribe claims, voting fee claims, rebase claims, reward distributors, and related AERO movements.
- **FR-002**: System MUST NOT classify a transaction as governance solely from router activity, pool proximity, timestamp proximity, token symbol, or generic transfer patterns.
- **FR-003**: System MUST classify supported governance actions at minimum as lock creation, lock increase, lock extension, relock where detectable, lock withdrawal where applicable, vote, vote reset, relay participation, voting fee claim, bribe claim, rebase claim, and unknown governance action.
- **FR-004**: System MUST persist unsupported, ambiguous, incomplete, excluded, and unresolved governance-related activity with visible coverage/confidence status instead of dropping it or converting it into confident metrics.
- **FR-005**: Governance summary MUST show current locked AERO, current veAERO or lock exposure, lock expiry or remaining duration, active/expired/withdrawn lock state when derivable, total governance rewards claimed, voting fees, bribes, rebases, estimated governance return, and extraction coverage.
- **FR-006**: Governance MUST show a lock panel containing lock identity when available, creation date, current and historical locked amount, expiry, increase/extend/relock history, current status, and evidence gaps.
- **FR-007**: Governance MUST show a voting timeline grouped by epoch when possible, including voted pools, vote weights, manual versus relay voting when available, resets, fees/bribes earned, and claim state.
- **FR-008**: Governance MUST show governance rewards by reward type, token, epoch, pool when supported, vote context when supported, amount, USD value at claim, and coverage/confidence status.
- **FR-009**: Governance rewards MUST be included in Rewards and explainable in Governance without double-counting across portfolio, pool, strategy, rewards, governance, or activity totals.
- **FR-010**: Governance MUST allocate rewards to pools only when an explicit protocol-derived association exists; otherwise it MUST show the reward as unallocated or partial with the reason.
- **FR-011**: Users MUST be able to inspect a selected governance row or metric in a detail panel showing transaction hash, timestamp, governance action, protocol surface, token movements, value, epoch, pool/vote/relay context, evidence, coverage notes, and related product links.
- **FR-012**: Users MUST be able to search, filter, sort, and page governance history by time range, epoch, action, reward type, token, pool, coverage, confidence, and linked surface where those fields exist.
- **FR-013**: Governance MUST preserve layout stability for empty states, partial states, loading states, locked analysis states, and selected rows that disappear due to filtering.
- **FR-014**: Governance metrics, charts, table rows, detail content, filter labels, enum labels, coverage reasons, and empty states MUST be localized and use central locale-aware formatting for currency, token amounts, percentages, dates, and durations.
- **FR-015**: Governance MUST include chain identity in every governance event, lock, vote, reward, metric, filter state, product link, and external explorer link.
- **FR-016**: Governance MUST be read-only. It MUST NOT initiate votes, locks, relays, claims, approvals, swaps, or any wallet transaction.
- **FR-017**: Governance MUST expose Activity links for governance rows and Rewards links for governance reward rows when the relationship is explicit and persisted.
- **FR-018**: Governance MUST mark estimated governance return as estimated and MUST exclude unresolved, unsupported, excluded, spam, or price-unavailable values from confident return totals.
- **FR-019**: The first Governance screen MUST be dashboard-first and MUST include these mandatory product-facing surfaces on initial load: a top KPI strip, persistent lock status panel, compact vote timeline by epoch, governance rewards list/table, reward-type/value breakdown, and selected-detail inspection panel.
- **FR-020**: Expanded raw history, deep source evidence, expanded linked-surface inspection, and unsupported/excluded activity review MUST be secondary drilldown surfaces, not replacements for the first-screen control surface.
- **FR-021**: The first-screen KPI strip MUST include locked AERO, veAERO exposure, lock expiry or remaining duration, governance rewards claimed, estimated governance return, and overall coverage state. If any value cannot be reconstructed, the corresponding KPI MUST remain present and show partial, unavailable, or unresolved state.
- **FR-022**: Supporting metrics such as voting fees, bribes, rebases, relay participation, active epochs, claim status, and fee/bribe/rebase split MAY appear in panels, rows, breakdowns, or selected detail, but they MUST NOT displace the mandatory KPI categories.
- **FR-023**: The persistent lock status panel MUST summarize governance exposure independently from selected event detail. It MUST show current lock state, lock lifecycle, lock identity when available, locked AERO, veAERO exposure, expiry, coverage, and confidence. It MUST NOT change responsibility based on arbitrary row selection.
- **FR-024**: The selected-detail panel MUST explain the currently selected governance row, reward row, epoch card, or metric. It MUST include action summary, transaction hash and timestamp where available, protocol surface, token movements, value at claim or value effect, epoch/vote/pool context where available, classification evidence, linked product contexts, coverage notes, and evidence sources.
- **FR-025**: For supported selected rows, every applicable selected-detail section MUST be populated from evidence-backed data. For partial, unresolved, unsupported, or excluded rows, the same sections MUST remain structurally present where relevant and degrade to explicit missing-data, unsupported, excluded, or partial-coverage explanations.
- **FR-026**: The vote timeline MUST be a compact epoch-level analytical surface, not a full ledger table. Each epoch summary MUST show epoch identity, voted pools, vote weights when available, manual versus relay context when available, reset state, fees/bribes/rewards state, claim or pending status, and coverage/confidence.
- **FR-027**: Governance rewards on the first screen MUST use a minimum row model containing reward date or epoch, reward type, token, amount, USD value at claim, associated epoch, associated pool when explicit, coverage, confidence, and context or linked source.
- **FR-028**: Governance reward detail MUST extend the reward row with transaction identity, protocol surface, token movement evidence, value-at-claim evidence, epoch/vote/pool association evidence, linked Activity/Rewards/Pools contexts, and coverage notes.
- **FR-029**: The first screen MUST include a compact analytical reward-type/value breakdown. The product output MUST communicate value share by reward type such as fees, bribes, rebases, relay rewards, and unknown governance rewards; a ring/donut presentation is preferred when multiple categories exist, while empty or single-category states may degrade to an equivalent compact summary.
- **FR-030**: Coverage and confidence MUST be visible at KPI level, vote timeline level, governance rewards row level, and selected-detail level. Partial, unresolved, unsupported, and excluded rows MUST remain inspectable and MUST NOT masquerade as confident totals.
- **FR-031**: Governance MUST link to Activity for governance rows with explicit transaction or activity identity, to Rewards for governance reward rows with explicit reward identity, and to Pools only when explicit protocol-derived or persisted pool association exists. Links MUST explain or reference other surfaces without duplicating or double-counting their totals.
- **FR-032**: Governance screen hierarchy MUST preserve the intended control-surface order: top KPI summary first, governance state and lock state second, epoch/timeline or rewards analytical surfaces third, and selected-detail inspection rail alongside the analytical surface.
- **FR-033**: Governance MUST NOT become a transaction execution surface, raw transaction explorer, generic governance news feed, speculative APR marketing page, generic table-first activity page, or a surface that fabricates pool or epoch associations without evidence.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone, with a dense, technical, premium dataview. User-facing copy MUST avoid hype, casino, meme, or speculative-investment language.
- **CA-002 Localization**: Feature MUST define a Governance i18n namespace impact and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST use locale-aware formatting for locked amounts, token amounts, USD values, percentages, APR/return estimates, dates, epochs, and durations.
- **CA-004 Chain Awareness**: Feature MUST carry `chainId` through governance identity, linked product identity, query state, API contract, explorer links, and regression fixtures.
- **CA-005 Provider Boundaries**: Feature MUST separate data-source ownership: wallet activity discovery, protocol log or contract evidence, historical prices, explorer evidence, and persisted product read data. User-facing request flows MUST not depend on live provider calls.
- **CA-006 Explainability**: Feature MUST surface coverage/confidence and missing evidence for partial, unresolved, unsupported, excluded, or ambiguous governance reconstruction.
- **CA-007 Testing Boundary**: Feature MUST define automated validation without Playwright, browser E2E, or automated browser/a11y suites. Auth-gated UI validation, when needed, MUST be manual and recorded as product/developer signoff evidence.

### Key Entities *(include if feature involves data)*

- **GovernanceEvent**: A chain-scoped interpreted governance action for a wallet, such as lock, vote, reset, relay, claim, or unsupported governance activity. Key attributes include wallet, chain, transaction identity, timestamp, action, protocol surface, coverage, confidence, value, and evidence.
- **GovernanceLockExposure**: The user's lock state and lifecycle for veAERO-related exposure. Key attributes include lock identity when available, current locked AERO, current veAERO or lock exposure, creation time, expiry, status, lifecycle history, and evidence gaps.
- **GovernanceVote**: A vote or reset event grouped by epoch when possible. Key attributes include epoch, vote target pools, weights, manual or relay source, reset state, linked transaction, and coverage.
- **GovernanceReward**: A governance-related reward claim, including voting fee, bribe, rebase, relay reward, or unknown governance reward. Key attributes include reward type, token, amount, USD value at claim, source epoch, linked pool when explicit, linked Activity row, linked Rewards row, coverage, and confidence.
- **GovernanceEpoch**: A time-bucketed governance period used to group votes, resets, fees, bribes, and claim status when derivable.
- **GovernanceMetricSummary**: The aggregate Governance view for a wallet and chain, including lock exposure, reward totals, return estimates, event counts, coverage state, and chart-ready series.
- **GovernanceViewModel**: The product-facing first-screen representation of Governance, composed of mandatory KPI categories, lock status summary, compact epoch timeline, governance rewards row model, reward-type/value breakdown, selected-detail state, coverage/confidence states, and explicit cross-surface links.
- **GovernanceEvidence**: The explanation record for why a governance event or metric is classified as it is. It captures evidence source, matched protocol surface, missing fields, conflict notes, confidence, and exclusion reason where relevant.
- **LinkedProductContext**: Explicit relationships from governance rows to Activity, Rewards, Pools, Strategies, or Deposits. Relationships must be persisted or evidence-backed and may be absent when unsupported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In curated regression fixtures, at least 95% of supported governance transactions are classified into the correct high-level governance action family with chain-scoped identity.
- **SC-002**: 100% of unsupported, ambiguous, spam, excluded, or insufficient-evidence governance-like transactions remain visible as unsupported, partial, unresolved, or excluded and do not contribute to confident governance return totals.
- **SC-003**: Users can trace every displayed Governance KPI and every governance reward row to a transaction, linked product row, or explicit evidence gap in no more than two interactions.
- **SC-004**: Governance rewards reconcile with Rewards and pool-linked reward totals in tested fixtures with zero double-counted USD contribution.
- **SC-005**: Filter, pagination, and row-selection changes update the Governance dataview without visible full-page reload and preserve layout stability for no-result states.
- **SC-006**: Every governance action label, protocol surface label, filter label, coverage status, confidence label, and exclusion reason introduced by this feature has English and Spanish copy.
- **SC-007**: For a representative wallet with governance activity, the first desktop viewport shows summary metrics, a primary chart or timeline, the governance table, and selected-detail context without requiring deep scrolling to understand the state.

## Assumptions

- Product v1 remains Base-first, but governance data must still be chain-scoped through domain identity and links.
- Governance is available only after historical analysis is ready; limited pre-analysis Governance is out of scope for this feature.
- The feature is read-only and does not support executing locks, votes, relays, claims, approvals, or swaps.
- Governance classification must use explicit wallet, protocol, transaction, log, transfer, or persisted evidence. Pool/time proximity and symbol-only heuristics are out of scope unless later approved explicitly.
- Where Aerodrome or related protocol evidence does not expose epoch, pool, lock identity, relay strategy, or reward association, the UI shows partial/unresolved coverage rather than fabricating a relationship.
- Governance rewards may appear in Rewards, Governance, and pool contexts, but they represent the same underlying claim and must not be counted more than once in product aggregates.
- Protocol terms such as AERO, veAERO, bribe, fee, rebase, relay, vote, reset, and epoch remain recognizable protocol terms in localized copy.
