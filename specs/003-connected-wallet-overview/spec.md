# Feature Specification: Connected Wallet Overview

**Feature Branch**: `003-connected-wallet-overview`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: User description: "Feature: Connected Wallet Overview Full Stack"

**Current Delivery Stage**: The active implementation scope for this feature directory is Stage 1: connected `/overview`, recent provider-backed Overview data, canonical analysis start/status scaffolding, and EN/ES localization for those surfaces. Historical analyzed-history rendering, automatic transition into analyzed widgets, and stale auto-refresh remain documented follow-up scope and are intentionally excluded from the current task plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach The Connected Cockpit Immediately (Priority: P1)

As a user who connects a supported wallet, I need to land in the connected Overview immediately so I can understand the current state of my Aerodrome portfolio without navigating through unfinished sections.

**Why this priority**: This is the first connected-product experience and the core promise of The Cab: fast visibility first, deeper reconstruction later.

**Independent Test**: Can be fully tested by connecting a wallet on Base mainnet, verifying the app enters the connected shell, and confirming that Overview renders useful wallet and portfolio context without requiring historical analysis first.

**Acceptance Scenarios**:

1. **Given** a disconnected visitor lands on the public app entry, **When** they connect a wallet on Base mainnet, **Then** they are taken into the connected shell with Overview as the active destination.
2. **Given** a connected wallet on Base mainnet, **When** the app shell loads, **Then** Overview is enabled immediately while deeper historical sections remain locked or limited according to analysis status.
3. **Given** a connected wallet on an unsupported chain, **When** the user attempts to enter the connected app, **Then** the UI blocks Overview data loading, explains that Product v1 supports Base mainnet only, and offers a switch-network action.

---

### User Story 2 - See A Fast Recent Portfolio View Before Analysis (Priority: P1)

As a connected user who has not run historical analysis yet, I need a fast recent wallet overview using current balances, prices, and recent activity so I can assess what I currently hold and what happened recently.

**Why this priority**: The product must provide immediate value before analysis completes; otherwise the connected experience feels empty and contradicts the product specification.

**Independent Test**: Can be fully tested by loading Overview for a wallet with no prior analysis and verifying that the screen shows recent-view labels, wallet summary, top metrics, asset values, activity preview, and honest partial-coverage messaging.

**Acceptance Scenarios**:

1. **Given** a connected wallet with no completed analysis, **When** Overview loads, **Then** it shows a clearly labeled `Recent view` with current balances, estimated current market values, recent activity preview, and analysis CTA.
2. **Given** a connected wallet with assets but no detected Aerodrome activity, **When** Overview loads, **Then** it shows wallet balances if available, a no-activity empty state for Aerodrome analytics, and a non-misleading coverage explanation.
3. **Given** one or more prices are unavailable, **When** Overview renders recent data, **Then** price gaps are marked as partial coverage and the UI avoids fabricating final totals from missing values.

---

### User Story 3 - Start Analysis And Understand Progress (Priority: P2)

As a connected user who wants deeper analytics, I need to trigger historical analysis and see trustworthy progress and status on the Overview screen so I know when deeper sections and analyzed metrics become available.

**Why this priority**: Overview is the control surface for the analysis pipeline; the user must be able to request deeper reconstruction and understand what is happening without leaving the screen.

**Independent Test**: Can be fully tested by starting analysis from Overview, observing queued and running states, and verifying that status updates are reflected without blocking the Overview screen.

**Acceptance Scenarios**:

1. **Given** a wallet with no completed analysis, **When** the user triggers historical analysis from Overview, **Then** the app creates or reuses an analysis run, updates visible status to queued or running, and keeps Overview usable.
2. **Given** an analysis run is in progress, **When** Overview polls for status, **Then** the screen shows localized status, stage, and progress without requiring a full page refresh.
3. **Given** an analysis run fails, **When** Overview receives the failure status, **Then** the screen shows a localized retry-capable error state while preserving the last known usable recent data if any exists.

---

### Deferred Follow-Up Scope - Automatically Transition To Analyzed Data

The broader product roadmap still requires Overview to transition from provisional recent data to normalized analyzed data automatically once historical analysis outputs are ready. That analyzed-history rendering, automatic transition behavior, and stale auto-refresh flow are intentionally deferred from the current implementation stage so the task plan can stay aligned with the requested recent-view-first delivery slice.

---

### User Story 5 - Use Overview In English Or Spanish With Honest States (Priority: P3)

