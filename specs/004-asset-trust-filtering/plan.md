# Implementation Plan: Wallet Asset Trust Filtering

**Branch**: `004-asset-trust-filtering` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-asset-trust-filtering/spec.md`

## Summary

Extend the existing connected `/overview` recent-view pipeline with a backend-owned wallet asset trust classifier that consumes normalized internal trust inputs derived from persisted or recomputable provider data. Moralis trust signals, Alchemy price confidence, known protocol recognition, and dust heuristics are first normalized into internal trust-input metadata backed by `RawProviderRecord`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata before classification runs. Stage 1 keeps the existing Overview architecture intact: `getRecentOverview()` still owns response composition, but now returns trust-annotated asset rows, prefiltered default totals and distribution, hidden-asset summary metadata, and canonical trust-related coverage or exclusion reason codes. Hidden assets remain in the internal API payload for inspection, while frontend state only controls reveal or hide presentation during the session; it does not compute trust or totals.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Next.js, TanStack Query 5.x, wagmi 3.x, WalletConnect connectors, i18next/react-i18next, Drizzle ORM, pg, Tamagui 2.0.0-rc.42, Zod 4.x  
**Storage**: PostgreSQL via Drizzle ORM using existing `raw_provider_records`, `price_points`, `coverage_reports`, `portfolio_snapshots`, `wallet_contexts`, and optionally `protocol_contracts` for known protocol recognition  
**Testing**: ESLint 9, TypeScript `tsc --noEmit`, Next.js build, `pnpm i18n:check`, focused Overview route/service validation, provider smoke validation using a syntactically valid wallet address  
**Target Platform**: Web application on Next.js App Router with server-side internal APIs only  
**Project Type**: Full-stack web application feature inside `apps/web`  
**Performance Goals**: Preserve the current fast connected Overview response path; add trust classification without introducing request-time RPC reconstruction or client-side provider fan-out  
**Constraints**: Stage 1 only; backend computes trust classification and filtered totals from normalized internal trust inputs rather than raw provider payloads; hidden assets stay in payload; missing Alchemy price degrades valuation confidence but is not spam proof; no browser-direct Moralis or Alchemy calls; no persistent user visibility overrides in this stage; no hardcoded user-facing copy  
**Scale/Scope**: One existing connected route (`/overview`), one existing Overview API (`/api/wallet/overview`), one new server-side asset-trust module, Overview response/type extensions, DS/i18n additions for trust badges and hidden-asset reveal state

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: **PASS**. Trust filtering is framed as confidence and visibility, not security theater or alarmist copy; the UI remains a control-tower inspection surface.
- Localization gate: **PASS**. Stage 1 adds trust labels, reason labels, hidden-asset notices, reveal controls, and exclusion messaging with EN/ES parity and no hardcoded copy.
- Chain-awareness gate: **PASS**. Trust identity remains `walletAddress + chainId + tokenAddress`; query keys and API contracts remain chain-scoped through existing Overview paths.
- Provider/API gate: **PASS**. Moralis remains the primary trust-signal source, Alchemy remains valuation-only for this feature, provider responses are normalized and persisted or made recomputable before classification, and frontend-facing routes read only internal normalized trust outputs.
- Explainability gate: **PASS**. Hidden or excluded assets remain in the response, coverage reasons use canonical documented codes, and Stage 1 requires that classifier inputs remain recoverable from persisted or recomputable internal metadata plus classifier versioning.

## Project Structure

### Documentation (this feature)

```text
specs/004-asset-trust-filtering/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── overview-asset-trust-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── wallet/
│   │           └── overview/
│   │               └── route.ts                 # extend Overview contract only
│   ├── features/
│   │   └── overview/
│   │       ├── Overview.container.tsx          # add session-only reveal state
│   │       ├── Overview.component.tsx          # render visible/hidden groups and trust UI
│   │       ├── overview.mappers.ts             # extend response/view-model mapping only
│   │       ├── overview.queries.ts
│   │       └── overview.types.ts               # extend Overview asset/view-model types
│   ├── design-system/
│   │   ├── data-display/
│   │   ├── feedback/
│   │   └── primitives/
│   │       ├── CabBadge.tsx                    # reuse for trust badge tones
│   │       └── CabTooltip.tsx                  # reuse for trust reasons/help text
│   ├── i18n/
│   │   ├── config.ts                           # register trust namespace if added
│   │   └── locales/
│   │       ├── en/
│   │       │   ├── overview.json
│   │       │   ├── coverage.json
│   │       │   └── trust.json                  # likely new
│   │       └── es/
│   │           ├── overview.json
│   │           ├── coverage.json
│   │           └── trust.json                  # likely new
│   ├── server/
│   │   ├── asset-trust/
│   │   │   ├── assetTrust.types.ts            # to be added
│   │   │   ├── assetTrust.reasonCodes.ts      # to be added
│   │   │   ├── classifyWalletAssetTrust.ts    # to be added
│   │   │   └── knownProtocolAssets.ts         # to be added
│   │   ├── overview/
│   │   │   ├── getRecentOverview.ts           # hydrate normalized trust inputs + integrate trust classification
│   │   │   ├── overview.repository.ts         # normalized trust-input hydration/persistence helpers
│   │   │   └── overview.types.ts              # extend API response types
│   │   ├── providers/
│   │   │   ├── moralis/
│   │   │   └── alchemy/
│   │   └── db/
│   │       └── schema.ts                      # unchanged in preferred Stage 1 path
│   └── queries/
│       ├── hooks.ts
│       └── keys.ts
└── scripts/
    └── check-i18n-parity.ts
