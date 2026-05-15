# Feature Specification: Overview Protocol Positions

**Feature Branch**: `005-overview-protocol-positions`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: User description: "Overview should show LP NFTs, Mellow strategy exposure, and Aerodrome governance locks right away in the connected Overview, without pretending that recent-view data is full historical reconstruction."

**Current Delivery Stage**: The active implementation scope for this feature directory is Stage 1: extend the connected Overview with a bounded reconstruction slice so it can surface current protocol positions as a first-class Overview block. This stage covers immediate visibility of manual Aerodrome positions, Mellow strategy exposure, and governance locks, plus honest current-value and coverage messaging where possible, using targeted reconstruction over a recent 30-day window when that materially improves correctness. Full one-year historical reconstruction, realized or unrealized performance analytics, and detail-page workflows remain follow-up scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Deployed And Locked Capital Immediately (Priority: P1)

As a connected user, I need Overview to show current protocol positions such as manual LP positions, strategy exposure, and governance locks immediately so my capital does not appear missing or idle just because it is inside Aerodrome or Mellow surfaces.

**Why this priority**: The product promise is fast portfolio visibility first. If deployed or locked capital is invisible until a later deep analysis pass, the first connected experience is misleading.

**Independent Test**: Can be fully tested by loading Overview for wallets that currently hold a manual Aerodrome position NFT, a Mellow position, or a governance lock and verifying that the screen shows those positions in a dedicated protocol-positions section before full historical analysis is completed.

**Acceptance Scenarios**:

1. **Given** a connected wallet currently owns an Aerodrome manual concentrated-liquidity position, **When** Overview loads, **Then** the screen shows that position as a manual protocol position rather than hiding it inside generic wallet assets.
2. **Given** a connected wallet currently has governance capital locked in Aerodrome governance surfaces, **When** Overview loads, **Then** the screen shows governance exposure in a dedicated protocol position state rather than omitting it from the portfolio view.
3. **Given** a connected wallet currently holds Mellow strategy exposure, **When** Overview loads, **Then** the screen shows that exposure as a strategy position rather than as a user-owned manual Aerodrome deposit.

---

### User Story 2 - Keep Overview Classification Honest (Priority: P1)

As a connected user, I need Overview to distinguish wallet assets from protocol positions so I can tell what is liquid, what is deployed, what is strategy-managed, and what is governance-locked.

**Why this priority**: The Cab is an analytics cockpit, not a raw wallet inventory. The first connected dashboard must reflect economic meaning, not only token transport format.

**Independent Test**: Can be fully tested by loading Overview for a wallet that has both liquid tokens and protocol positions and verifying that wallet assets remain separate from protocol positions while the related metric groups reflect the correct category.

**Acceptance Scenarios**:

1. **Given** a wallet holds liquid tokens and one or more protocol positions, **When** Overview renders, **Then** wallet assets and protocol positions appear in separate sections.
2. **Given** a wallet has both a manual Aerodrome position and a Mellow position linked to the same underlying pool, **When** Overview renders, **Then** those exposures remain separated by position family instead of being merged into a single undifferentiated row.
3. **Given** a wallet has no liquid balance for a pool token because the value is fully deployed, **When** Overview renders, **Then** the deployed capital still appears through protocol positions rather than being shown as missing capital.

---

### User Story 3 - See Honest Partial Coverage Before Deep Analysis (Priority: P2)

As a connected user, I need Overview to show detected protocol positions even when current valuation or metadata is partial so I can still understand what exists without mistaking the screen for a fully reconstructed historical model.

**Why this priority**: Users need current truthfulness more than false precision. Omitting a real position is worse than showing it with a partial or share-level label.

**Independent Test**: Can be fully tested by loading Overview for wallets where a protocol position is detected but valuation or pool mapping is incomplete and verifying that the screen still shows the position with an honest coverage state instead of hiding it.

**Acceptance Scenarios**:

1. **Given** a manual Aerodrome position is detected but the system cannot compute a complete current value, **When** Overview renders, **Then** the position still appears with partial coverage messaging.
2. **Given** a Mellow strategy is detected from official strategy metadata and wrapper or staking evidence but underlying internals are incomplete, **When** Overview renders, **Then** the strategy appears with `share_level` or partial coverage rather than being presented as a fully reconstructed manual deposit.
3. **Given** a governance lock is detected but some current-value inputs are incomplete, **When** Overview renders, **Then** the lock still appears and related metric coverage is degraded honestly.

---

### User Story 4 - Prepare The Overview For Deeper Sections Later (Priority: P2)

As a user who will later open Pools, Deposits, Strategies, and Governance sections, I need Overview protocol positions to use the same position families and identity rules those sections will rely on so the product does not change meaning between the first dashboard and deeper analytics.

**Why this priority**: Overview is the first connected surface, but it must not teach the user the wrong model. The position categories introduced here become the cognitive bridge to later sections.

**Independent Test**: Can be fully tested by reviewing the Overview response and position model to confirm that manual deposits, strategy exposure, and governance locks use chain-aware identities and do not collapse incompatible concepts into the same category.

**Acceptance Scenarios**:

1. **Given** a manual Aerodrome position is detected, **When** it is represented in Overview, **Then** its identity is compatible with later deposit-level analytics and not keyed by wallet address alone.
2. **Given** a Mellow strategy interaction is detected, **When** it is represented in Overview, **Then** it is modeled as strategy exposure and not as a manual deposit unless the wallet actually owns the relevant manual NFT.
3. **Given** a governance position is detected, **When** it is represented in Overview, **Then** it uses a chain-aware governance identity that can later connect to governance analytics without redefining the position family.

---

### User Story 5 - Use Protocol Position States In English Or Spanish (Priority: P3)

As an English- or Spanish-speaking user, I need all new protocol-position labels, coverage states, metric labels, and empty or partial states to be localized so the new Overview behavior remains trustworthy and consistent with the rest of the product.

**Why this priority**: The Cab requires full localization for user-facing product surfaces, and protocol-position coverage labels are core explanation copy.

**Independent Test**: Can be fully tested by switching locale and verifying that every newly introduced Overview protocol-position label and coverage state renders in English and Spanish with locale-aware value formatting.

**Acceptance Scenarios**:

1. **Given** browser language is Spanish, **When** Overview renders protocol positions, **Then** all related titles, labels, statuses, and descriptions appear in Spanish.
2. **Given** browser language is unsupported, **When** Overview renders protocol positions, **Then** the interface falls back to English consistently.
3. **Given** Overview shows currency values, token balances, counts, percentages, or timestamps related to protocol positions, **When** locale changes, **Then** those values re-render with locale-aware formatting.

### Edge Cases

- A wallet holds an open manual Aerodrome position NFT but no liquid pool-token balances.
- A wallet has both a manual Aerodrome position and a Mellow strategy exposure tied to the same underlying pool.
- A wallet holds governance exposure that is detectable but not fully valued.
- A detected Mellow strategy can only be represented at share level, not full underlying composition.
- A position is detected from one discovery surface but lacks complete confirmation from another surface.
- The same wallet has multiple protocol positions that share the same token symbols but come from different position families.
- A position predates the supported analysis window but is still currently open.
- The wallet owns unrelated NFTs that are not relevant protocol positions and should not be promoted into the primary Overview positions block.
- Duplicate provider or protocol signals identify the same current position and must be deduplicated.
- A wallet has protocol positions but almost no recent fungible wallet balances, which would otherwise make the dashboard appear mostly idle.
- A protocol position is visible but current valuation is missing or stale.
- A wrong-network wallet reaches Overview and must still be blocked by the existing Base-mainnet rule.

## Requirements *(mandatory)*