As an English- or Spanish-speaking user, I need all Overview labels, chart text, table headers, status messaging, and error states to be localized and consistent so I can use the feature comfortably and trust what the system is telling me.

**Why this priority**: Localization and explainability are product-level commitments; Overview is not acceptable if it relies on placeholder copy, mixed languages, or ambiguous coverage/status states.

**Independent Test**: Can be fully tested by switching locale and verifying complete EN/ES parity for navigation, Overview, analysis, coverage, and shared UI states with locale-aware number and date formatting.

**Acceptance Scenarios**:

1. **Given** browser language is Spanish, **When** Overview loads, **Then** all Overview, navigation, analysis, chart, coverage, wallet, and shared UI strings render in Spanish with no placeholder English copy.
2. **Given** browser language is unsupported, **When** Overview loads, **Then** the app falls back to English consistently.
3. **Given** the screen displays currency, percentages, dates, balances, or timestamps, **When** locale changes, **Then** values re-render using locale-aware formatting helpers.

### Edge Cases

- Disconnected user reaches a connected Overview route directly.
- Connected wallet is on a non-Base chain.
- Wallet has current balances but no Aerodrome or Mellow activity.
- Wallet has Aerodrome activity but missing price coverage for one or more assets.
- Provider responses succeed partially, producing incomplete recent activity or valuation.
- Analysis status enum differs between API payloads and UI badge components.
- Analysis data exists but is stale and a refresh attempt fails.
- Recent-view provider data conflicts with older analyzed data.
- Provider latency is high enough that shell and placeholders render before data is ready.
- Third-party API errors occur without exposing provider internals or secrets to the user.

## Requirements *(mandatory)*

### Stage Scope Constraint *(mandatory)*

- The current implementation stage for this feature directory is limited to connected routing, recent-view Overview delivery, canonical analysis start/status scaffolding, and EN/ES localization for those surfaces.
- Historical analyzed-history rendering, automatic transition into analyzed widgets, analyzed-history range controls, and stale auto-refresh remain documented follow-up scope and are intentionally excluded from the current task plan and acceptance baseline.

### Functional Requirements

#### 1) Feature Summary

- **FR-001**: The system MUST provide a dedicated connected-wallet Overview feature as the first connected dashboard for The Cab.
- **FR-002**: Overview MUST deliver useful portfolio visibility before full historical analysis is complete.
- **FR-003**: The broader Overview roadmap MUST support automatic elevation from provisional recent data to higher-confidence analyzed data when normalized analysis output is available, but that analyzed-mode handoff is deferred from the current implementation stage.

#### 2) Connected Routing And Shell

- **FR-004**: The application MUST keep the public landing experience for disconnected users.
- **FR-005**: The application MUST route or redirect a supported connected wallet into the connected shell with Overview as the active destination.
- **FR-005A**: The public root route `/` MUST remain the disconnected landing experience, and a successful supported wallet connect flow from that surface MUST redirect the user to `/overview`.
- **FR-005B**: The connected Overview entry route MUST be implemented at `/overview` through `src/app/overview/page.tsx` or an equivalent single route-level file in the App Router.
- **FR-005C**: Overview feature code MUST follow the existing product feature structure under `src/features/overview/` with `Overview.container.tsx`, `Overview.component.tsx`, `overview.queries.ts`, `overview.mappers.ts`, and `overview.types.ts` unless planning identifies a repo-wide approved equivalent.
- **FR-006**: The connected shell MUST reuse existing The Cab design-system layout primitives for sidebar, top navigation, section framing, action CTA, status display, and metric presentation when those primitives already exist.
- **FR-007**: The feature MUST NOT create duplicate connected-shell, sidebar, top-nav, metric-card, range-selector, or analysis CTA primitives when existing DS components already satisfy the need.
- **FR-008**: The connected navigation MUST expose `Overview`, `Pools`, `Deposits`, `Strategies`, `Rewards`, `Governance`, `Activity`, and `Settings` with availability states aligned to analysis status.
- **FR-009**: Overview and Settings MUST remain available without a completed historical analysis.
- **FR-010**: Deep sections that require normalized history MUST remain locked or limited until analysis is ready.

#### 3) Overview Availability And Status Rules

