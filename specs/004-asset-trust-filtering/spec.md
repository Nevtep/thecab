# Feature Specification: Wallet Asset Trust Filtering

**Feature Branch**: `004-asset-trust-filtering`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: User description: "Feature: Wallet Asset Trust Filtering"

**Current Delivery Stage**: The active implementation scope for this feature directory is Stage 1: apply wallet-asset trust classification and default filtering to the connected Overview recent view, portfolio totals, asset table, and distribution surfaces. Reuse in Pools, Deposits, Strategies, Rewards, Governance, Activity, and persistent user visibility overrides remains planned follow-up scope, but the model defined here must be reusable by those future sections.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hide Suspicious Assets By Default (Priority: P1)

As a connected wallet user, I want suspicious or low-confidence assets hidden from the default Overview so spam and junk balances do not pollute my portfolio dashboard.

**Why this priority**: Default visibility and totals are the product’s trust boundary. If obvious spam is mixed into the first connected view, the dashboard becomes misleading immediately.

**Independent Test**: Can be fully tested by loading Overview for a wallet containing provider-flagged spam, dust, or suspicious assets and verifying that the default asset table and confident totals exclude the hidden rows while still indicating that hidden assets exist.

**Acceptance Scenarios**:

1. **Given** a connected wallet contains assets classified as possible spam or blocked, **When** Overview loads in its default state, **Then** those assets do not appear in the default asset table.
2. **Given** one or more assets are hidden by default, **When** the Overview summary and distribution blocks are calculated, **Then** hidden possible-spam or blocked assets are excluded from confident totals and default charts.
3. **Given** hidden assets exist, **When** Overview renders, **Then** the UI shows that hidden or low-confidence assets were excluded from the default view.

---

### User Story 2 - Inspect And Understand Hidden Assets (Priority: P1)

As a connected wallet user, I want to reveal hidden assets intentionally and understand why they were marked so I can inspect them without mistaking the marks for a security guarantee.

**Why this priority**: Hiding alone is not sufficient. Users need an explanation path so the system feels trustworthy, auditable, and honest about uncertainty.

**Independent Test**: Can be fully tested by opening Overview for a wallet with hidden assets, using the explicit reveal control, and verifying that each hidden row includes localized trust labels and reasons that explain the signals behind the classification.

**Acceptance Scenarios**:

1. **Given** Overview contains hidden assets, **When** the user selects the hidden-assets control, **Then** the product reveals those assets in a clearly separated inspection view.
2. **Given** an asset is marked as low confidence, possible spam, blocked, or unknown, **When** the asset row or details are shown, **Then** the UI includes localized trust labels and reason labels explaining the relevant signals.
3. **Given** an asset is marked from missing metadata, missing price, suspicious metadata, or provider spam flags, **When** the explanation is shown, **Then** the UI states that the mark is a confidence signal and not a guarantee that the asset is safe or unsafe.

---

### User Story 3 - Keep Known Protocol Assets Visible And Honest (Priority: P2)

As a user analyzing Aerodrome-related activity, I want known protocol assets to stay visible even when generic heuristics are incomplete so The Cab does not hide relevant portfolio assets just because some metadata is missing.

**Why this priority**: The Cab’s core product value depends on preserving legitimate Aerodrome and related assets while still filtering junk.

**Independent Test**: Can be fully tested by loading Overview for a wallet containing known Aerodrome or Mellow-related assets with incomplete cosmetic metadata or missing price coverage and verifying that those assets remain visible with honest coverage degradation instead of being hidden as junk.

**Acceptance Scenarios**:

1. **Given** an asset is recognized as a known protocol asset, **When** Overview classifies wallet assets, **Then** the asset remains visible by default unless a stronger blocking rule applies.
2. **Given** a known protocol asset lacks a logo or other cosmetic metadata, **When** trust classification runs, **Then** the asset is not hidden for that reason alone.
3. **Given** a known protocol asset lacks reliable pricing, **When** Overview shows the asset, **Then** the asset remains visible but its valuation stays null or partial and the related coverage is degraded honestly.

---

### User Story 4 - Keep Portfolio Totals Honest (Priority: P2)

As a connected wallet user, I want portfolio totals and distribution views to include only assets with enough confidence so my dashboard value is not inflated by spam or unpriced junk.

**Why this priority**: Trust filtering is only useful if the product’s headline metrics respect it. Otherwise hidden junk still corrupts the numbers users rely on.

**Independent Test**: Can be fully tested by loading Overview for a wallet containing spam, blocked, and unpriced assets and verifying that default totals exclude hidden junk, keep unpriced values null, and mark the relevant blocks as partial when exclusions affect completeness.