### Stage Scope Constraint *(mandatory)*

- The current implementation stage for this feature directory is limited to the connected Overview and its supporting internal API, localization, persistence, and coverage behavior.
- This stage adds current protocol-position visibility using a bounded reconstruction slice, not the full historical lifecycle model.
- The bounded reconstruction slice for this feature MUST be limited to the most recent 30 days of protocol-relevant activity unless a smaller window is sufficient to classify the current position honestly.
- This stage MUST NOT require the full one-year historical analysis scope defined for the deeper analysis pipeline.
- Pools, Deposits, Strategies, Governance, Rewards, and Activity detail pages remain follow-up scope except where this specification defines reusable identity and position-family rules.
- Realized or unrealized performance analytics, annualized return, reward attribution, and lifecycle timelines remain follow-up scope for the deeper analyzed model.

### Functional Requirements

#### 1) Feature Summary

- **FR-001**: The system MUST extend the connected Overview so it can display current protocol positions in addition to wallet assets.
- **FR-002**: The system MUST treat protocol positions as first-class Overview entities rather than forcing them into the same representation as ordinary fungible wallet assets.
- **FR-003**: The first delivery slice MUST focus on current visibility and honest categorization, not on the full historical reconstruction model.
- **FR-003A**: The first delivery slice MAY use targeted bounded reconstruction when current-state discovery alone is not sufficient to make the Overview meaningfully correct.
- **FR-003B**: Any bounded reconstruction used by this feature MUST stay within a recent 30-day window and MUST NOT expand this Overview slice into the full one-year analysis workflow.
- **FR-004**: Overview MUST remain usable before full historical analysis is complete.
- **FR-005**: Overview MUST use clear provisional or coverage-aware language when protocol positions are shown from recent or current data rather than from the normalized historical model.

#### 2) Supported Position Families

- **FR-006**: The Overview protocol-positions model MUST support at least these position families: manual deposit position, strategy exposure, and governance lock.
- **FR-007**: The model MAY also surface staked LP exposure as a distinct current state when it materially changes how the position should be described in Overview.
- **FR-008**: The system MUST distinguish manual Aerodrome concentrated-liquidity positions from automated Mellow strategy exposure even when both relate to the same underlying pool.
- **FR-009**: Governance locks MUST remain distinct from both wallet assets and pool or strategy exposure.
- **FR-010**: A protocol position shown in Overview MUST belong to exactly one primary position family in the current view model.

#### 3) Identity And Domain Rules

- **FR-011**: Manual Aerodrome concentrated-liquidity positions MUST use NFT-oriented identity when token identity is available.
- **FR-012**: Manual Aerodrome position identity MUST be chain-scoped and MUST NOT rely on wallet address alone.
- **FR-013**: Strategy exposure identity MUST be chain-scoped and tied to the recognized strategy surface rather than inferred only from token symbol or pool label.
- **FR-014**: Governance lock identity MUST be chain-scoped and MUST NOT be keyed by wallet address alone.
- **FR-015**: If the product cannot derive a final canonical position identifier in the first delivery slice, it MUST still use a deterministic chain-scoped provisional identity that is compatible with later deeper analytics.
- **FR-016**: The same underlying pool MAY have multiple simultaneous position families, and Overview MUST preserve their separation.
- **FR-017**: The system MUST NOT model Mellow exposure as a manual Aerodrome deposit unless the wallet actually owns the relevant manual Aerodrome NFT.

#### 4) Detection And Data Ownership