- **FR-011**: Overview MUST load for supported connected wallets even when no analysis run exists.
- **FR-012**: The current stage MUST support a clearly labeled `Recent view` before historical analysis is ready and preserve contract/state shapes needed for a future `Analyzed history` mode.
- **FR-013**: Overview MUST clearly label which data mode is currently being shown.
- **FR-014**: Overview MUST expose analysis states for at least `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed`.
- **FR-015**: The feature MUST normalize analysis status naming across internal API contracts, query hooks, and UI components so the same canonical states are used end to end.
- **FR-016**: Overview MUST remain usable while analysis is queued or running.
- **FR-017**: Overview MUST preserve the last known usable data during stale or failed refresh scenarios whenever that data is still safe to display.
- **FR-017A**: When existing freshness metadata indicates a prior analysis is older than 7 days, the current stage MUST be able to surface a `stale` read-model state and preserve honest status messaging, while automatic incremental refresh and analyzed-data preservation remain deferred follow-up behavior.

#### 4) Required Overview Sections And Widgets

- **FR-018**: Overview MUST include a wallet summary area showing connected wallet identity, active chain, last refreshed time, analysis status, and coverage status.
- **FR-019**: Overview MUST display top-level portfolio metrics including net portfolio value, deployed value, and idle value.
- **FR-019A**: Overview MUST display change over the selected period for the portfolio-value block when enough data exists for the active mode and range.
- **FR-019B**: Overview MUST display estimated realized rewards when that value is available at the current coverage level.
- **FR-020**: Overview MUST display manual deposit exposure, automated strategy exposure, residual attributed value, and governance value when those values are available at the current coverage level.
- **FR-021**: Overview MUST include a portfolio evolution chart that communicates total value over time and distinguishes recent versus analyzed history.
- **FR-022**: Overview MUST include capital distribution views that can explain allocation by pool, token, strategy, idle assets, and governance exposure when data exists.
- **FR-023**: Overview MUST include an asset market values table showing current assets relevant to the wallet with balance, price, value, and classification labels where available.
- **FR-023A**: The asset market values table MUST include 24h or 7d movement where available for the selected range and data mode.
- **FR-024**: Overview MUST include a recent activity preview that can show simple provisional labels before analysis and enriched labels after analysis.
- **FR-025**: Overview MUST include an analysis prompt panel whenever deeper historical analysis has not completed or is stale.
- **FR-026**: Overview MUST provide localized empty, loading, partial-coverage, and error states for the entire page and for widgets that can fail independently.

#### 5) Refresh And Range Behavior

- **FR-027**: Overview MUST support a default time range of `7d`.
- **FR-028**: Overview MUST support additional range options for at least `24h`, `7d`, and `30d` in recent view.
- **FR-029**: An analyzed-history range is follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-029A**: The `All analyzed history` range option is follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-030**: Changing the active range MUST refresh the chart and any range-sensitive metrics using the correct source for the current mode.
- **FR-031**: Overview MUST provide a manual refresh capability for current data without requiring disconnecting or reconnecting the wallet.

#### 6) Coverage And Explainability

- **FR-032**: Overview MUST show coverage status and explain whether the current screen is using recent provider data, analyzed normalized data, or partial data.
- **FR-033**: Coverage messaging MUST distinguish between missing activity, missing prices, partial provider responses, and incomplete historical analysis.
- **FR-034**: Overview MUST avoid presenting provisional or inferred values as final when data is partial or pre-analysis.
- **FR-035**: The feature MUST surface honest fallback labels such as `Unclassified` or equivalent for pre-analysis activity that cannot yet be confidently reconstructed.

#### 7) Data Source Strategy

- **FR-036**: In recent view, Overview MUST use Moralis as the primary provider for wallet-centric current balances and recent wallet history.
- **FR-037**: Moralis wallet history MUST support the recent activity preview and candidate protocol activity discovery.
- **FR-038**: Moralis DeFi position hints MAY be used as a secondary approximation input for Overview, but MUST NOT become the source of truth for historical lifecycle analytics.
- **FR-039**: In recent view, Overview MUST use Alchemy as the pricing source of truth for current asset valuation and any recent time-series pricing needed by the chart.
- **FR-040**: An analyzed mode that uses normalized persisted snapshots and coverage records remains follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-040A**: `PerformanceSnapshot`-backed analyzed charting and period deltas remain follow-up scope for a later stage and are intentionally not required in the current recent-view implementation slice.
- **FR-040B**: Wallet-scoped normalized exposures, governance rollups, and enriched analyzed activity summaries remain follow-up scope for a later stage and are intentionally not required in the current recent-view implementation slice.
- **FR-041**: The system MUST keep source-of-truth boundaries explicit so Moralis does not become the canonical historical pricing source and Alchemy does not become the canonical wallet-history source.