```

**Structure Decision**: Extend the existing `apps/web` Overview vertical slice rather than creating a new feature pipeline. Add one server-owned `src/server/asset-trust` module for normalized trust computation, then thread its outputs through the existing Overview types, route, query hook, and container/component pair. In Stage 1, Overview may still classify during request handling, but only after hydrating normalized internal trust inputs from persisted or recomputable sources. Prefer reusing existing schema tables and metadata JSON fields in Stage 1 rather than introducing a dedicated trust table or user-preference table.

## Phase 0: Outline & Research

Research completed for:

1. **Classifier placement**: keep trust classification server-side in a dedicated `src/server/asset-trust` module and invoke it from `getRecentOverview()` only after hydrating normalized internal trust inputs from persisted or recomputable metadata.
2. **Provider normalization**: use Moralis `possible_spam`, `verified_contract`, metadata completeness, and native-token hints as primary trust inputs; use Alchemy current-price availability as valuation confidence only; and normalize those signals into persisted or recomputable `AssetTrustClassifierInput` fields before classification.
3. **Known protocol recognition**: derive trust-safe allow signals from chain config, a small chain-scoped bootstrap asset set, and existing `protocol_contracts`/protocol metadata when available; avoid request-time RPC and avoid a large static global allowlist.
4. **Contract extension strategy**: keep the Overview API shape intact by extending `OverviewAssetRow`, `OverviewAssets`, `OverviewMetrics`, `OverviewDistribution`, and coverage reason codes rather than replacing the Overview block structure, and document a canonical `OverviewTrustCoverageReasonCode` vocabulary for trust-related exclusion and coverage messaging.
5. **Persistence boundary**: prefer recomputation from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata in Stage 1, while recording trust summary and classifier version inside existing metadata JSON fields when useful. If those surfaces cannot reconstruct every `AssetTrustClassifierInput` field, add a narrow normalized trust-input persistence addition.
6. **Reveal behavior**: keep hidden assets in the API payload, use session-only reveal state in `Overview.container.tsx`, and separate hidden inspection rows from visible rows in the UI.
7. **Validation gates**: enforce server-only provider access, trust-field normalization before frontend use, route-level sanitization of provider and classifier internals, `pnpm i18n:check`, and targeted code searches for raw provider imports and hardcoded copy.

Output is captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design outputs in this phase:

1. **Data model** for trust-classifier inputs, trust-classified asset rows, hidden-asset summary, exclusion-aware totals/distribution, and deferred user override compatibility in [data-model.md](./data-model.md).
2. **Contract** for the Overview asset-trust response extensions in [contracts/overview-asset-trust-contract.md](./contracts/overview-asset-trust-contract.md).
3. **Quickstart** for implementation sequencing and validation in [quickstart.md](./quickstart.md).
4. **Agent context update** in `.github/copilot-instructions.md` to point planning-aware agents to this feature plan.

Post-design constitution re-check:

- Brand consistency gate: **PASS**
- Localization gate: **PASS**
- Chain-awareness gate: **PASS**
- Provider/API gate: **PASS**
- Explainability gate: **PASS**

## Phase 2: Implementation Planning Approach

Execution sequence for `/speckit.tasks`:

1. **Introduce the server trust model**
  - Add `assetTrust.types.ts`, `assetTrust.reasonCodes.ts`, `knownProtocolAssets.ts`, and `classifyWalletAssetTrust.ts`.
  - Define `TokenTrustReasonCode`, `OverviewTrustCoverageReasonCode`, and trust-to-translation-key mapping expectations for trust and coverage copy.
  - Normalize classifier inputs from persisted or recomputable internal trust metadata derived from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, known protocol recognition, and dust heuristics.
  - Define precedence rules through a documented classifier decision table so stronger caution wins for visibility while reason codes preserve conflicts such as `known_protocol` plus `possible_spam`.
2. **Extend Overview server types and contract**
  - Extend `OverviewAssetRow` with `name`, `chainId`, `trustStatus`, `trustReasonCodes`, `isHiddenByDefault`, and `classifierVersion` if retained in the response.
  - Extend `OverviewAssets` with `hiddenSummary` and any block-level visible/hidden counts needed by the frontend.
  - Extend `OverviewMetrics`, `OverviewDistribution`, and trust-affected coverage fields with canonical `OverviewTrustCoverageReasonCode` usage rather than replacing the current block shape.
3. **Integrate trust classification into `getRecentOverview()`**
  - Hydrate or derive normalized `AssetTrustClassifierInput` values from persisted or recomputable internal trust-input sources before classification runs.
  - Classify every asset row on the server after normalized trust inputs are assembled and before totals/distribution are computed.
  - Preserve all rows in `assets.rows`, but compute visible subsets, hidden summaries, filtered totals, and filtered distribution server-side.
  - Extend coverage reason code generation for excluded suspicious assets, low-confidence hidden assets, missing prices, visible unpriced assets, signal conflicts, hidden-asset presence, missing trust signals, metadata incompleteness, dust-hidden assets, and valuation partial states using canonical documented codes.
4. **Known protocol recognition without request-time RPC**
  - Add a chain-scoped bootstrap helper for core Base assets already trusted by product context.
  - Read `protocol_contracts` or equivalent synced metadata when available to mark known Aerodrome/Mellow assets explicitly.
  - Keep the helper deterministic and chain-scoped.
5. **Persistence and recompute strategy**
  - Keep `RawProviderRecord.payloadJson` and `PricePoint` as the primary truth for trust recomputation, with `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata filling the remaining classifier-input fields.
  - Verify that every `AssetTrustClassifierInput` field is recoverable from those surfaces; if not, add a narrow normalized trust-input persistence addition rather than a broad new trust table.
  - Record classifier version and exclusion summary inside `coverage_reports.metadataJson` and `portfolio_snapshots.metadataJson` where useful for auditability.
  - Defer any dedicated `TrustSignalSnapshot` table unless implementation proves the existing metadata fields are insufficient.