- **FR-018**: The system MUST use Moralis as a wallet-centric discovery layer for current or recent Overview signals where appropriate.
- **FR-019**: The system MUST use official protocol metadata, RPC reads, event logs, contract reads, or equivalent internal protocol knowledge when Moralis discovery alone is insufficient to classify a current position honestly.
- **FR-019A**: Protocol metadata, RPC reads, event logs, and contract reads introduced by this feature MUST be used only to the extent needed to reconstruct current position state or recent supporting context within the bounded 30-day window.
- **FR-020**: The system MUST preserve the provider boundary in which browser code consumes only internal application APIs and never calls Moralis or Alchemy directly.
- **FR-021**: The system MUST NOT treat Moralis decoded labels or generic DeFi-position hints as final protocol semantics for manual deposits, strategy exposure, or governance locks.
- **FR-022**: The system MUST NOT assume that Router activity is the only valid discovery surface for Aerodrome-related current positions.
- **FR-023**: The system MUST recognize that governance and Mellow surfaces can be discovered outside Router-mediated activity.
- **FR-024**: The system SHOULD combine multiple discovery surfaces when needed to avoid omitting real current positions.
- **FR-024A**: When provider or protocol data is fetched for this feature, the system MUST persist raw provider or RPC artifacts, or enough normalized internal records to preserve explainability, reclassification, and debugging of the resulting Overview state.
- **FR-024B**: This feature MUST NOT skip `RawProviderRecord` persistence for provider or RPC-backed evidence that materially affects protocol-position classification or value treatment.

#### 5) Overview Presentation

- **FR-025**: Overview MUST include a dedicated protocol-positions section separate from the wallet-assets section.
- **FR-026**: The protocol-positions section MUST allow a user to distinguish at a glance whether a position is a manual deposit, strategy exposure, governance lock, or other approved current-position family.
- **FR-027**: Protocol positions MUST NOT be rendered as if they were ordinary token balance rows with a fake unit spot price.
- **FR-028**: Wallet assets MUST remain visible as a separate Overview surface for liquid, residual, reward, or other wallet-held inventory.
- **FR-029**: A wallet that has protocol positions but limited liquid wallet balances MUST still look meaningfully populated in Overview.
- **FR-030**: A protocol-position row or card MUST communicate at least the position family, a human-readable label, and a current coverage or confidence state.
- **FR-031**: When known, the Overview position representation SHOULD include related pool context, strategy context, or governance context.
- **FR-032**: When known, the Overview position representation SHOULD include distinguishing metadata such as pool pair, token ID, wrapper relationship, or lock context.
- **FR-033**: The Overview screen MUST preserve the existing analysis CTA and recent-view posture while adding protocol positions.
- **FR-034**: The system MUST avoid misleading zero-only or empty-dashboard states when current protocol positions exist.
- **FR-034A**: Unrelated wallet NFTs or generic NFT inventory MUST NOT be promoted into the primary Overview protocol-positions block unless they are positively classified as approved protocol position families.

#### 6) Metrics And Value Treatment

- **FR-035**: Overview MUST populate manual-deposit, automated-strategy, and governance metric groups when enough current position evidence exists.
- **FR-036**: The system MUST not fabricate current USD values for protocol positions when valuation inputs are incomplete.
- **FR-037**: If a current protocol position is detected but not fully valued, the position MUST remain visible and the related metric or summary block MUST degrade coverage honestly.
- **FR-038**: The system MAY include a currently defensible estimated value for a protocol position when sufficient current inputs exist.
- **FR-039**: The system MUST label protocol-position values as current or estimated when full historical reconstruction is not yet available.
- **FR-040**: A governance position that lacks complete current valuation MUST still contribute to Overview understanding through visible position state even if its USD value is null or partial.
- **FR-041**: Strategy exposure that is reliable only at the share or wrapper level MUST use a share-level or partial value treatment rather than pretending to be fully decomposed underlying liquidity.
- **FR-042**: The presence of visible but partially valued protocol positions MUST degrade the confidence or coverage messaging of affected Overview blocks instead of silently presenting a fully confident result.

#### 7) Coverage And Explainability