#### 8) Internal API Contract

- **FR-042**: Overview MUST be served to the browser through an internal application endpoint rather than direct browser calls to Moralis or Alchemy.
- **FR-043**: The Overview API MUST require or derive `walletAddress` and `chainId` explicitly so the response is truly wallet-scoped and chain-scoped.
- **FR-044**: The Overview API MUST support a `range` input that is validated against allowed values.
- **FR-045**: The Overview API response MUST include mode metadata, analysis metadata, coverage metadata, a wallet summary block, a metrics block, a chart block, an asset list block, and a recent activity block.
- **FR-045A**: The Overview API metrics block MUST include net portfolio value, deployed value, idle value, change over selected period, and estimated realized rewards when available.
- **FR-045B**: The Overview API asset list block MUST expose balance, price, value, classification, and movement fields when available.
- **FR-045C**: The Overview API chart block MUST declare its active source (`recent_provider_data` or `analyzed_history`) and include the selected range.
- **FR-046**: The Overview API MUST expose whether each major block is based on recent provider data, analyzed data, or partial fallback data.
- **FR-046A**: The wallet summary, metrics, chart, distribution, assets, and activity blocks MUST each expose block-level source metadata and block-level coverage or fallback metadata whenever their provenance differs from the page-level mode or coverage summary.
- **FR-047**: The Overview API MUST return consistent validation and failure codes for unsupported chain, invalid wallet, provider failure, and generic Overview failure scenarios.
- **FR-048**: The Overview API MUST sanitize provider errors into safe user-facing and log-facing forms without returning raw third-party response bodies to the browser.
- **FR-048A**: The analysis status endpoint consumed by Overview MUST return a canonical payload with `walletAddress`, `chainId`, `status`, `runId` when available, `stage`, `progressPct`, `lastSuccessfulRunAt`, `lastUpdatedAt`, and `lastError`.
- **FR-048B**: The canonical analysis status enum for Overview-facing APIs and UI state MUST be `not_analyzed | queued | running | ready | stale | failed`.
- **FR-048C**: The analysis start endpoint consumed by Overview MUST return enough data for immediate UI updates, including `runId`, `status`, `stage`, `progressPct`, `walletAddress`, and `chainId`.

#### 9) Persistence And Backend Flow

- **FR-049**: Successful recent-view provider fetches used to build Overview MUST persist `RawProviderRecord` entries for traceability and debugging.
- **FR-050**: Successful Alchemy pricing fetches used by Overview MUST persist `PricePoint` records with chain, token, timestamp, source, resolution, and confidence.
- **FR-051**: Successful Overview computations MUST persist `PortfolioSnapshot` records for the wallet and chain when the screen has enough data to produce a stable snapshot.
- **FR-051A**: `PerformanceSnapshot` persistence and consumption for analyzed Overview remain follow-up scope for a later stage and are intentionally not required in the current recent-view implementation slice.
- **FR-052**: Overview refreshes MUST persist a `CoverageReport` or equivalent coverage artifact whenever data is partial, inferred, or analyzed.
- **FR-053**: Wallet-scoped overview freshness metadata MUST be persisted in existing wallet context storage or an equivalent wallet-scoped persistence layer.
- **FR-054**: The fast recent-view path MUST persist enough artifacts to support auditability and future refresh decisions without waiting for a full historical analysis.
- **FR-055**: Automatic analyzed-mode switching from historical analysis output remains follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-055A**: Wallet-scoped `PerformanceSnapshot` freshness coordination for analyzed-history controls and period-change calculations remains follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-055B**: The full historical analysis producer flow that syncs protocol metadata and builds normalized analyzed Overview entities remains follow-up scope for a later stage and is intentionally not required in the current recent-view implementation slice.
- **FR-056**: Overview persistence MUST remain chain-aware and keyed by wallet and chain.

#### 10) Security And Secret Handling