**Acceptance Scenarios**:

1. **Given** an asset is classified as possible spam or blocked, **When** net portfolio value is computed for the default Overview, **Then** the asset is excluded from confident default totals.
2. **Given** an asset lacks reliable pricing, **When** Overview computes valuations, **Then** the asset does not receive a fabricated USD value and is excluded from confident totals that require priced value.
3. **Given** excluded or unpriced assets exist, **When** Overview renders the affected summary or distribution blocks, **Then** those blocks expose partial coverage or exclusion reasons.

---

### User Story 5 - Prepare For User Visibility Overrides (Priority: P3)

As a returning user, I want The Cab to be ready to remember assets I manually allow or hide later so my wallet view can stay consistent without removing trust messaging.

**Why this priority**: User-level override behavior matters, but the first delivery slice can succeed without persistence as long as the data model remains compatible with it.

**Independent Test**: Can be fully tested by reviewing the spec, API expectations, and persistence model to confirm that wallet-scoped and chain-scoped overrides can be added later without changing trust labels or collapsing chain identity.

**Acceptance Scenarios**:

1. **Given** a future stage adds manual visibility overrides, **When** a user allows or hides an asset, **Then** the preference is wallet-scoped and chain-scoped.
2. **Given** a user manually allows a low-confidence asset in a future stage, **When** the asset is shown, **Then** the asset still retains its trust label and explanation.
3. **Given** the first delivery slice does not persist manual overrides, **When** the feature is planned and implemented, **Then** the deferred scope is documented explicitly rather than implied.

### Edge Cases

- A provider flags a known protocol token as possible spam.
- Providers return no spam metadata for a wallet asset.
- A token has reliable price coverage but suspicious symbol or metadata signals.
- A token has no price but is a recognized protocol or pool-related asset.
- A wallet contains huge fake balances with no price or verified metadata.
- A wallet contains tiny dust balances with missing metadata.
- A token symbol impersonates a well-known asset.
- The token address is null, the native asset representation, or otherwise not a standard contract address.
- The same token address appears on different chains and must not share trust state.
- Hidden assets exist but all visible assets have zero priced value.
- Default portfolio value drops materially after exclusions.
- Provider trust signals change between refreshes.
- The user reveals hidden assets during the session.
- A future user override conflicts with the latest provider confidence signals.

## Requirements *(mandatory)*

### Stage Scope Constraint *(mandatory)*

- The current implementation stage for this feature directory is limited to the connected Overview recent view and its supporting internal API, coverage, localization, and asset filtering behavior.
- Pools, Deposits, Strategies, Rewards, Governance, Activity, and Settings reuse are out of scope for the first delivery slice except where this specification defines reusable trust semantics and response shapes for future adoption.
- Persistent user visibility overrides are follow-up scope unless later planning explicitly pulls them into the first delivery slice.

### Functional Requirements

#### 1) Feature Summary

- **FR-001**: The system MUST classify every wallet asset before that asset is displayed in the connected Overview or used in default portfolio totals.
- **FR-002**: The feature MUST introduce a confidence and visibility layer for wallet assets rather than a token-safety guarantee.
- **FR-003**: The connected Overview MUST hide suspicious or blocked assets by default while preserving an explicit inspection path for those assets.
- **FR-004**: The feature MUST keep trustworthy known protocol assets visible by default unless stronger evidence requires a more cautious treatment.
- **FR-005**: The feature MUST keep default portfolio totals, distribution views, and coverage messaging aligned with the same trust-filtering rules.

#### 2) Token Trust Classification

- **FR-006**: Every Overview asset row MUST include one trust status.
- **FR-007**: Every Overview asset row that is not fully trusted MUST include one or more trust reason codes explaining the classification signals.
- **FR-008**: Every Overview asset row MUST expose whether it is hidden by default.
- **FR-009**: The system MUST support at least the following trust statuses: `trusted`, `verified`, `known_protocol`, `priced`, `low_confidence`, `possible_spam`, `blocked`, and `unknown`.
- **FR-010**: The system MUST support at least the following trust reason codes: `moralisPossibleSpam`, `moralisVerifiedContract`, `alchemyMissingPrice`, `missingLogo`, `missingMetadata`, `suspiciousSymbol`, `zeroOrDustValue`, `unrecognizedContract`, `knownAerodromeToken`, `knownProtocolContract`, `hasReliablePrice`, `userHidden`, and `userAllowed`.
- **FR-011**: The system MUST apply the same trust classification outcome to both display behavior and default portfolio-value inclusion rules.
- **FR-012**: The system MUST define deterministic trust-classification behavior so the same wallet, chain, provider signals, and classifier version produce the same classification result.

