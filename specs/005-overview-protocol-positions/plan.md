# Implementation Plan: Overview Protocol Positions

**Branch**: `005-overview-protocol-positions` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-overview-protocol-positions/spec.md`

## Summary

Extend the existing connected `/overview` recent-view pipeline so it can return a dedicated protocol-positions block alongside wallet assets, using a bounded current-state reconstruction slice only when direct discovery is insufficient. Stage 1 keeps `/api/wallet/overview` as the sole browser-facing contract and threads chain-scoped protocol-position identities, honest coverage states, partial or estimated current-value handling, and persisted explainability evidence through the current Overview route, server aggregator, query hook, mapper, and component stack. Manual Aerodrome concentrated-liquidity positions, Mellow strategy exposure, and governance locks are in scope; one-year historical reconstruction, lifecycle analytics, detail pages, and generic NFT portfolio support are explicitly out of scope.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Next.js, TanStack Query 5.x, wagmi 3.x, i18next/react-i18next, Drizzle ORM, pg, Zod 4.x, viem, existing Moralis and Alchemy provider modules  
**Storage**: PostgreSQL via Drizzle using existing `raw_provider_records`, `coverage_reports`, `portfolio_snapshots`, `price_points`, `wallet_contexts`, and `protocol_contracts`, with metadata-first persistence preferred over new tables in Stage 1  
**Testing**: ESLint 9, TypeScript `tsc --noEmit`, Next.js build, `pnpm i18n:check`, focused Overview route and service validation, code search for provider-boundary regressions  
**Target Platform**: Full-stack web application inside `apps/web`, with server-side internal APIs only  
**Project Type**: Feature extension of an existing Next.js App Router product surface  
**Performance Goals**: Preserve the fast connected Overview request path, avoid turning `/api/wallet/overview` into a long-running one-year analysis workflow, and keep bounded reconstruction scoped to current-state confirmation within a recent 30-day window  
**Constraints**: Base mainnet only for product v1; no browser-direct provider calls; no new browser-facing provider contract; no fabricated USD values; unrelated NFTs must stay out of protocol positions unless positively classified; product copy must stay in `overview` with shared coverage labels allowed in `coverage`; bounded reconstruction must never exceed 30 days for this feature  
**Scale/Scope**: One existing page route (`/overview`), one existing internal API (`/api/wallet/overview`), the current Overview server aggregator, current Overview frontend vertical slice, EN/ES locale resources, and narrowly scoped protocol-position detection or reconstruction helpers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: **PASS**. The feature adds a clearer control-tower view of deployed and locked capital without introducing hype or retail-style language. Protocol positions remain technical, explicit, and separate from wallet inventory.
- Localization gate: **PASS**. All new labels, headings, helper copy, and coverage states remain translation-key driven with EN/ES parity. Product-specific copy stays in `overview`; shared coverage-state wording may remain in `coverage`.
- Chain-awareness gate: **PASS**. Protocol-position identities, API response types, persistence metadata, and query keys remain chain-scoped and continue to require `chainId` and `walletAddress`.
- Provider/API gate: **PASS**. Moralis remains wallet-centric discovery, Alchemy remains valuation support, RPC or contract reads remain backend-only and bounded to current-state confirmation, and the browser continues to consume only `/api/wallet/overview`.
- Explainability gate: **PASS**. Stage 1 requires raw provider or RPC evidence, or enough normalized metadata, to be persisted so visible protocol-position rows and partial valuation states remain auditable and reclassifiable.

## Project Structure

### Documentation (this feature)

```text
specs/005-overview-protocol-positions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── overview-protocol-positions-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── wallet/
│   │   │       └── overview/
│   │   │           └── route.ts                      # extend existing contract only
│   │   └── overview/
│   │       └── page.tsx                              # unchanged entry surface
│   ├── features/
│   │   └── overview/
│   │       ├── Overview.container.tsx               # add protocol-position state wiring
│   │       ├── Overview.component.tsx               # render dedicated protocol-positions block
│   │       ├── overview.mappers.ts                  # response normalization and UI helpers
│   │       ├── overview.queries.ts                  # keep Overview-scoped query path
│   │       └── overview.types.ts                    # extend view-model contract
│   ├── i18n/
│   │   └── locales/
│   │       ├── en/
│   │       │   ├── overview.json
│   │       │   └── coverage.json
│   │       └── es/
│   │           ├── overview.json
│   │           └── coverage.json
│   ├── server/
│   │   ├── overview/
│   │   │   ├── getRecentOverview.ts                 # integrate protocol-position aggregation
│   │   │   ├── overview.repository.ts               # persist explainability metadata and evidence pointers
│   │   │   └── overview.types.ts                    # extend server contract types
│   │   ├── protocol-positions/
│   │   │   ├── protocolPositions.types.ts           # new chain-scoped position model
│   │   │   ├── detectProtocolPositions.ts           # discovery orchestration
│   │   │   ├── reconstructRecentPositionState.ts    # bounded 30-day reconstruction helper
│   │   │   └── protocolMetadata.ts                  # approved protocol surfaces and identity helpers
│   │   ├── providers/
│   │   │   ├── moralis/
│   │   │   └── alchemy/
│   │   └── asset-trust/
│   │       └── classifyWalletAssetTrust.ts          # remains separate from protocol positions
│   └── queries/
│       ├── hooks.ts
│       └── keys.ts
└── scripts/
   └── check-i18n-parity.ts