- **FR-057**: Moralis and Alchemy credentials MUST remain server-only and MUST NOT be exposed through browser bundles, client configuration, or public environment variables.
- **FR-058**: Browser code MUST call only internal app routes or other server-owned interfaces for Overview and analysis operations.
- **FR-059**: Third-party provider calls MUST execute only inside server modules, server routes, or equivalent server-owned boundaries.
- **FR-060**: The feature MUST NOT introduce `NEXT_PUBLIC` environment variables for Moralis or Alchemy secrets.
- **FR-061**: Observability and error reporting for Overview MUST avoid logging raw secrets or returning them in responses.
- **FR-062**: Any environment-variable additions or validations introduced for Overview MUST be defined in server-only environment handling.

#### 11) Localization And Formatting

- **FR-063**: All user-facing copy introduced or touched by Overview MUST be sourced from translation keys and MUST NOT be hardcoded in UI components, containers, charts, or status panels.
- **FR-064**: The feature MUST complete English and Spanish copy for the `overview`, `navigation`, `analysis`, `coverage`, and `charts` namespaces, plus any required additions to `wallet`, `common`, and `errors`.
- **FR-065**: Navigation labels for the connected shell MUST be localized.
- **FR-066**: Analysis state labels, CTA text, helper text, and failure/retry messages MUST be localized.
- **FR-067**: Coverage labels and explanations MUST be localized.
- **FR-068**: Widget titles, table headers, chart legends, chart tooltips, empty states, loading states, and error states MUST be localized.
- **FR-069**: Asset classification labels such as deployed, idle, residual, reward, governance, unknown, and unclassified MUST be localized.
- **FR-070**: Overview MUST use locale-aware helpers for currency, balances, percentages, absolute dates, and relative times.
- **FR-071**: English and Spanish translation resources MUST preserve the same key structure for all namespaces changed by this feature.

#### 12) State Model And Error Handling

- **FR-072**: The feature MUST define and implement state behavior for disconnected, unsupported-chain, no-activity, missing-price, partial-coverage, queued, running, ready, stale, failed, and provider-failure states.
- **FR-073**: A direct visit to a connected Overview route without a connected wallet MUST resolve to the disconnected product experience or equivalent protected-entry behavior.
- **FR-074**: A wallet with balances but no analyzable Aerodrome activity MUST still show wallet-level value and an honest no-activity state for protocol analytics.
- **FR-075**: Missing prices MUST degrade coverage status rather than fabricate confident totals.
- **FR-076**: Slow provider responses MUST allow the connected shell and localized loading states to render before the data arrives.
- **FR-077**: If recent provider data and analyzed historical data diverge materially, the feature MUST preserve clear labeling so users know whether they are viewing recent provisional data or analyzed normalized history.

#### 13) Quality And Scope Boundaries

- **FR-078**: Overview MUST be implementable independently of Pools, Deposits, Strategies, Rewards, and Governance detail pages being complete.
- **FR-079**: The feature MUST reuse current repo infrastructure wherever it already exists instead of redesigning app providers, query plumbing, wallet state, or server provider modules.
- **FR-080**: The feature MUST not require landing work to be redone.
- **FR-081**: The feature MUST pass lint, typecheck, build, and i18n parity quality gates before being considered complete.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define i18n namespace impact and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for numbers, currency, percentages, dates, balances, and timestamps.
- **CA-004 Chain Awareness**: Feature MUST define `chainId` handling across route behavior, API contracts, persistence, and query keys.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership between Moralis, Alchemy Prices, and analyzed normalized data while keeping third-party access server-side only.
- **CA-006 Explainability**: Feature MUST describe coverage, status, freshness, and fallback behavior when data reconstruction is recent, partial, stale, or analyzed.

### Key Entities *(include if feature involves data)*

- **Overview Request**: A wallet- and chain-scoped request for connected dashboard data, including wallet identity, chain identity, and selected range.
- **Overview Response**: A structured payload that describes mode, freshness, analysis status, coverage state, wallet summary, metrics, chart data, asset rows, and activity preview.
- **Overview Snapshot**: A wallet- and chain-scoped snapshot of portfolio value and top-level allocations at a captured time, derived from provider data or analyzed normalized data.
- **Overview Performance Series**: A wallet- and chain-scoped normalized performance series used for analyzed charting, period deltas, and other historical Overview outputs.
- **Coverage State**: A user-visible description of how complete or partial the Overview data is, including recent-view versus analyzed-history semantics.
- **Overview Asset Row**: A representation of a wallet-relevant asset with balance, market value, price confidence, and classification such as deployed, idle, residual, reward, governance, or unknown.
- **Overview Activity Preview Item**: A lightweight or analyzed activity record shown in the Overview feed, including provisional or enriched classification and timing.
- **Wallet Overview Context**: Wallet-scoped freshness and analysis metadata used to decide whether to show recent, analyzed, or stale Overview data.
- **Overview Block Provenance**: Block-level metadata that declares whether a summary, metrics, chart, distribution, assets, or activity block is sourced from recent provider data, analyzed history, or partial fallback data, plus any block-specific coverage reasons.