- **FR-043**: The Overview protocol-positions model MUST support at least these coverage states: `full`, `share_level`, `partial`, and `unknown`.
- **FR-044**: A manual Aerodrome position detected without full current valuation MUST use `partial` or `unknown` coverage rather than being omitted.
- **FR-045**: A Mellow position detected at the wrapper or share layer without reliable underlying reconstruction SHOULD use `share_level` coverage by default.
- **FR-046**: Governance locks detected without complete current-value inputs MUST use `partial` or `unknown` coverage rather than disappearing from Overview.
- **FR-047**: Coverage messaging MUST explain that the position is visible because it exists, while precision may be limited until deeper analysis is available.
- **FR-048**: Overview MUST expose enough normalized metadata for the frontend to communicate why a position is shown, partially valued, or provisionally categorized.
- **FR-049**: The product MUST avoid claiming that the recent Overview protocol-position layer is the same as a fully reconstructed historical model.
- **FR-049A**: When this feature uses bounded reconstruction, the UI MUST communicate that the position state reflects current understanding built from recent protocol evidence, not a complete one-year wallet reconstruction.

#### 8) Relationship To Later Sections

- **FR-050**: The position families introduced in Overview MUST align with the later Pools, Deposits, Strategies, and Governance information architecture.
- **FR-051**: Manual deposit positions surfaced in Overview MUST be compatible with later deposit-level analytics.
- **FR-052**: Strategy positions surfaced in Overview MUST be compatible with later strategy-level analytics.
- **FR-053**: Governance positions surfaced in Overview MUST be compatible with later governance analytics.
- **FR-054**: This feature MUST improve the first connected experience without requiring simultaneous delivery of deeper detail pages.

#### 9) Localization And Product Language

- **FR-055**: All protocol-position labels, headings, empty states, partial states, coverage labels, and helper descriptions introduced by this feature MUST use translation keys.
- **FR-056**: English and Spanish resources for the new protocol-position surfaces MUST preserve key parity.
- **FR-057**: The UI MUST use locale-aware formatting for counts, balances, current values, percentages, dates, and timestamps shown in protocol-position surfaces.
- **FR-058**: The UI MUST avoid language that implies full historical certainty when the feature is showing only current or provisional protocol-position data.
- **FR-059**: The UI MUST preserve The Cab’s precise, technical, control-tower tone and avoid hype-oriented language.
- **FR-059A**: In this stage, product-specific copy for protocol-position surfaces MUST live in the `overview` namespace, while shared coverage state labels MAY remain in `coverage` if they are already shared across the product.
- **FR-059B**: This feature MUST NOT introduce a new shared namespace for protocol-position copy unless later planning shows actual cross-feature reuse beyond Overview.

#### 10) Chain Awareness And Reuse

- **FR-060**: All protocol-position identities, API contracts, persistence behavior, and query keys introduced by this feature MUST be chain-scoped.
- **FR-061**: The same address, NFT token ID, or contract surface on different chains MUST be treated as different entities.
- **FR-062**: The feature MUST preserve Base-mainnet-only product behavior for v1 while keeping the underlying position model compatible with future chain expansion.
- **FR-063**: The protocol-position model introduced here MUST be reusable by later wallet-facing sections without redefining the core position families.
- **FR-063A**: The internal API contract for this feature MUST remain an extension of `/api/wallet/overview` rather than a parallel browser-facing provider contract.
- **FR-063B**: Query keys for this feature MUST remain Overview-scoped and include `chainId` and `walletAddress`.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST keep product-specific protocol-position copy in `overview` for this stage, allow shared coverage labels in `coverage`, and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for numbers, currency values, token amounts, percentages, counts, and dates where protocol positions are shown.
- **CA-004 Chain Awareness**: Feature MUST define chain-aware identity and request handling for manual deposits, strategy exposure, governance locks, Overview APIs, and query keys.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership across Moralis wallet discovery, official protocol metadata, Alchemy pricing, and RPC or contract-read confirmation where needed.
- **CA-006 Explainability**: Feature MUST describe how Overview communicates current-position visibility, partial valuation, share-level strategy accounting, and provisional coverage honestly.