#### 3) Provider Signal Normalization

- **FR-013**: The system SHOULD use Moralis token spam signals, including possible-spam indicators when available, as primary trust inputs.
- **FR-014**: The system SHOULD use available provider metadata and contract-verification signals when classifying wallet assets.
- **FR-015**: The system SHOULD use pricing availability as a valuation-confidence signal.
- **FR-016**: Missing price data MUST NOT be treated as proof that a token is spam.
- **FR-017**: Provider-specific trust inputs MUST be normalized into internal trust statuses and reason codes before they reach the frontend.
- **FR-018**: The frontend MUST consume only normalized trust outputs and MUST NOT depend on raw provider field names or provider-specific payload structure.
- **FR-019**: If provider trust signals are absent, the system MUST still classify assets using the remaining available metadata, pricing confidence, protocol knowledge, and dust heuristics without overstating certainty.

#### 4) Known Protocol Asset Recognition

- **FR-020**: The system MUST support explicit recognition of known protocol assets.
- **FR-021**: Known protocol recognition SHOULD use official protocol metadata, Aerodrome discovery, Mellow strategy metadata, configured chain metadata, and equivalent trusted internal sources.
- **FR-022**: The system MUST NOT rely only on a large static token allowlist.
- **FR-023**: The system MAY use a small chain-scoped bootstrap set of core protocol assets where needed.
- **FR-024**: Known protocol classification MUST be explicit in the response returned to the frontend.
- **FR-025**: A known protocol asset MUST NOT be hidden only because cosmetic metadata such as logo or display name is missing.
- **FR-026**: A known protocol asset without reliable pricing MAY remain visible, but its valuation and related totals MUST degrade coverage instead of fabricating value.
- **FR-027**: If a known protocol asset also receives suspicious provider signals, the resulting classification MUST preserve both the protocol relevance and the lower-confidence or hidden treatment so the conflict remains explainable.

#### 5) Default Filtering And Visibility

This section defines normative visibility and default-inclusion rules only. Response payload preservation is owned by the API Contract section, and reveal/render behavior is owned by the UI Behavior section.

- **FR-028**: Assets classified as `possible_spam` or `blocked` MUST be hidden from the default asset table.
- **FR-029**: Assets classified as `low_confidence` MAY be hidden by default when dust, missing pricing, suspicious metadata, or equivalent low-confidence signals make them unsuitable for default Overview presentation.
- **FR-030**: Assets classified as `trusted`, `verified`, `known_protocol`, or `priced` SHOULD remain visible by default unless a stronger documented hiding rule from the classifier decision table applies.
- **FR-031**: Hidden assets MUST remain available through an explicit reveal control such as a hidden-assets toggle or inspection view.
- **FR-032**: Hidden assets MUST NOT be silently deleted from internal responses or persistence.
- **FR-033**: When hidden assets are revealed, the UI MUST present them separately from default visible assets so the confident default view remains legible.
- **FR-034**: The product MUST indicate when hidden or excluded assets exist.

#### 6) Portfolio Totals, Distribution, And Coverage

- **FR-035**: Assets classified as `possible_spam` or `blocked` MUST be excluded from default portfolio totals.
- **FR-036**: Assets without reliable pricing MUST NOT receive fabricated USD value.
- **FR-037**: Assets with null or unreliable valuation MUST be excluded from confident totals that require priced value.
- **FR-038**: Distribution views MUST exclude hidden spam or blocked assets by default.
- **FR-039**: If assets are excluded from totals or distribution views because of trust or pricing rules, the affected Overview blocks MUST expose partial coverage or exclusion reason codes from a documented canonical trust-related coverage vocabulary.
- **FR-040**: Revealing hidden assets for inspection MUST NOT automatically merge those assets back into confident default totals unless an explicit supported rule says otherwise.
- **FR-041**: Coverage messaging MUST distinguish between excluded suspicious assets, visible unpriced assets, incomplete provider metadata, missing provider trust signals, dust-hidden assets, and other partial-confidence conditions using documented canonical trust-related coverage reason codes.
- **FR-042**: If hidden or unpriced assets change default confident totals, visible priced allocation, or the completeness of visible valuation under the classifier decision table, Overview MUST degrade the relevant coverage state rather than silently presenting a fully confident result.

#### 7) Overview API Contract

This section defines payload shape, preservation, and response metadata obligations. It does not redefine visibility policy or UI rendering behavior.