### Suggested Translation Key Map

- `navigation.items.overview`
- `navigation.items.pools`
- `navigation.items.deposits`
- `navigation.items.strategies`
- `navigation.items.rewards`
- `navigation.items.governance`
- `navigation.items.activity`
- `navigation.items.settings`
- `overview.meta.title`
- `overview.meta.description`
- `overview.mode.recentView`
- `overview.mode.analyzedHistory`
- `overview.summary.wallet`
- `overview.summary.chain`
- `overview.summary.lastRefreshed`
- `overview.summary.analysisStatus`
- `overview.summary.coverageStatus`
- `overview.metrics.netPortfolioValue`
- `overview.metrics.deployedValue`
- `overview.metrics.idleValue`
- `overview.metrics.changeOverSelectedPeriod`
- `overview.metrics.estimatedRealizedRewards`
- `overview.metrics.manualDeposits`
- `overview.metrics.automatedStrategies`
- `overview.metrics.residualValue`
- `overview.metrics.governanceValue`
- `overview.range.24h`
- `overview.range.7d`
- `overview.range.30d`
- `overview.range.allAnalyzedHistory`
- `overview.chart.totalValue`
- `overview.chart.deployedValue`
- `overview.chart.idleValue`
- `overview.chart.rewardMarkers`
- `overview.distribution.byPool`
- `overview.distribution.byToken`
- `overview.distribution.byStrategy`
- `overview.distribution.idleAssets`
- `overview.distribution.governanceExposure`
- `overview.assets.title`
- `overview.assets.columns.token`
- `overview.assets.columns.balance`
- `overview.assets.columns.price`
- `overview.assets.columns.value`
- `overview.assets.columns.movement`
- `overview.assets.columns.classification`
- `overview.assets.movement.24h`
- `overview.assets.movement.7d`
- `overview.assets.classification.deployed`
- `overview.assets.classification.idle`
- `overview.assets.classification.residual`
- `overview.assets.classification.reward`
- `overview.assets.classification.governance`
- `overview.assets.classification.unknown`
- `overview.activity.title`
- `overview.activity.unclassified`
- `overview.activity.empty`
- `overview.analysisPanel.title`
- `overview.analysisPanel.body`
- `overview.analysisPanel.primaryCta`
- `overview.analysisPanel.secondaryCta`
- `overview.empty.noAerodromeActivityTitle`
- `overview.empty.noAerodromeActivityBody`
- `overview.loading.page`
- `overview.loading.chart`
- `overview.error.genericTitle`
- `overview.error.genericBody`
- `analysis.status.notAnalyzed`
- `analysis.status.queued`
- `analysis.status.running`
- `analysis.status.ready`
- `analysis.status.stale`
- `analysis.status.failed`
- `analysis.cta.analyzeWallet`
- `analysis.cta.refreshAnalysis`
- `analysis.helper.queued`
- `analysis.helper.running`
- `analysis.helper.ready`
- `analysis.helper.stale`
- `analysis.helper.failed`
- `coverage.state.full`
- `coverage.state.partial`
- `coverage.state.recent`
- `coverage.state.analyzed`
- `coverage.reason.missingPrices`
- `coverage.reason.noAerodromeActivity`
- `coverage.reason.providerPartial`
- `coverage.reason.analysisPending`
- `coverage.reason.analysisStale`
- `charts.legend.totalValue`
- `charts.legend.deployed`
- `charts.legend.idle`
- `charts.legend.rewards`
- `charts.tooltip.currentValue`

### Recommended Product Composition Map

- `src/app/overview/page.tsx` as the connected Overview route-level entry point while `/` remains the disconnected landing route
- `src/features/overview/Overview.container.tsx` for query orchestration, status polling, refresh, mode selection, and view-model mapping
- `src/features/overview/Overview.component.tsx` for presentational rendering of the full screen
- `src/features/overview/overview.queries.ts`
- `src/features/overview/overview.mappers.ts`
- `src/features/overview/overview.types.ts`
- `OverviewSummaryPanel`
- `OverviewMetricsStrip`
- `OverviewPortfolioChartPanel`
- `OverviewCapitalDistributionPanel`
- `OverviewAssetsTable`
- `OverviewRecentActivityPanel`
- `OverviewAnalysisPromptPanel`

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Current Stage Acceptance Note**: The present task plan is accepted against `SC-001` through `SC-006` and `SC-008`. `SC-007` and `SC-007A` remain follow-up success criteria for the deferred analyzed-history stage.