### Key Entities *(include if feature involves data)*

- **Overview Protocol Position**: A current Overview-level representation of deployed or locked capital that is shown separately from wallet assets and identifies one protocol position family, a chain-scoped identity, current status, coverage state, and optional current-value information.
- **Manual Deposit Position**: A current Overview representation of a user-owned Aerodrome manual position, primarily identified by NFT or token ID where available and kept separate from strategy and governance exposure.
- **Strategy Overview Position**: A current Overview representation of automated strategy participation, such as Mellow exposure, tracked at the strategy or share layer rather than as a manual deposit unless the wallet owns the relevant manual NFT.
- **Governance Overview Position**: A current Overview representation of governance-locked capital or equivalent governance exposure that must remain visible even when current valuation is partial.
- **Position Coverage State**: A normalized explanation of how complete the current position understanding is, including whether the system has full, share-level, partial, or unknown confidence for the position shown.
- **Position Value Estimate**: A current-value field for a visible protocol position that may be populated when enough evidence exists, or left null when the position is known but current valuation is incomplete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation wallets with current manual Aerodrome positions, Mellow positions, or governance locks, Overview displays those current positions in a dedicated protocol-positions surface without requiring the full one-year historical analysis flow.
- **SC-002**: In all validation scenarios where a wallet holds both liquid wallet assets and protocol positions, Overview preserves a visible separation between wallet assets and protocol positions.
- **SC-003**: In validation scenarios where a wallet holds both manual Aerodrome exposure and Mellow exposure in the same pool, 100% of those exposures remain separated by position family in the Overview response and UI.
- **SC-004**: Detected protocol positions are never omitted solely because current valuation is incomplete; instead, 100% of such cases surface a visible position with `share_level`, `partial`, or `unknown` coverage.
- **SC-005**: Overview never fabricates USD value for a visible protocol position that lacks sufficient valuation inputs.
- **SC-006**: All new protocol-position labels, coverage states, and helper copy introduced by this feature are available in English and Spanish with matching translation structure.
- **SC-007**: The browser continues to consume only internal application APIs for this feature and never calls Moralis or Alchemy directly.
- **SC-008**: The position model introduced by this feature can be reused by later Overview-adjacent analytics sections without redefining manual deposit, strategy, or governance position families.
- **SC-009**: Any reconstruction performed by this feature is limited to a recent 30-day window in validation scenarios and does not require the full one-year analysis workflow.
- **SC-010**: Unrelated wallet NFTs are never surfaced in the primary Overview protocol-positions block unless they are positively classified as approved protocol position families.
- **SC-011**: Provider or RPC evidence that materially affects protocol-position classification is recoverable through persisted raw or normalized internal records for debugging and explainability.

## Assumptions

- Product v1 remains Base mainnet only, but current protocol-position identity and detection must stay chain-aware.
- The first delivery slice may rely on a mix of wallet-centric discovery, official protocol metadata, targeted contract reads, and bounded recent reconstruction without attempting full one-year lifecycle reconstruction.
- Official Mellow strategy metadata is available or can be synchronized well enough to distinguish known strategy surfaces from manual deposits.
- A current protocol-position block can be added to Overview without removing the existing wallet-assets, chart, and activity surfaces.
- Governance exposure may be visible before complete current-value analytics are available, and that partial value treatment is acceptable in the first slice.
- Unrelated wallet NFTs remain out of the primary Overview protocol-positions block unless they represent approved protocol position families.
- The bounded reconstruction slice for this feature is capped at 30 days and exists only to make current Overview state meaningfully correct from the start.
- Product-specific copy for this feature can stay in `overview` during this stage, with shared coverage copy remaining in `coverage` where already established.
- The first slice focuses on current position truthfulness, while deeper return, reward, and lifecycle analytics remain follow-up work for analyzed views and later sections.