- **FR-043**: The internal Overview response MUST extend each asset row with trust status, trust reason codes, and hidden-by-default metadata.
- **FR-044**: The internal Overview response MUST contain enough information for the frontend to render visible assets, count hidden assets, reveal hidden assets intentionally, explain trust status, and keep default totals honest.
- **FR-045**: The response MUST preserve asset rows that are hidden by default so the frontend can inspect them without calling providers directly.
- **FR-046**: The response MUST expose whether Overview totals and distribution values exclude hidden or unpriced assets.
- **FR-047**: The response MUST expose coverage or exclusion metadata using canonical documented trust-related coverage reason codes when filtering or missing pricing reduces confidence in visible totals.
- **FR-048**: The browser MUST consume this feature only through internal application APIs and MUST NOT call Moralis or Alchemy directly.

#### 8) Persistence And Recomputability

- **FR-049**: The system SHOULD persist token trust classifications or enough normalized and recomputable trust inputs to reconstruct every `AssetTrustClassifierInput` field deterministically.
- **FR-050**: Stage 1 deterministic recomputation SHOULD be recoverable from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata or known-protocol lookup, or else the implementation MUST add a narrow normalized trust-input persistence surface. Persisted trust data SHOULD include wallet address, chain ID, token address, normalized provider trust signals, computed trust status, reason codes, timestamp, source provider context, and classifier version.
- **FR-051**: Persisted trust behavior MUST remain chain-scoped and wallet-scoped.
- **FR-052**: If user visibility overrides are implemented later, they MUST be keyed by wallet address, chain ID, and token address.
- **FR-053**: If user visibility overrides are deferred from the first delivery slice, the plan and tasks for this feature MUST treat them as explicit follow-up scope.
- **FR-054**: A future manual allow or hide preference MUST adjust visibility without removing the underlying trust label or reason explanation.

#### 9) UI Behavior And Explainability

This section defines rendering, reveal, localization, and explanation behavior only. Visibility policy remains server-owned, and payload preservation remains an API-contract concern.

- **FR-055**: The Overview asset table MUST hide suspicious assets by default.
- **FR-056**: Overview MUST show a localized notice when hidden or excluded assets exist.
- **FR-057**: Overview MUST provide an explicit control for revealing hidden assets.
- **FR-058**: Hidden assets MUST be visually separated from the normal visible asset set when revealed.
- **FR-059**: Trust labels MUST be localized.
- **FR-060**: Trust reason labels and explanation text MUST be localized.
- **FR-061**: The UI MUST avoid language that implies a token is definitively safe, verified safe, or guaranteed malicious.
- **FR-062**: Preferred user-facing trust states MUST align with the approved vocabulary of Trusted, Verified, Known protocol asset, Priced, Low confidence, Possible spam, Blocked, and Unknown, with careful Spanish equivalents.
- **FR-063**: The UI MUST explain that classifications are based on confidence signals, metadata quality, pricing confidence, protocol recognition, and provider indicators rather than a security guarantee.

#### 10) Localization And Formatting

- **FR-064**: All trust labels, reason labels, notices, filter controls, helper text, and exclusion messaging introduced by this feature MUST use i18n keys.
- **FR-065**: English and Spanish resources for this feature MUST preserve key parity.
- **FR-066**: No user-facing trust or filtering copy may be hardcoded in components or containers.
- **FR-067**: Any values shown in hidden-asset notices, totals, counts, or asset rows MUST continue using locale-aware formatting already established for Overview.
- **FR-068**: Translation coverage for this feature MUST fit the existing Overview, Coverage, Common, and any new trust-related namespace structure selected during planning.

#### 11) Security And Product Language

- **FR-069**: The feature MUST NOT claim that a token is definitely safe.
- **FR-070**: The feature MUST NOT claim that a token is definitely malicious unless a provider explicitly blocks or flags it, and even then the UI MUST frame that state as a provider-backed signal rather than a security guarantee.
- **FR-071**: The product MUST avoid encouraging users to interact with suspicious tokens.
- **FR-072**: The browser-facing experience MUST NOT expose raw provider error bodies or internal trust-scoring internals.
- **FR-073**: Trust classification MUST be presented as a confidence and visibility layer for portfolio analytics.

#### 12) Chain Awareness And Reuse

- **FR-074**: All trust classification MUST be chain-scoped.
- **FR-075**: The same token address on different chains MUST be treated as different assets with independent trust outcomes.
- **FR-076**: User visibility preferences, when added, MUST be keyed by wallet address, chain ID, and token address.
- **FR-077**: The trust-classification model defined here MUST be reusable by later Pools, Activity, Rewards, and Settings work without changing its chain-scoped identity rules.

