# Quickstart: Wallet Asset Trust Filtering

## Objective

Implement Stage 1 wallet asset trust filtering on top of the existing connected Overview recent-view flow. The goal is to classify wallet assets on the backend from normalized internal trust inputs derived from persisted or recomputable provider data, exclude suspicious assets from default totals, keep hidden rows in the API response, and add a session-only hidden-asset inspection path in the Overview UI.

## Scope Guardrails

Included in this stage:

- Overview recent-view only
- Internal Overview API extension
- Server-side trust classifier
- Default filtering for suspicious/blocked assets
- Hidden asset inspection/reveal state
- Trust-aware metrics and distribution
- Coverage and exclusion metadata
- EN/ES localization

Explicitly excluded in this stage:

- Pools, Deposits, Strategies, Rewards, Governance, Activity, and Settings integration
- NFT spam filtering
- Persistent user visibility overrides
- Request-time RPC contract verification
- Any rewrite of the existing Overview route, query, or app-shell architecture

## Prerequisites

- Workspace root: `/Users/core/Code/The Cab`
- App path: `apps/web`
- Branch: `004-asset-trust-filtering`
- Existing Overview recent-view implementation from feature `003-connected-wallet-overview`
- Server-only environment configured in `apps/web/.env.local`:
  - `MORALIS_API_KEY`
  - `ALCHEMY_API_KEY`
  - `ALCHEMY_BASE_RPC_URL`
  - `DATABASE_URL`

## Milestone A: Add The Trust Model On The Server

1. Add `src/server/asset-trust/assetTrust.types.ts`.
2. Add `src/server/asset-trust/assetTrust.reasonCodes.ts`.
3. Add `src/server/asset-trust/knownProtocolAssets.ts`.
4. Add `src/server/asset-trust/classifyWalletAssetTrust.ts`.
5. Define deterministic status precedence, canonical `OverviewTrustCoverageReasonCode` values, trust or coverage reason-to-translation-key mapping expectations, dust heuristics, known-protocol recognition, and classifier versioning.
6. Document or implement the classifier decision table so visibility, totals inclusion, and coverage degradation rules are measurable.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`

## Milestone B: Extend Overview Response Types And Service Logic

1. Extend `src/server/overview/overview.types.ts` and `src/features/overview/overview.types.ts` with trust fields and hidden summary metadata.
2. Update `getRecentOverview()` to:
   - hydrate or derive normalized `AssetTrustClassifierInput` values from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata;
   - classify every asset row on the server from those normalized internal inputs;
   - keep all rows in the payload;
   - compute default visible subsets, hidden summary, and filtered totals/distribution;
   - extend coverage reason codes for exclusions and missing prices using canonical documented codes.
3. Verify that existing persistence can reconstruct every `AssetTrustClassifierInput` field; update `overview.repository.ts` only if helpers are needed for trust-input hydration, classifier version, exclusion summary, or a narrow normalized trust-input persistence addition.
4. Keep route validation and error-code behavior stable in `/api/wallet/overview`.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`

## Milestone C: Add Overview Reveal UX And Trust Presentation

1. Add session-only reveal state in `Overview.container.tsx`.
2. Update `Overview.component.tsx` to:
   - render visible assets by default;
   - show hidden-asset notice and reveal control;
   - render hidden rows in a separate inspection group;
   - show trust badges and trust-reason helper text.
3. Reuse or extend DS primitives with minimal new UI surface. Prefer existing `CabBadge`, `CabTooltip`, and `CabPartialCoverageNotice` before adding new wrappers.

Checkpoint commands:

- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`
- `cd apps/web && pnpm build`

## Milestone D: Localization, Coverage Copy, And Final Validation

1. Add EN/ES trust copy in a new `trust` namespace or an approved equivalent.
2. Extend `overview` and `coverage` keys for hidden-asset notices, reveal controls, and exclusion reasons.
3. Register any new namespace in `src/i18n/config.ts`.
4. Validate no hardcoded trust/filtering copy appears in components or containers.

Checkpoint commands:

- `cd apps/web && pnpm i18n:check`
- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`
- `cd apps/web && pnpm build`

## Focused Validation Checks

1. **Provider boundary check**
   - Verify frontend code still calls only internal APIs and query hooks.
   - Suggested search: `rg "@/server/providers|moralis|alchemy" apps/web/src/features apps/web/src/app --glob '!**/api/**'`
2. **No hardcoded copy check**
   - Run `pnpm i18n:check`.
   - Review changed Overview/DS files for new JSX string literals.
3. **Trust contract check**
   - Confirm 100% of returned asset rows include `trustStatus`, `trustReasonCodes`, and `isHiddenByDefault`.
   - Confirm hidden assets remain in `assets.rows`.
4. **Totals integrity check**
   - Confirm `possible_spam` and `blocked` assets do not contribute to default totals or distribution.
   - Confirm visible but unpriced assets keep `valueUsd = null` and degrade coverage.
5. **Deterministic recomputation check**
   - Confirm every `AssetTrustClassifierInput` field is recoverable from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata, or else add a narrow normalized trust-input persistence change.
6. **Route sanitization check**
   - Confirm `/api/wallet/overview` never returns raw provider response bodies, raw provider error bodies, or trust-internal scoring details to the browser.

## Important Edge Cases To Validate

- Known protocol token flagged by provider as possible spam
- No provider spam metadata present
- Token has reliable price but suspicious symbol
- Token has no price but is a known protocol asset
- Huge fake balance with no price
- Dust token with missing metadata
- Native asset representation
- Same token address on different chains
- Hidden assets exist but visible total is zero
- User reveals hidden assets during the session
- Provider trust signals change between refreshes

## Non-Goals Reminder

- Do not turn this into a security or token-safety feature.
- Do not push filtering logic into the frontend as the source of truth.
- Do not introduce persistent user visibility preferences in this stage.
- Do not add CoinGecko or any other pricing provider.
- Do not remove hidden rows from the Overview payload.
