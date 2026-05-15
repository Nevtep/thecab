# Research: Wallet Asset Trust Filtering

## Decision 1: Keep Trust Classification In A Dedicated Server Module

- **Decision**: Implement Stage 1 trust classification in `apps/web/src/server/asset-trust/` and invoke it from `getRecentOverview()` only after the service has hydrated normalized internal trust inputs from persisted or recomputable sources such as `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata.
- **Rationale**: The user explicitly wants classification and filtered totals computed on the backend, not as a frontend-only filter. The constitution also requires feature APIs to read normalized data from persistence. A dedicated module keeps provider normalization, precedence rules, and classifier versioning separate from route validation and UI view-model logic.
- **Alternatives considered**:
  - Performing classification in `Overview.container.tsx`.
    - Rejected because it would make the browser responsible for confidence logic, violate the provider-boundary intent, and risk divergent totals.
  - Embedding classification inline inside `getRecentOverview()` without a separate module.
    - Rejected because the trust logic needs to be reusable by future wallet-facing sections and easier to test in isolation.

## Decision 2: Normalize Moralis Signals Into Internal Trust Inputs And Treat Alchemy Price As Valuation Confidence Only

- **Decision**: Use Moralis `possible_spam`, `verified_contract`, metadata completeness, logo presence, and native-token flags as primary trust inputs, and use Alchemy current-price availability only to decide valuation confidence and partial coverage. Normalize those provider signals into an internal `AssetTrustClassifierInput` shape backed by persisted or recomputable metadata before classification; do not classify directly from raw provider payloads in the Overview response path.
- **Rationale**: The feature is a confidence and visibility layer, not an anti-malware engine. Missing Alchemy price is explicitly not proof of spam, but it does affect whether Overview can compute confident USD totals. Normalizing before classification keeps the Overview request path constitution-compliant.
- **Alternatives considered**:
  - Escalating all unpriced tokens to `possible_spam`.
    - Rejected because it conflicts with the spec and would incorrectly hide long-tail legitimate assets.
  - Ignoring Alchemy price availability in trust classification entirely.
    - Rejected because price availability still matters for whether an asset is suitable for confident totals and whether a low-confidence dust asset should be hidden.

## Decision 3: Preserve All Asset Rows In The API And Filter Totals Server-Side

- **Decision**: Keep all asset rows in the Overview response, extend each row with normalized trust fields, and compute default-visible subsets, hidden summaries, metrics, and distribution server-side before returning the payload.
- **Rationale**: This satisfies two non-negotiables at once: hidden assets remain inspectable without another provider request, and default totals stay honest because the backend owns the exclusion rules.
- **Alternatives considered**:
  - Returning only visible rows and forcing the frontend to refetch hidden assets later.
    - Rejected because it deletes relevant data from the payload and complicates explanation and reveal behavior.
  - Returning all rows but letting the frontend recompute totals after filtering.
    - Rejected because it would create a frontend-only trust filter and risk inconsistent totals.

## Decision 4: Recognize Known Protocol Assets From Chain-Scoped Metadata, Not A Large Static Allowlist

- **Decision**: Use a small chain-scoped bootstrap set for core Base assets plus existing protocol metadata (`protocol_contracts` and already known Aerodrome/Mellow addresses) to mark known protocol assets. Do not add request-time RPC or a large static allowlist in Stage 1.
- **Rationale**: The spec wants explicit known-protocol classification without turning Stage 1 into a protocol-sync project. The current code already has Base chain config and protocol metadata tables, which is enough to support a deterministic helper.
- **Alternatives considered**:
  - A large hardcoded global token allowlist.
    - Rejected because it does not scale, is hard to audit, and conflicts with the product direction.
  - Request-time contract reads to verify every token.
    - Rejected because it would slow the recent Overview path and exceed Stage 1 scope.

## Decision 5: Prefer Recompute-First Persistence In Stage 1

- **Decision**: Do not introduce a dedicated trust-classification table or persistent user-visibility-preference table in Stage 1. Recompute trust deterministically from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata, and optionally store trust summary plus classifier version in existing metadata JSON fields.
- **Rationale**: Stage 1 can stay focused on Overview behavior without adding migrations that only become necessary once trust state needs to be queried independently across product sections. The implementation must still verify that those existing surfaces can reconstruct every `AssetTrustClassifierInput` field; if not, the acceptable fallback is a narrow normalized trust-input persistence addition rather than a broad new trust table.
- **Alternatives considered**:
  - Adding a new `trust_signal_snapshots` table immediately.
    - Rejected because it increases migration and repository scope before the first consumer proves it is necessary.
  - Storing nothing about classifier version or exclusions.
    - Rejected because some auditability is still useful when provider signals change between refreshes.

## Decision 6: Keep Hidden-Asset Reveal As Session-Only UI State In Stage 1

- **Decision**: Implement reveal/hide behavior as local session state in `Overview.container.tsx`, with the response already containing all rows and summary counts needed to render the separate hidden-assets inspection state.
- **Rationale**: The spec explicitly allows session-only reveal behavior in Stage 1 and defers persistence of manual overrides. This keeps the first slice small while still proving the product behavior.
- **Alternatives considered**:
  - Persisting manual `always_show` / `always_hide` preferences now.
    - Rejected because the user asked to keep preference persistence out of Stage 1 unless it already existed, and it does not.
  - Omitting reveal behavior and showing only a hidden-asset count.
    - Rejected because the user story requires explicit inspection and explanation.

## Decision 7: Add A Dedicated `trust` Localization Namespace For Reuse

- **Decision**: Add a new `trust` namespace for trust statuses, reason labels, explanatory helper copy, and reusable confidence-language strings, while keeping Overview-specific notices and controls in `overview` and block-level exclusion reasons in `coverage`.
- **Rationale**: Trust labels and reason codes are cross-feature concepts that should be reusable later in Pools, Activity, Rewards, and Settings. A dedicated namespace avoids overloading Overview copy with shared semantics.
- **Alternatives considered**:
  - Placing all trust copy in `overview.json`.
    - Rejected because it would make later reuse awkward and blur feature-specific and shared trust terminology.
  - Putting all exclusion and trust copy in `coverage.json`.
    - Rejected because coverage reasons and trust reasons are related but not identical concepts.

## Decision 8: Stronger Caution Wins For Visibility, But Conflicts Stay Explainable

- **Decision**: When a known protocol asset also receives a suspicious provider signal, the classifier should keep the stronger caution outcome for default visibility while preserving protocol-related reason codes in the row.
- **Rationale**: The feature must not pretend a provider spam flag is irrelevant, but it also must not erase evidence that the asset is protocol-relevant. This gives users an honest explanation path for rare but important conflicts.
- **Alternatives considered**:
  - Always making known protocol status override provider caution.
    - Rejected because it risks surfacing assets the providers themselves consider suspicious.
  - Always dropping known-protocol reason codes when spam-like signals exist.
    - Rejected because it hides important context from the inspection view.

## Decision 9: Use A Canonical Trust-Related Coverage And Exclusion Vocabulary

- **Decision**: Define a canonical `OverviewTrustCoverageReasonCode` vocabulary for all trust-related exclusion and coverage messaging owned by this feature: `excludedSuspiciousAssets`, `lowConfidenceAssetsHidden`, `missingPrices`, `visibleUnpricedAssets`, `hiddenAssetsPresent`, `knownProtocolSignalConflict`, `providerTrustSignalsMissing`, `metadataIncomplete`, `dustAssetsHidden`, and `valuationPartial`.
- **Rationale**: The contract examples already depend on trust-related coverage reasons, but leaving them as generic strings invites drift across backend, mappers, and i18n resources. A documented enum keeps API outputs, UI messaging, and translation mapping aligned.
- **Alternatives considered**:
  - Leaving trust-related coverage fields as generic `string[]`.
    - Rejected because it makes contract validation and localization drift-prone.
  - Reusing raw provider reason names directly in coverage fields.
    - Rejected because coverage messaging and provider normalization are distinct concerns.

## Decision 10: Document The Classifier Decision Table Explicitly

- **Decision**: Stage 1 will use a documented classifier decision table instead of vague language such as stronger evidence, stronger hiding rule, or materially affect completeness.
- **Rationale**: The implementation needs measurable boundaries for visibility, totals inclusion, and coverage degradation so backend, UI, and localization stay consistent.

| Condition | Trust Outcome | Hidden By Default | Default Totals | Coverage / Exclusion Codes |
|---|---|---|---|---|
| Provider spam or blocked signal | `possible_spam` or `blocked` | Yes | Excluded | `excludedSuspiciousAssets` |
| Known protocol plus provider spam conflict | Caution outcome wins; preserve known-protocol reason code | Yes | Excluded | `excludedSuspiciousAssets`, `knownProtocolSignalConflict` |
| Known protocol plus missing logo | `known_protocol` | No | Included when reliably priced | None from logo alone |
| Known protocol plus missing price | `known_protocol` | No | Excluded from priced totals; `valueUsd = null` | `missingPrices`, `valuationPartial` |
| Verified contract plus reliable Alchemy price | `verified` or `priced` | No | Included | None unless another visible-asset coverage condition applies |
| Reliable Alchemy price with no spam signal | `priced` | No | Included | None unless another visible-asset coverage condition applies |
| Dust plus missing metadata plus missing price | `low_confidence` | Yes | Excluded | `lowConfidenceAssetsHidden`, `dustAssetsHidden`, `metadataIncomplete`, `missingPrices` |
| Missing provider spam metadata plus missing price | `unknown` or `low_confidence` depending on metadata, dust, and suspicious symbol | Policy-driven | Excluded from priced totals when unpriced | `providerTrustSignalsMissing`, `missingPrices`, `valuationPartial` as applicable |

- **Rule note**: Missing Alchemy price is always a valuation-confidence issue, not proof of spam.