#### 13) Design System And Architecture Boundaries

- **FR-078**: Trust badges, hidden-asset notices, and asset filter controls MUST reuse or extend the existing The Cab design system instead of introducing raw third-party UI directly into feature surfaces.
- **FR-079**: The feature MUST follow the repo pattern in which container files own data orchestration, filtering state, and future preference interactions while component files receive props and render presentational output only.
- **FR-080**: The feature MUST preserve the existing Overview recent-view foundation and extend it rather than replacing provider ownership, coverage semantics, or server-owned API boundaries.
- **FR-081**: The first delivery slice MUST remain implementable without requiring simultaneous delivery of protocol-specific detail pages.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower tone, avoid hype or fear-based language, and frame trust classification as measured confidence rather than alarmism.
- **CA-002 Localization**: Feature MUST define translation impact for trust states, trust reasons, hidden-asset notices, controls, and explanations, with no hardcoded user-facing copy.
- **CA-003 Localization Formatting**: Feature MUST preserve locale-aware formatting for counts, balances, currency values, percentages, dates, and hidden-asset summaries where shown.
- **CA-004 Chain Awareness**: Feature MUST define `chainId` handling across asset identity, trust classification, API contracts, persistence, and future user preferences.
- **CA-005 Provider Boundaries**: Feature MUST keep Moralis and Alchemy usage server-side only and normalize provider trust signals into internal trust outputs before the frontend consumes them.
- **CA-006 Explainability**: Feature MUST describe how hidden assets, excluded values, pricing gaps, signal conflicts, and partial-confidence totals are surfaced honestly to the user.

### Key Entities *(include if feature involves data)*

- **Token Trust Classification**: A chain-scoped classification outcome for one wallet asset that records trust status, trust reasons, default visibility, and the confidence logic used for presentation and totals.
- **Wallet Asset Row**: A wallet-scoped asset representation used by Overview, including token identity, balance, valuation fields, activity classification, trust classification, and visibility behavior.
- **Hidden Asset Summary**: An Overview-level summary that reports how many assets were excluded from the default view and why they affect confidence in totals or distribution.
- **Trust Signal Snapshot**: A normalized, recomputable record of provider trust inputs, metadata completeness, pricing confidence, protocol recognition, and classifier version for a wallet asset at a point in time.
- **User Asset Visibility Preference**: A future wallet-scoped and chain-scoped preference that can keep an asset always shown, always hidden, or at default visibility without removing the asset’s trust label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In test wallets containing assets classified as `possible_spam` or `blocked`, 100% of those assets are excluded from the default Overview asset table.
- **SC-002**: In wallets containing hidden or excluded assets, the Overview screen always communicates that exclusions exist and provides an explicit path to inspect them.
- **SC-003**: 100% of asset rows returned by the Overview API include a trust status, and every non-trusted row includes at least one reason code.
- **SC-004**: Default Overview totals never include assets classified as `possible_spam` or `blocked`, and never assign fabricated USD value to assets without reliable pricing.
- **SC-005**: Known protocol assets with incomplete cosmetic metadata remain visible by default in all validation scenarios unless stronger hiding evidence applies.
- **SC-006**: All trust labels, trust reasons, notices, and controls introduced by this feature are available in English and Spanish with matching translation structure.
- **SC-007**: The browser continues to consume only internal application APIs for this feature and never calls Moralis or Alchemy directly.
- **SC-008**: The trust-classification model can be reused by later wallet-facing sections without changing wallet-scoped and chain-scoped asset identity.

## Assumptions

- The first delivery slice applies to fungible wallet asset rows already used in the connected Overview recent view and does not expand scope to NFT asset rows unless that table already includes them.
- Moralis and Alchemy provider signals may be incomplete, inconsistent, or change over time, so classifications must remain explainable and recomputable rather than permanent truth statements.
- Existing protocol metadata work for Aerodrome, Mellow, and chain configuration can be used to recognize known protocol assets without turning this feature into a static global token allowlist.
- If user-level visibility persistence is not implemented in the first delivery slice, session-only reveal behavior is acceptable as long as the deferred persistence model remains explicit and chain-scoped.
- Revealing hidden assets is an inspection action only and does not change confident portfolio totals unless a later supported preference or override flow explicitly says otherwise.
- The connected Overview remains the only required delivery surface for this feature in the first slice, but the trust model is intentionally designed for later reuse across other analytics sections.