- **SC-001**: Supported connected users reach a usable Overview screen in a single connect flow without needing to navigate manually to another section.
- **SC-002**: Overview displays a meaningful recent-view state for wallets without prior analysis rather than a blank dashboard or zero-only scaffold.
- **SC-003**: 100% of Overview, navigation, analysis, coverage, and chart copy introduced by this feature is served through translation keys with English and Spanish parity.
- **SC-004**: 100% of Moralis and Alchemy requests used by Overview execute only on the server side, with no browser-direct provider calls.
- **SC-005**: The current stage of Overview clearly labels recent data, stale-status messaging when prior freshness metadata exists, and partial-coverage states in every major state it renders.
- **SC-006**: Starting analysis from Overview updates visible status within the same session and does not block use of the screen.
- **SC-007**: Follow-up stage success criterion: when a completed analysis exists, Overview automatically prefers analyzed snapshots and normalized coverage data for analyzed widgets.
- **SC-007A**: Follow-up stage success criterion: when the wallet's last successful analysis is older than 7 days, Overview automatically enters a stale-refresh flow without hiding the last successful analyzed data.
- **SC-008**: Quality gates for the feature pass: lint, typecheck, build, and i18n parity.

## Assumptions

- Existing wallet connection, supported-chain enforcement, query provider, i18n provider, server provider modules, and design-system primitives remain reusable without architectural replacement.
- Product v1 remains Base mainnet only, but Overview must preserve chain-aware query keys, API contracts, and persistence shapes.
- The current database schema is sufficient for the first full-stack Overview implementation, with wallet-scoped freshness metadata stored in existing wallet-context facilities unless a later migration proves necessary.
- Moralis and Alchemy server credentials already exist or will be supplied through server-only environment variables validated by the existing server environment module.
- Pools, Deposits, Strategies, Rewards, Governance, and Activity detail pages may remain incomplete while Overview is implemented, but their navigation presence and lock-state semantics still need to exist.

## Definition of Done Checklist

- [x] Connected users land in Overview immediately after connecting a supported wallet.
- [x] Overview works before historical analysis completes.
- [x] Overview has clear `Recent view` semantics, and the deferred `Analyzed history` handoff is explicitly documented as follow-up scope.
- [x] The feature reuses existing DS shell and display primitives where available.
- [x] The Overview API is wallet-scoped, chain-scoped, and server-owned.
- [x] Moralis and Alchemy keys remain server-only.
- [x] Current-stage Overview persistence covers raw provider records, price points, portfolio snapshots, freshness metadata, and coverage artifacts.
- [x] English and Spanish Overview-related copy is fully specified.
- [x] Contract mismatches such as analysis status naming are normalized in the feature scope.
- [x] Quality gates are part of feature completion.

## Implementation Sequence (Engineering Handoff)

1. Normalize connected routing so supported connected wallets enter the connected shell with Overview active while disconnected users remain on landing.
2. Define the canonical Overview API and analysis-status contracts, including wallet scoping, chain scoping, `/overview` route ownership, mode labeling, page-level coverage, block-level provenance metadata, metrics, chart, assets, activity, and sanitized errors.
3. Implement server-side recent-view aggregation using Moralis balances and history plus Alchemy pricing, with no browser-direct third-party calls.
4. Persist Overview fetch artifacts and computed recent-view snapshots using existing raw provider, price, coverage, portfolio snapshot, and wallet-context storage.
6. Reuse existing design-system layout and dashboard components to build the connected Overview page and navigation shell.
7. Complete EN/ES translation resources for Overview, Navigation, Analysis, Coverage, Charts, and any touched shared namespaces.
8. Integrate analysis start and status polling into Overview, including canonical status naming, honest stale-state messaging when freshness metadata exists, and a manual refresh capability for current recent data.
9. Validate empty, partial, stale, failure, unsupported-chain, disconnected, and no-activity states.
10. Run lint, typecheck, build, and i18n parity verification, then proceed to implementation planning.