```

**Structure Decision**: Extend the current Overview vertical slice and introduce one backend-owned `src/server/protocol-positions` module for current protocol-position detection, chain-aware identity, and bounded current-state reconstruction. Keep the browser contract and route topology unchanged. Prefer existing persistence tables plus metadata JSON or evidence references in Stage 1 rather than introducing a broader analyzed-history schema before the one-year workflow exists.

## Phase 0: Outline & Research

Research completed for:

1. **Contract strategy**: extend `GET /api/wallet/overview` rather than creating a parallel route, because the current Overview query plumbing, route sanitization, and product IA already anchor protocol positions in the connected dashboard.
2. **Discovery strategy**: use Moralis as wallet-centric discovery and only treat its NFT or DeFi hints as signals. Confirm protocol semantics through approved protocol metadata, RPC reads, contract reads, and bounded log inspection when needed.
3. **Reconstruction boundary**: keep current-state reconstruction strictly bounded to the most recent 30 days, using it only to confirm or classify current positions that direct current-state reads cannot explain honestly.
4. **Identity strategy**: use chain-scoped deterministic identities for manual Aerodrome positions, Mellow strategy surfaces, and governance locks so Stage 1 rows remain compatible with later deposits, strategies, and governance sections.
5. **Persistence strategy**: persist raw provider or RPC evidence, or enough normalized internal metadata, through existing Overview persistence surfaces so classification, coverage, and debugging remain explainable without committing Stage 1 to a full new protocol-history schema.
6. **Frontend separation**: introduce a dedicated protocol-positions block while preserving the existing wallet-assets block and analysis CTA. Do not collapse deployed or locked capital into ordinary token rows.
7. **Localization ownership**: keep position-family labels, coverage copy, partial-state copy, and helper descriptions in `overview`, with shared generic coverage labels remaining in `coverage` only where already established.
8. **Validation approach**: use existing app checks plus targeted provider-boundary searches and a direct Overview route or service invocation with a syntactically valid wallet address, because the generic `provider:smoke` script currently fails early on the zero-address input.

Output is captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design outputs in this phase:

1. **Data model** for Overview protocol positions, coverage states, value treatment, chain-scoped identity, and explainability evidence in [data-model.md](./data-model.md).
2. **Contract** for the Overview API extension in [contracts/overview-protocol-positions-contract.md](./contracts/overview-protocol-positions-contract.md).
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

1. **Introduce the backend protocol-position model**
  - Add protocol-position families, coverage states, value-treatment types, chain-scoped identity helpers, and approved protocol metadata helpers under `src/server/protocol-positions`.
  - Keep manual deposits, strategy exposure, and governance locks as distinct primary families, with optional `staked_lp` support only when it materially changes the current user-facing state.
2. **Extend Overview server and frontend contracts**
  - Add a dedicated `protocolPositions` block to `overview.types.ts` on both server and frontend.
  - Extend existing metrics and coverage reason vocabularies so manual deposit, strategy, and governance values can be driven by protocol-position evidence without altering the route shape.
  - Keep query keys Overview-scoped and continue to include `chainId` and `walletAddress`.
3. **Implement detection and bounded reconstruction**
  - Start from Moralis wallet discovery and approved protocol metadata.
  - Use direct current-state reads first where available.
  - Fall back to bounded 30-day protocol-event reconstruction only when needed to confirm a currently open position, classify its family, or produce an honest current label.
  - Reject one-year history traversal, reward attribution, annualized return logic, and lifecycle analytics in this slice.
4. **Persist explainability evidence**
  - Write raw provider or RPC artifacts that materially affect classification to `raw_provider_records`.
  - Store derived protocol-position metadata, coverage summaries, evidence pointers, and bounded-reconstruction notes in existing `coverage_reports.metadataJson`, `portfolio_snapshots.metadataJson`, or equivalent narrow normalized records if existing metadata surfaces prove insufficient.
  - Do not expose raw provider payloads to the frontend.
5. **Integrate the Overview aggregator**
  - Update `getRecentOverview()` so protocol positions are assembled before final metrics and empty-state decisions are made.
  - Keep wallet assets and trust filtering separate from protocol positions. Asset trust rules continue to apply only to wallet-asset inventory.
  - Degrade coverage honestly when visible protocol positions are only partially valued or only share-level confirmed.
6. **Render the dedicated Overview block**
  - Add a protocol-positions section to `Overview.component.tsx` with family labeling, human-readable context, value treatment, and coverage state.
  - Preserve the existing connected Overview shell, chart, assets, activity, and analysis CTA.
  - Ensure wallets with protocol positions but few liquid assets do not present as empty or zero-only.
7. **Localize and sanitize**
  - Add EN/ES translation keys for headings, family labels, coverage descriptions, bounded-reconstruction messaging, partial-value messaging, and no-position empty states.
  - Ensure route sanitization blocks raw provider payload leakage and keeps only canonical internal fields in the response.
8. **Validate and harden**
  - Run `pnpm i18n:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` from `apps/web`.
  - Search for provider-boundary regressions with `rg "@/server/providers|moralis|alchemy" src/features src/app --glob '!**/api/**'` from `apps/web`.
  - Validate that reconstruction helpers do not read beyond 30 days except for direct current-state reads.
  - Use a direct Overview route or service invocation with a syntactically valid wallet address for smoke coverage instead of relying on the current zero-address provider smoke script.

Delivery boundaries:

- Included: dedicated Overview protocol-positions block, chain-aware identities, bounded 30-day current-state reconstruction when needed, persisted explainability evidence, protocol-driven metric population, EN/ES localization, and backend-only provider or RPC integration.
- Excluded: one-year analyzed-history reconstruction, detail pages, lifecycle timelines, realized or unrealized performance analytics, annualized returns, reward attribution, generic NFT portfolio support, and any new browser-facing provider contract.

## Complexity Tracking

No constitution violations requiring exception tracking.