6. **Frontend reveal and inspection state**
  - Add a session-only `showHiddenAssets` state in `Overview.container.tsx`.
  - Render visible assets by default and a separate hidden-assets inspection group when toggled on.
  - Reuse or extend DS primitives for trust badges, helper tooltips, hidden-assets notices, and grouped inspection rows.
7. **Localization and copy wiring**
  - Add EN/ES trust labels, trust reason labels, helper copy, reveal/hide controls, and exclusion notices.
  - Extend `coverage` reasons for canonical trust-related exclusion semantics and `overview` copy for hidden-asset summaries.
  - Keep a documented mapping of trust or coverage reason code to translation key so API vocabulary and i18n resources stay aligned.
  - Add a dedicated `trust` namespace if it reduces cross-feature duplication; otherwise extend existing Overview/Coverage namespaces consistently.
8. **Validation and hardening**
  - Validate edge cases: known protocol token flagged by provider, missing spam metadata, suspicious symbol with price, known protocol token without price, huge fake unpriced balance, native asset handling, visible total zero with hidden assets present, session reveal behavior, and trust-signal changes across refreshes.
  - Run `pnpm i18n:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
  - Add focused boundary checks so browser code never imports `src/server/providers/*`, frontend components never use raw provider field names like `possible_spam`, `/api/wallet/overview` never returns raw provider bodies or trust-internal scoring details, and 100% of returned asset rows include `trustStatus`, `trustReasonCodes`, and `isHiddenByDefault`.

Delivery boundaries:

- Included: server-side trust classification, trust-aware Overview asset rows, hidden asset summary, filtered default totals and distribution, coverage/exclusion metadata, session-only reveal state, EN/ES localization, and design-system trust UI additions needed for Overview.
- Excluded: persistent user visibility overrides, Pools/Deposits/Strategies/Rewards/Governance/Activity integration, NFT spam filtering, request-time RPC for trust classification, new pricing providers, or a rewrite of the connected Overview architecture.

## Complexity Tracking

No constitution violations requiring exception tracking.

