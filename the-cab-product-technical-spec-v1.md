# The Cab — Product & Technical Specification v1

## 0. Purpose

This document defines the product, UX, technical architecture, domain model, analytics behavior, background analysis process, branding rules, and section-by-section implementation requirements for **The Cab**.

The Cab is a **portfolio command cabin for Aerodrome Finance on Base**. It allows a connected wallet to monitor its current Aerodrome-related portfolio, understand historical capital deployment, analyze pools and positions, inspect rewards and governance activity, and reconstruct meaningful portfolio performance over time.

This specification is written to be consumed by AI-assisted development tools such as Copilot, Cursor, Claude Code, Codex, or similar agents. Its goal is to reduce product drift by making product intent, data boundaries, user flows, analytics semantics, and implementation priorities explicit.

---

## 1. Product Overview

### 1.1 Product definition

**The Cab** is a web analytics application for users participating in **Aerodrome Finance** on Base.

It provides:

- A quick wallet-connected overview using recent wallet and market data.
- A deeper historical analysis triggered by the user on demand.
- Pool-level analytics.
- Position-level lifecycle analytics.
- Rewards and claims analytics.
- Governance analytics for veAERO, locks, votes, relays, and voting rewards.
- Activity-level transaction interpretation.
- Clear separation between manual Aerodrome activity and Mellow-managed strategies.

The product should feel like a **control tower for on-chain capital**: precise, technical, aviation-inspired, dashboard-first, and trustworthy.

### 1.2 Product intent

The Cab is not a trading terminal and not an execution interface. It is an **analytics and monitoring cockpit**.

The user should be able to answer:

- What is the current state of my wallet?
- How has my Aerodrome portfolio evolved over time?
- Which pools have I participated in?
- Which positions performed well or poorly?
- How much capital did I deploy, withdraw, rebalance, or leave idle?
- How much did I earn from rewards, fees, claims, locks, or votes?
- Which swaps were normal swaps and which were likely rebalance operations?
- How much of my return came from rewards versus asset price movement?
- What is my estimated annualized return overall, per pool, per strategy, and per position?

### 1.3 Product non-goals

The Cab must not become:

- A generic DeFi portfolio tracker.
- A transaction execution interface.
- A tax reporting product.
- A full blockchain indexer that performs open-ended server-side analysis continuously.
- A background daemon that analyzes every wallet automatically.
- A system requiring manual reconciliation as a core workflow.
- A retail-trading dashboard with hype-oriented language.

The product’s core promise is **fast portfolio visibility first, deeper historical reconstruction on demand**.

---

## 2. User Modes

The application has two major modes:

1. **Disconnected mode**
2. **Connected wallet mode**

Authentication is wallet-based. The initial product supports one connected wallet at a time.

---

## 3. Disconnected Experience

### 3.1 Layout

When no wallet is connected, the application shows a public landing experience.

The disconnected layout must include:

- A horizontal top navigation bar.
- Brand logo / wordmark.
- Navigation anchors for landing sections.
- Primary CTA: connect wallet.
- Optional secondary CTA: learn how analysis works.
- A visual hero section that communicates aviation + DeFi analytics.

The top menu should remain visible while the user scrolls through the landing page.

### 3.2 Landing purpose

The landing page introduces The Cab to new users and should communicate:

- The Cab is a control tower for Aerodrome portfolios.
- The user connects a wallet to get an immediate dashboard.
- The app shows quick recent analytics first.
- A deeper historical analysis can be requested.
- Once historical analysis is ready, more sections unlock.
- The product supports Aerodrome manual activity and Mellow strategies.
- The app does not require the user to manually reconstruct transactions.

---

## 4. Connected Application Layout

### 4.1 Shell

Once a wallet is connected, the user is redirected to the connected app shell.

The connected layout must include:

- Vertical left sidebar.
- Wallet identity area.
- Navigation sections.
- Analysis CTA/status module.
- Main content panel.
- Optional top status bar for sync state, data age, chain, and selected wallet.

### 4.2 Sidebar navigation

Sidebar sections:

1. Overview
2. Pools
3. Positions
4. Rewards
5. Governance
6. Activity
7. Settings

The original menu list included Overview, Pools, Positions, Activity, and Settings. This spec makes **Rewards** and **Governance** first-class sections because they are explicit product modules and should not be hidden inside Activity.

### 4.3 Section availability states

Sections are enabled or disabled based on analysis status.

Initial connected state:

- Overview: enabled.
- Pools: disabled.
- Positions: disabled.
- Rewards: disabled.
- Governance: disabled.
- Activity: disabled or limited to recent activity preview.
- Settings: enabled.

Reason:

- Overview can use recent API data from Moralis and Alchemy.
- Deep sections require normalized historical analysis.

### 4.4 Analysis CTA states

The sidebar includes a CTA for starting wallet analysis.

Supported states:

#### Not analyzed

- CTA label: `Analyze wallet`
- Sections requiring historical analysis are disabled.
- Disabled sections should show lock/disabled styling and tooltip:
  - “Run historical analysis to unlock this section.”

#### Analysis requested / queued

- CTA label: `Queued`
- CTA disabled.
- Show message:
  - “Historical analysis queued. We’ll notify you when it’s ready.”

#### Analysis running

- CTA label: `Analyzing…`
- CTA disabled.
- Show progress state when available.
- User can keep navigating Overview and any already available partial surfaces.

#### Analysis ready

- CTA replaced or supplemented by status badge:
  - `Ready`
  - Optional brand alternative: `Cleared`
- Sections unlock.
- User can trigger refresh/update analysis when needed.

#### Analysis failed

- CTA label: `Retry analysis`
- Show error summary.
- Preserve all previously available data.
- Do not block Overview.

#### Analysis stale

- Status badge:
  - `Stale`
- CTA label:
  - `Update analysis`
- Show last analysis timestamp.

### 4.5 Polling behavior

The frontend should poll the backend for wallet analysis status while a run is queued or running.

Polling endpoint:

```http
GET /api/analysis/status?walletAddress=0x...
```

Expected response shape:

```json
{
  "walletAddress": "0x...",
  "status": "not_started | queued | running | ready | failed | stale",
  "runId": "analysis_run_id",
  "progress": {
    "stage": "fetching_transactions | classifying_events | pricing_events | computing_snapshots | completed",
    "processedTransactions": 125,
    "totalTransactions": 830,
    "estimatedCompletionPct": 42
  },
  "lastSuccessfulRunAt": "2026-05-12T12:00:00.000Z",
  "lastError": null
}
```

Polling cadence:

- While queued/running: every 5–10 seconds.
- After ready/failed: stop polling.
- On tab refocus: refresh status once.
- Avoid aggressive polling that could create API or serverless cost issues.

---

## 5. Technical Architecture

### 5.1 Framework

The application will be developed in **Next.js**.

Next.js responsibilities:

- Public landing pages.
- Connected app shell.
- API routes.
- Background job orchestration endpoints.
- Server-side data fetching where appropriate.
- Client-side dashboard rendering.
- Integration with database and third-party APIs.

### 5.2 Third-party APIs

The application integrates with two third-party API providers:

#### Moralis

Primary use:

- Wallet portfolio data.
- Wallet balances.
- Recent wallet activity.
- Token transfers.
- NFT/position-related data when available.
- Fast current and recent wallet overview.

#### Alchemy

Primary use:

- Token prices.
- Historical prices.
- Price enrichment for event-time valuation.
- Transaction/history support where useful.
- Base chain data where Alchemy is stronger or more reliable.

Important provider rule:

- Do not introduce CoinGecko or other pricing providers unless explicitly approved.
- The expected pricing provider is Alchemy.
- Provider abstractions may exist, but Alchemy must be the configured implementation for pricing in this spec.

### 5.3 Data strategy

The product has two data layers:

#### Fast recent layer

Used for Overview before full analysis is complete.

Characteristics:

- Fetches recent data quickly.
- Focuses on last 7 days by default.
- May use direct API responses without full normalization.
- Used to populate current portfolio, recent activity, current balances, and basic charts.
- Should expose coverage/limitations clearly.

#### Historical analysis layer

Used for deep sections.

Characteristics:

- Triggered on demand by the user.
- Runs asynchronously/non-blocking.
- Fetches full wallet transaction history relevant to Aerodrome/Mellow.
- Classifies transactions into normalized domain events.
- Enriches events with historical prices.
- Computes snapshots and metrics.
- Stores normalized model in database.
- Unlocks deep sections when complete.

### 5.4 Database

The product requires persistence for:

- Wallet contexts.
- Analysis runs.
- Normalized events.
- Asset movements.
- Pools.
- Strategies.
- Position instances.
- Prices used for valuation.
- Performance snapshots.
- Portfolio snapshots.
- Discarded/unsupported/ambiguous events.
- Provider request metadata and coverage metadata.

Recommended database:

- PostgreSQL.

Implementation may use:

- Drizzle ORM for typed schema and migrations.
- Raw SQL migrations for auditability.

### 5.5 API design

Initial API surface:

```http
GET  /api/wallet/overview
POST /api/analysis/start
GET  /api/analysis/status
GET  /api/pools
GET  /api/pools/:poolId
GET  /api/positions
GET  /api/positions/:positionInstanceId
GET  /api/rewards
GET  /api/governance
GET  /api/activity
GET  /api/settings
POST /api/settings
```

All wallet-specific endpoints must validate:

- Wallet address format.
- Supported chain.
- Connected wallet matches requested wallet unless explicit read-only support is added.
- Analysis availability for deep routes.

---

## 6. Design System

### 6.1 Requirement

The Cab must have a coherent design system instead of ad hoc styling.

The UI must integrate:

- **Tamagui** as the component/styling system.
- **Google Fonts** for the brand font stack.
- Brand tokens derived from The Cab brand specification.
- Reusable components for dashboard surfaces.
- Consistent spacing, typography, surfaces, charts, and semantic states.

### 6.2 Font stack

Use Google Fonts:

- `Orbitron` for brand/display/headline moments.
- `Inter` for UI, body, navigation, cards, labels, and tables.
- `IBM Plex Mono` for wallet addresses, tx hashes, timestamps, block numbers, and technical metadata.

Rules:

- Do not use Orbitron for dense UI, tables, or long body copy.
- Use Inter as the default product font.
- Use IBM Plex Mono only as a technical accent.
- Apply `font-variant-numeric: tabular-nums` to financial values, balances, timestamps, tables, and KPI values.

### 6.3 Tamagui token requirements

Create tokens for:

- Color palette.
- Text colors.
- Surface colors.
- Borders.
- Semantic colors.
- Spacing.
- Radius.
- Typography sizes.
- Font families.
- Shadows/glow effects if needed.

The implementation must avoid hardcoded colors spread throughout components. Brand values should come from tokens.

### 6.4 Component families

Required reusable component groups:

#### Layout

- `DisconnectedShell`
- `ConnectedShell`
- `Sidebar`
- `TopNav`
- `DashboardGrid`
- `SectionHeader`

#### Data display

- `MetricCard`
- `KpiStrip`
- `DataPanel`
- `ChartPanel`
- `CoverageBadge`
- `AnalysisStatusBadge`
- `TokenAmount`
- `UsdValue`
- `WalletAddress`
- `TxHash`

#### Navigation

- `SidebarNavItem`
- `SectionLockState`
- `AnalysisCta`
- `RangeSelector`
- `FilterBar`

#### Feedback

- `EmptyState`
- `PartialCoverageNotice`
- `UnsupportedEventNotice`
- `LoadingPanel`
- `ErrorPanel`

#### DeFi analytics

- `PoolCard`
- `PositionCard`
- `RewardTimeline`
- `ActivityEventRow`
- `RebalanceMarker`
- `ResidualAttributionPanel`

### 6.5 Chart styling

Charts should feel like instrumentation, not retail trading toys.

Rules:

- Use dark chart backgrounds.
- Use subtle grid lines.
- Use Signal Teal as primary data signal.
- Use Electric Blue as secondary data signal.
- Use Cab Gold only for premium/identity highlights.
- Use semantic success/danger/warning only for actual state meaning.
- Avoid rainbow palettes.
- Avoid noisy chart decoration.

---

## 7. Background Historical Analysis Job

### 7.1 Purpose

The background analysis job reconstructs the historical Aerodrome/Mellow activity of a wallet.

It must populate the domain model so each section can display historical data clearly and consistently.

The job is not a general open-ended chain indexer. It is a wallet-scoped, user-requested reconstruction pipeline.

### 7.2 Job trigger

The user starts analysis from the connected sidebar CTA.

Frontend call:

```http
POST /api/analysis/start
```

Request:

```json
{
  "walletAddress": "0x...",
  "chainId": 8453,
  "mode": "full_history"
}
```

Response:

```json
{
  "runId": "analysis_run_id",
  "status": "queued"
}
```

### 7.3 Serverless hosting constraint

The app is expected to run on a serverless host such as Vercel.

Vercel serverless functions are not ideal for long-running processes. Therefore, the background job must be designed as one of the following:

#### Preferred approach: external job runner

Use a durable queue/worker system for long-running analysis.

Recommended options:

- Inngest
- Trigger.dev
- Upstash QStash + worker endpoint
- Vercel Cron + resumable chunks
- A separate worker service

The Next.js API route enqueues the job and returns immediately.

#### Acceptable approach: chunked resumable serverless jobs

If no external worker is used initially, the analysis must be split into resumable chunks.

Rules:

- Each function invocation processes a bounded slice.
- Progress is persisted.
- The next slice is scheduled or triggered.
- The job can resume after timeout or failure.
- Idempotency keys prevent duplicate event creation.

Do not attempt to process the entire wallet history in a single Vercel function invocation.

### 7.4 Analysis pipeline stages

The pipeline should be deterministic and restartable.

#### Stage 1 — Initialize run

Create `AnalysisRun`.

Fields:

- `runId`
- `walletAddress`
- `chainId`
- `status`
- `requestedAt`
- `startedAt`
- `completedAt`
- `failedAt`
- `lastProcessedBlock`
- `lastProcessedCursor`
- `stage`
- `errorMessage`
- `coverageSummary`

#### Stage 2 — Fetch transaction history

Fetch wallet history from Moralis/Alchemy.

Filter for:

- Aerodrome router interactions.
- Aerodrome pool interactions.
- Aerodrome position manager interactions.
- Gauge/staking interactions.
- Reward claims.
- veAERO contract interactions.
- Voting/relay contracts.
- Mellow wrapper/staking contracts.
- Token transfers relevant to these operations.
- Swaps involving pool tokens around withdraw/deposit windows.

Persist raw provider records or raw event envelopes for auditability.

#### Stage 3 — Identify supported protocol surfaces

Classify raw transactions into supported interaction families:

- Aerodrome manual LP.
- Aerodrome swaps.
- Aerodrome gauges.
- Aerodrome rewards.
- Mellow Aerodrome strategy.
- veAERO governance.
- Unknown/unsupported.
- Malicious/spam.

#### Stage 4 — Normalize ledger events

Convert raw transactions/logs/transfers into canonical `LedgerEvent` records.

Examples:

- `mint_position`
- `increase_liquidity`
- `decrease_liquidity`
- `collect_fees`
- `stake`
- `unstake`
- `claim_reward`
- `swap`
- `rebalance`
- `mellow_deposit`
- `mellow_withdraw`
- `lock_aero`
- `relock_aero`
- `vote`
- `claim_voting_fees`

Each event should include confidence metadata.

#### Stage 5 — Build asset movements

For each ledger event, create token-level `AssetMovement` records.

Each movement must include:

- Token address.
- Symbol.
- Raw amount.
- Normalized amount.
- Direction.
- USD value at event time.
- Price source.

#### Stage 6 — Price enrichment

Use Alchemy for historical price enrichment.

Requirements:

- Price every relevant asset movement at event time.
- Store `PricePoint` records.
- Track source, confidence, and resolution.
- If exact timestamp pricing is unavailable, use nearest acceptable resolution and mark confidence accordingly.
- Avoid silently using another provider.

#### Stage 7 — Build pools, strategies, and positions

Create or update:

- Pools.
- Strategies.
- Position instances.
- Lifecycle state.

Manual position identity:

- Aerodrome NFT token ID identifies the position.
- Mint creates a new position.
- Increase liquidity updates same position.
- Decrease/withdraw/collect affect same position.
- Burn/fully withdrawn closes the position if no active exposure remains.

Mellow position identity:

- Track Mellow exposure as strategy-specific exposure instance.
- Do not treat Mellow as if user directly owns the underlying Aerodrome NFT.
- Use wrapper/staking/share behavior as the identity basis.

#### Stage 8 — Detect rebalances

A rebalance is not merely any swap.

A rebalance inference should be made when a sequence suggests:

1. Withdraw/decrease exposure from a pool.
2. Swap one or both pool assets.
3. Deposit/increase exposure in the same or related pool.
4. The sequence happens within a bounded time window.
5. Asset flow supports the interpretation.

Rebalance detection must preserve economic continuity:

- Pool value must not reset to zero just because a withdraw occurred.
- Withdrawn pool assets remain attributed to that pool until:
  - They are transferred away.
  - They are swapped into unrelated assets.
  - They are explicitly redeployed elsewhere.
  - The inference window closes and idle balances are reclassified according to attribution rules.

This is especially important when multiple pools share the same token.

#### Stage 9 — Compute snapshots

Compute reusable snapshots for:

- Portfolio.
- Pool.
- Strategy.
- Position instance.

Metrics:

- Capital in.
- Capital out.
- Current value.
- Realized PnL.
- Unrealized PnL.
- Reward realized USD.
- Asset price effect.
- Rebalance realized USD.
- Estimated annualized return.
- Idle asset value.
- Coverage/confidence.

#### Stage 10 — Mark run complete

When successful:

- Mark `AnalysisRun.status = ready`.
- Persist completion timestamp.
- Update `WalletContext.lastAnalyzedAt`.
- Unlock sections in UI.
- Polling endpoint returns `ready`.

When failed:

- Mark `AnalysisRun.status = failed`.
- Persist error.
- Preserve partial data if safe.
- Show retry CTA.

### 7.5 Idempotency

Every analysis stage must be idempotent.

Recommended unique keys:

- `LedgerEvent`: wallet + chain + txHash + logIndex + eventType + protocol.
- `AssetMovement`: ledgerEventId + tokenAddress + direction + amountRaw + movementIndex.
- `PricePoint`: tokenAddress + timestamp bucket + source + resolution.
- `PositionInstance`: strategy + tokenId for manual, strategy + wrapper/share identity for Mellow.
- `AnalysisRun`: runId.

A repeated run must not duplicate events or inflate metrics.

### 7.6 Incremental updates

After an initial full historical run, future updates should be incremental.

Update behavior:

- Start from `lastIndexedBlock` or last successful cursor.
- Fetch only new wallet activity.
- Recompute affected snapshots.
- Preserve previous historical data.
- Mark old snapshots as superseded if snapshot versioning is used.

---

## 8. Domain Model

The initial attached data model is a strong base and should be retained as the primary structure, with several additions for this product spec.

### 8.1 Existing core model

The model includes:

- `WalletContext`
- `Protocol`
- `Pool`
- `Strategy`
- `PositionInstance`
- `LedgerEvent`
- `AssetMovement`
- `PricePoint`
- `PerformanceSnapshot`
- `PortfolioSnapshot`
- `DiscardedEvent`

The design principles are correct:

- Pool-first analysis.
- Strategy isolation.
- Position lifecycle integrity.
- Ledger-first truth.
- Portfolio completeness.

### 8.2 Required additions

The following entities should be added or explicitly modeled.

---

### 8.3 AnalysisRun

Represents one requested wallet analysis process.

Fields:

- `analysisRunId`
- `walletAddress`
- `chainId`
- `status`
- `mode`
- `requestedAt`
- `startedAt`
- `completedAt`
- `failedAt`
- `stage`
- `progressPct`
- `lastProcessedBlock`
- `lastProcessedCursor`
- `errorCode`
- `errorMessage`
- `coverageSummary`
- `createdAt`
- `updatedAt`

Status candidates:

- `not_started`
- `queued`
- `running`
- `ready`
- `failed`
- `stale`
- `cancelled`

Purpose:

- Powers sidebar CTA and polling.
- Supports resumable jobs.
- Provides user-facing analysis status.

---

### 8.4 RawProviderRecord

Stores raw API records used for reconstruction.

Fields:

- `rawProviderRecordId`
- `analysisRunId`
- `walletAddress`
- `provider`
- `sourceType`
- `externalId`
- `txHash`
- `blockNumber`
- `timestamp`
- `payloadJson`
- `createdAt`

Purpose:

- Auditability.
- Debugging.
- Reclassification.
- Provider comparison.
- Reprocessing without refetching where possible.

---

### 8.5 GovernanceEvent

Governance can be represented through `LedgerEvent`, but a dedicated derived entity will make the Governance section easier to query.

Fields:

- `governanceEventId`
- `walletAddress`
- `eventType`
- `txHash`
- `blockNumber`
- `timestamp`
- `lockId`
- `amountAero`
- `amountUsdAtEvent`
- `voteTarget`
- `epoch`
- `feesClaimedUsd`
- `rewardTokenAddress`
- `metadataJson`

Event types:

- `create_lock`
- `increase_lock_amount`
- `extend_lock_time`
- `relock`
- `vote`
- `reset_vote`
- `relay_join`
- `relay_exit`
- `claim_voting_fees`
- `claim_bribes`
- `claim_rebase`

Purpose:

- Supports veAERO and voting analytics without overloading position analytics.

---

### 8.6 RewardEvent

Rewards can also be represented through `LedgerEvent`, but a dedicated derived entity helps Rewards analytics.

Fields:

- `rewardEventId`
- `walletAddress`
- `poolId`
- `strategyId`
- `positionInstanceId`
- `rewardType`
- `txHash`
- `timestamp`
- `tokenAddress`
- `symbol`
- `amountNormalized`
- `usdValueAtClaim`
- `source`

Reward types:

- `lp_fee`
- `gauge_reward`
- `mellow_reward`
- `voting_fee`
- `bribe`
- `rebase`
- `unknown_reward`

Purpose:

- Enables rewards timeline, totals, distribution, and annualized return.

---

### 8.7 AttributionState

Tracks temporarily attributed residual assets after withdraw/rebalance operations.

Fields:

- `attributionStateId`
- `walletAddress`
- `poolId`
- `strategyId`
- `tokenAddress`
- `amountNormalized`
- `usdValueAtLastUpdate`
- `sourceLedgerEventId`
- `status`
- `openedAt`
- `closedAt`
- `closeReason`
- `confidence`

Status:

- `active`
- `redeployed`
- `swapped_unrelated`
- `transferred_out`
- `expired`
- `closed`

Purpose:

- Solves pool-level continuity when assets are withdrawn but not yet economically exited.
- Prevents pool value from going to zero during rebalance flows.
- Handles multiple pools sharing a token by preserving per-pool attribution.

---

### 8.8 CoverageReport

Captures completeness and confidence.

Fields:

- `coverageReportId`
- `analysisRunId`
- `walletAddress`
- `scopeType`
- `scopeId`
- `coverageStatus`
- `missingDataTypes`
- `unsupportedTransactionsCount`
- `ambiguousTransactionsCount`
- `providerErrorsCount`
- `confidence`
- `notes`

Coverage statuses:

- `complete`
- `partial`
- `limited`
- `failed`

Purpose:

- Prevents false precision.
- Allows the UI to show “partial coverage” or “unsupported event” warnings.

---

## 9. Metrics & Financial Semantics

### 9.1 Base valuation

All primary analytics should be USD/USDC-centric.

Rules:

- Use USD as display unit.
- Treat USDC as the practical stable reference.
- Store event-time USD valuations for historical accuracy.
- Store current USD valuations for open exposure.
- Never mix nominal token amount returns with USD returns without labeling clearly.

### 9.2 Capital entered

Capital entered is external value deployed into an Aerodrome/Mellow/governance scope.

Examples:

- Tokens deposited into a manual LP position.
- Tokens deposited into a Mellow strategy.
- AERO locked into veAERO.
- Idle assets explicitly allocated into a tracked Aerodrome operation.

Do not count internal movement twice.

### 9.3 Capital withdrawn

Capital withdrawn is value leaving a tracked scope.

Examples:

- Withdraw from LP position to wallet.
- Withdraw from Mellow.
- Transfer residual assets away.
- Swap into unrelated assets after exiting a pool.
- Unlock/exit governance exposure when applicable.

### 9.4 Residual pool capital

When a user withdraws from a pool but keeps the withdrawn assets in the wallet, those assets may remain economically attributed to the pool during a rebalance window.

This is required because:

- A withdraw does not necessarily mean the user exited the pool economically.
- The user may be rebalancing.
- Multiple pools may share one token.
- Pool-level charts should show economic continuity.

Residual attribution ends when:

- The assets are transferred out.
- The assets are swapped into unrelated assets.
- The assets are redeployed into another pool and attribution is explicitly moved.
- The attribution inference expires.

### 9.5 Realized PnL

Realized PnL should reflect value made or lost when capital is closed, withdrawn, swapped, claimed, or otherwise crystallized.

Examples:

- Fees collected.
- Rewards claimed.
- Gains/losses from rebalance swaps.
- Difference between capital entered and capital withdrawn for closed exposure.

### 9.6 Unrealized PnL

Unrealized PnL reflects current market value change of open exposure.

Examples:

- Open LP position value change.
- Mellow share value change.
- Idle residual pool assets still attributed to a pool.
- veAERO lock value where supported.

### 9.7 Asset price effect

Asset price effect isolates gains/losses caused by market movement of held assets.

This should be separated from:

- Claim rewards.
- LP fees.
- Rebalance gains/losses.
- Fresh capital deposits.
- Withdrawals.

### 9.8 Rewards return

Rewards return includes realized claimed value from:

- LP fees.
- Gauge rewards.
- Mellow rewards.
- Voting fees.
- Bribes.
- Rebases where applicable.

Rewards should be shown separately from total PnL and also included in total return when appropriate.

### 9.9 Estimated annualized return

Annualized return must be labeled as estimated.

Minimum acceptable formula for MVP:

```text
estimatedAnnualizedReturnPct =
  realizedAndUnrealizedReturnUsd / timeWeightedCapitalUsd * (365 / daysActive) * 100
```

Requirements:

- Do not annualize if daysActive is too low unless explicitly marked as volatile.
- Show methodology in tooltip.
- Prefer time-weighted capital if available.
- Use simpler capital basis only as fallback and label it as approximate.

---

# 10. Application Sections

---

## 10.1 Landing

### Purpose

The landing page is the public introduction to The Cab.

It must visually establish the product and guide the user toward wallet connection.

### Users

- New users.
- Returning users without connected wallet.
- Users evaluating whether to trust/connect.

### Main UX goals

- Explain what The Cab does.
- Establish a premium, technical, aviation-inspired brand.
- Make wallet connection obvious.
- Explain historical analysis as an optional deeper process.
- Set expectations about speed and async analysis.

### Required content blocks

#### Hero

Must include:

- Product headline.
- Short one-paragraph explanation.
- Connect wallet CTA.
- Hero visual aligned with brand.
- Reference to Aerodrome Finance on Base.

Suggested copy direction:

> Portfolio under control.  
> The Cab is an aviation-inspired analytics cockpit for Aerodrome portfolios on Base.

#### Feature grid

Cards for:

- Portfolio overview.
- Pool analytics.
- Position lifecycle.
- Rewards and claims.
- Governance and veAERO.
- Activity reconstruction.

#### How analysis works

Steps:

1. Connect wallet.
2. See recent dashboard.
3. Start historical analysis.
4. Continue browsing while analysis runs.
5. Unlock full analytics when ready.
6. Refresh analysis later.

#### Trust and privacy

Mention:

- Analytics-only.
- No private keys.
- No transaction execution.
- Wallet-scoped analysis.
- Data sourced from Moralis and Alchemy.
- Historical analysis may take time.

### Acceptance criteria

- User can connect wallet from landing.
- Landing remains usable without wallet.
- Top navigation follows scroll.
- Copy avoids hype and meme-crypto language.
- Product concept is understandable in under 10 seconds.
- Visual direction follows The Cab brand.

---

## 10.2 Overview

### Purpose

Overview is the first connected dashboard.

It provides immediate insight using recent wallet data before full historical analysis is complete.

### Availability

Overview is always available after wallet connection.

It should work even when historical analysis has not been run.

### Data source

Initial Overview data should use:

- Moralis wallet/portfolio APIs.
- Alchemy price/current and historical pricing APIs.
- Locally stored snapshots if historical analysis is ready.

Default time range:

- Last 7 days.

Optional range controls:

- 24h
- 7d
- 30d
- All analyzed history, enabled only after historical run.

### Required widgets

#### Wallet summary

Display:

- Connected wallet.
- Chain.
- Last refreshed time.
- Analysis status.
- Coverage status.

#### Portfolio value

Display:

- Current net portfolio value.
- Change over selected period.
- Current deployed capital.
- Idle asset value.
- Estimated realized rewards if available.

#### Portfolio evolution chart

Graph:

- Total value over time.
- Deployed value.
- Idle wallet value.
- Optional reward markers.

Before analysis:

- Use recent API data only.
- Show label: `Recent view`.

After analysis:

- Use normalized snapshots.
- Show label: `Analyzed history`.

#### Capital distribution

Display allocation by:

- Pool.
- Token.
- Strategy.
- Idle assets.
- Governance/lock exposure where available.

#### Asset market values

Show current wallet assets relevant to Aerodrome.

Columns:

- Token.
- Balance.
- Price.
- USD value.
- 24h/7d movement if available.
- Whether it is deployed, idle, residual, reward, or unknown.

#### Recent activity

Show recent Aerodrome-related actions:

- Swaps.
- Deposits.
- Withdrawals.
- Claims.
- Votes.
- Locks.

Before analysis:

- Show raw/simple labels.
- Mark as `Unclassified` where necessary.

After analysis:

- Show enriched labels such as:
  - `Rebalance detected`
  - `Claim reward`
  - `Increase liquidity`
  - `Mellow deposit`

#### Analysis prompt panel

If historical analysis has not been completed:

- Show a panel inviting the user to run analysis.
- Explain that deeper sections unlock after analysis.
- Include CTA.

Copy direction:

> Run historical analysis to unlock pool, position, reward, governance, and activity reconstruction. You can keep using the dashboard while The Cab processes your wallet.

### Empty states

If no Aerodrome activity is found:

- Show a clear empty state.
- Explain that the wallet may not have Aerodrome interactions.
- Still show current wallet balances if available.

### Acceptance criteria

- Overview loads quickly after wallet connect.
- It does not require full analysis.
- It shows recent data with clear “recent/partial” labeling.
- It shows analysis status and CTA.
- It updates when analysis becomes ready.
- It does not present inferred metrics as final before analysis.

---

## 10.3 Pools

### Purpose

Pools shows historical participation by pool.

It is the main pool-level analytical section.

### Availability

Pools is locked until historical analysis is ready.

### Core concept

A pool is the main aggregation unit.

Each pool may contain:

- Manual Aerodrome strategy.
- Mellow strategy.
- Multiple position instances.
- Rewards.
- Rebalances.
- Residual attributed assets.
- Idle balances still attributed to the pool.

### Required views

#### Pools list

Display all pools the wallet participated in.

Columns/cards:

- Pool name.
- Tokens.
- Protocol family.
- Current value.
- Capital entered.
- Capital withdrawn.
- Realized PnL.
- Unrealized PnL.
- Rewards claimed.
- Estimated annualized return.
- Active/inactive status.
- Coverage/confidence.

Filters:

- Active pools.
- Closed pools.
- Manual.
- Mellow.
- Positive/negative return.
- Partial coverage.

#### Pool detail

For each pool:

##### Pool header

Display:

- Pair name.
- Pool address.
- Token icons/symbols.
- Active strategies.
- Current attributed value.
- Total capital entered.
- Total rewards.
- Estimated return.
- Coverage badge.

##### Pool value evolution chart

Chart pool value over time.

Important rule:

- Pool value must not reset to zero simply because of a withdraw if withdrawn assets remain attributable to that pool during a rebalance window.
- Residual assets should remain part of pool-level value until attribution closes.

Series:

- Deployed value.
- Residual attributed value.
- Rewards claimed.
- Capital in/out markers.
- Rebalance markers.

##### Strategy breakdown

Show separate rows/cards for:

- Manual strategy.
- Mellow strategy.

For each strategy:

- Current value.
- Capital entered.
- Capital withdrawn.
- Rewards.
- Realized/unrealized PnL.
- Active positions.
- Estimated return.

##### Rebalance timeline

Show detected rebalances.

Each rebalance event should include:

- Withdraw/decrease event.
- Swap event(s).
- Deposit/increase event.
- Tokens involved.
- USD value before/after.
- Confidence.
- Explanation.

##### Residual attribution panel

Show assets currently attributed to the pool but not actively deposited.

Fields:

- Token.
- Amount.
- USD value.
- Source withdraw event.
- Attribution age.
- Status.
- Confidence.

This is necessary because several pools may share the same token, and residual balances must be tracked individually per pool.

### Pool attribution rules

When a withdraw occurs:

- Create or update `AttributionState`.
- Keep withdrawn token amounts attributed to original pool.
- If matching deposit/rebalance occurs, close or move attribution.
- If token is transferred away, close attribution as `transferred_out`.
- If token is swapped into unrelated assets, close as `swapped_unrelated`.
- If timeout expires, close as `expired` or mark low confidence.

### Acceptance criteria

- Pools are unavailable until analysis is ready.
- Each pool is a stable analytical unit.
- Manual and Mellow strategies are separated.
- Rebalance detection preserves economic continuity.
- Residual assets are tracked per pool, not globally per token.
- Pool charts do not show misleading zero-value drops during rebalance sequences.
- Confidence/coverage is visible when inference is partial.

---

## 10.4 Positions

### Purpose

Positions shows the lifecycle of individual deposits/exposures.

It allows the user to inspect each position from opening through changes, claims, unstaking, withdrawal, and closure.

### Availability

Positions is locked until historical analysis is ready.

### Position identity

#### Manual Aerodrome positions

Identified primarily by Aerodrome NFT token ID.

Lifecycle events:

- `mint_position`
- `increase_liquidity`
- `stake`
- `claim_reward`
- `unstake`
- `decrease_liquidity`
- `collect_fees`
- `withdraw`
- `burn`
- `close`

#### Mellow positions

Identified by Mellow wrapper/staking/share exposure.

Lifecycle events:

- `mellow_deposit`
- `mellow_stake`
- `mellow_claim`
- `mellow_unstake`
- `mellow_withdraw`
- `mellow_close`

Mellow positions must not be modeled as user-owned manual Aerodrome NFTs unless the wallet actually owns such NFT.

### Required views

#### Positions list

Display:

- Position ID / label.
- Pool.
- Strategy.
- Status.
- Open date.
- Close date if closed.
- Opened value.
- Current/closed value.
- Rewards.
- Realized PnL.
- Unrealized PnL.
- Estimated annualized return.
- Confidence.

Filters:

- Open.
- Closed.
- Manual.
- Mellow.
- Pool.
- Date range.
- Positive/negative return.

#### Position detail

##### Header

Display:

- Position label.
- Pool.
- Strategy.
- Status.
- Open/close dates.
- Token ID or Mellow reference.
- Current value.
- Total return.

##### Lifecycle timeline

Show chronological events:

- Deposit/mint.
- Stake.
- Increase.
- Claim.
- Unstake.
- Decrease.
- Withdraw.
- Close.

Each event should show:

- Timestamp.
- Transaction hash.
- Event type.
- Token movements.
- USD value.
- Confidence.
- Link to block explorer.

##### Position value chart

Chart:

- Opened value.
- Additional capital.
- Rewards.
- Current value.
- Withdrawal events.
- Closed value.

##### Token movement table

Rows:

- Event.
- Token.
- Direction.
- Amount.
- USD value at event.
- Price source.

##### Performance decomposition

Display:

- Capital entered.
- Capital withdrawn.
- Fees/rewards claimed.
- Realized PnL.
- Unrealized PnL.
- Asset price effect.
- Rebalance effect if applicable.
- Estimated annualized return.

### Acceptance criteria

- Manual positions are tied to token ID when available.
- Increase liquidity updates the same position.
- Mellow positions are isolated as strategy exposure instances.
- Lifecycle timeline is chronological and explainable.
- Position performance can be traced back to ledger events and asset movements.
- Ambiguous lifecycle events are marked rather than hidden.

---

## 10.5 Rewards

### Purpose

Rewards analyzes all claimed value obtained from Aerodrome, Mellow, and governance activity.

It answers:

- How much did I earn?
- From where?
- Over what period?
- Relative to how much capital was invested?
- What is the estimated annualized return from rewards?

### Availability

Rewards is locked until historical analysis is ready.

### Reward categories

Supported categories:

- LP fees.
- Gauge rewards.
- Mellow rewards.
- Voting fees.
- Bribes.
- Rebases.
- Other/unknown reward claims.

### Required views

#### Rewards summary

Display:

- Total rewards claimed USD.
- Rewards by category.
- Rewards by pool.
- Rewards by strategy.
- Rewards by token.
- Rewards over selected time range.
- Reward return percentage.
- Estimated annualized reward return.

#### Rewards timeline

Line/bar chart of claims over time.

Each point/bar should include:

- Claim timestamp.
- Token.
- Amount.
- USD value at claim.
- Source pool/strategy/governance action.
- Transaction hash.

#### Rewards distribution

Charts/tables:

- By pool.
- By token.
- By reward type.
- By strategy.
- By governance vs LP activity.

#### Capital-adjusted return

Show rewards relative to capital over time:

- Total capital invested at each historical moment.
- Rewards claimed over same period.
- Reward yield.
- Estimated annualized reward yield.

Important:

- Rewards should not be calculated against current capital only.
- Rewards must account for historical invested capital.
- If exact time-weighted capital is not available, label the metric as approximate.

### Acceptance criteria

- Claims are shown chronologically.
- Rewards are valued at claim time.
- Rewards can be grouped by pool, strategy, token, and reward type.
- Reward APR/APY/annualized return is explicitly labeled as estimated.
- Governance fees and bribes are included but distinguishable from LP rewards.
- Rewards do not get double counted in both pool and governance summaries.

---

## 10.6 Governance

### Purpose

Governance analyzes veAERO-related behavior.

It helps the user understand:

- AERO locks.
- veAERO exposure.
- Relays.
- Votes.
- Voting fees.
- Bribes.
- Rebases.
- Governance-related returns.

### Availability

Governance is locked until historical analysis is ready.

### Supported governance surfaces

- veAERO lock creation.
- Lock increases.
- Lock extensions.
- Relocks.
- Relay participation.
- Votes by epoch.
- Vote resets.
- Fees claimed from voting.
- Bribes claimed from voting.
- Rebase claims where applicable.

### Required views

#### Governance summary

Display:

- Current veAERO/lock exposure.
- Current locked AERO.
- Lock expiry or remaining duration.
- Total governance rewards claimed.
- Voting fee rewards.
- Bribes.
- Rebases.
- Estimated governance return.

#### Locks panel

Show:

- Lock ID.
- Created date.
- Amount locked.
- Current amount.
- Expiry.
- Increase/extend history.
- Current status.

#### Voting timeline

Show per epoch:

- Voted pools.
- Vote weights.
- Relay or manual voting.
- Fees/bribes earned.
- Claim status.

#### Governance rewards

Show:

- Fees claimed.
- Bribes claimed.
- Rebases.
- Token amounts.
- USD value at claim.
- Source epoch/pool/vote.

#### Relay participation

Show:

- Relay join/exit.
- Relay strategy if identifiable.
- Rewards associated with relay participation.

### Acceptance criteria

- veAERO locks are separated from LP positions.
- Governance rewards are included in Rewards but explainable in Governance.
- Vote and fee history is grouped by epoch when possible.
- Relay participation is detected where supported.
- Unsupported governance actions are surfaced with partial coverage notices.

---

## 10.7 Activity

### Purpose

Activity provides a transaction-level ledger of Aerodrome/Mellow-related actions with enriched interpretation.

It is the audit trail behind every dashboard metric.

### Availability

Activity is locked until historical analysis is ready, or optionally available in limited recent mode before analysis.

### Required views

#### Activity list

Display rows with:

- Timestamp.
- Transaction hash.
- Event type.
- Protocol.
- Pool.
- Strategy.
- Position.
- Token movements.
- USD value.
- Classification confidence.
- Coverage status.
- Link to explorer.

#### Supported classifications

- Cash in.
- Cash out.
- Deposit.
- Mint position.
- Increase liquidity.
- Decrease liquidity.
- Stake.
- Unstake.
- Withdraw.
- Claim.
- Swap.
- Rebalance.
- Lock AERO.
- Vote.
- Claim voting fees.
- Mellow deposit.
- Mellow withdraw.
- Unsupported.
- Malicious/spam.
- Ambiguous.

#### Transaction detail

Clicking an activity item should show:

- Raw transaction hash.
- Block number.
- Timestamp.
- Contract interactions.
- Decoded event classification.
- Asset movements.
- Price points used.
- Linked pool/strategy/position.
- Reason for classification.
- Confidence.
- Raw provider record reference if available.

#### Rebalance explainability

For an event classified as `rebalance`, show:

- Related withdraw/decrease event.
- Related swap(s).
- Related deposit/increase event.
- Time window.
- Token flow.
- Pool attribution effect.
- Confidence.

### Acceptance criteria

- Every major metric can be traced back to activity rows.
- Activity shows enriched labels after analysis.
- Raw/unsupported events are not silently hidden.
- Swaps classified as rebalance include explanation and linked events.
- Activity rows can be filtered by type, pool, strategy, token, date range, and confidence.

---

## 10.8 Settings

### Purpose

Settings allows the user to configure wallet analysis and display preferences.

### Availability

Settings is available after wallet connection.

### Required settings

#### Wallet

- Connected wallet address.
- Chain.
- Disconnect wallet.
- Refresh current overview.

#### Analysis

- Last analysis status.
- Last successful run timestamp.
- Start full analysis.
- Update incremental analysis.
- Retry failed analysis.
- Clear local UI cache.
- Optional: delete stored wallet analysis data.

#### Display

- Currency display: USD default.
- Time range default: 7d default.
- Number formatting preferences.
- Theme locked to The Cab dark theme for MVP.

#### Advanced / diagnostics

- Provider status.
- API coverage.
- Unsupported events count.
- Last processed block.
- Last analysis run ID.

### Acceptance criteria

- Settings does not expose confusing developer internals by default.
- Diagnostics are available but separated from normal settings.
- User can retrigger or update analysis.
- User can see data freshness.

---

# 11. Branding

The Cab must follow the approved brand specification.

## 11.1 Brand positioning

The Cab should feel:

- Technical.
- Futuristic.
- Precise.
- Premium.
- Crypto-native.
- Aviation-inspired.
- Dashboard-first.

It should not feel:

- Playful.
- Editorial.
- Soft.
- Lifestyle-oriented.
- Generic SaaS.
- Neon cyberpunk chaos.
- Retail-trading gimmick.

## 11.2 Core concept

The Cab is a **control tower for on-chain portfolios**.

The visual system should communicate:

- Oversight.
- Signal clarity.
- Navigation.
- Capital flow monitoring.
- Technical confidence.
- Operational awareness.

The UI should feel like a **premium control surface**, not a casual crypto dashboard.

## 11.3 Visual direction

Chosen direction:

- Dark futuristic control-tower aesthetic with gold + cyan accents.

Key motifs:

- Control tower / cab.
- Radar arcs.
- Aviation instrumentation.
- Thin technical lines.
- Clean data panels.
- Premium dark glass surfaces.
- Subtle glow.
- High-contrast KPI presentation.

Avoid:

- Oversized gradients everywhere.
- Rainbow analytics.
- Meme-crypto aesthetics.
- Excessive blur/glassmorphism.
- Cluttered futuristic noise.
- Sci-fi UI tropes that reduce usability.

## 11.4 Color palette

### Brand core

- Cab Night: `#040F1C`
- Deep Space: `#0F1826`
- Control Blue: `#15233A`
- Signal Teal: `#00E0E1`
- Electric Blue: `#3B82F6`
- Cab Gold: `#F2C14E`

### Surfaces

- Dark Surface: `#111A27`
- Elevated Surface: `#1A2233`
- Border: `#2A3347`

### Text

- Text Primary: `#EAF1FF`
- Text Secondary: `#B8C7E6`
- Text Muted: `#6B7A98`

### Semantic

- Success: `#22C55E`
- Warning: `#FBBF24`
- Danger: `#EF4444`
- Info: `#38BDF8`

## 11.5 Typography

Use:

- Orbitron for logo, hero titles, main page titles, major dashboard section anchors.
- Inter for navigation, cards, body copy, labels, tables, controls.
- IBM Plex Mono for wallet snippets, tx hashes, timestamps, block numbers, diagnostic metadata.

## 11.6 Brand copy tone

Copy should feel:

- Precise.
- Confident.
- Technical.
- Concise.
- Non-hypey.

Preferred phrases:

- “Portfolio under control”
- “Historical capital flow”
- “Deployed by pool”
- “Rebalance detected”
- “Coverage partial”
- “Accepted run”
- “Residual balances”

Avoid:

- “Moon”
- “Ape”
- “Degen” in core interface.
- Exaggerated hype language.
- Playful fintech copy.

---

# 12. Implementation Priorities

## Phase 1 — Product shell + landing + connected overview

Deliver:

- Landing page.
- Wallet connection flow.
- Connected shell.
- Sidebar.
- Analysis CTA states.
- Overview with recent data from Moralis/Alchemy.
- Tamagui design system tokens and core components.
- Settings basics.

Do not require historical analysis for Overview.

## Phase 2 — Analysis job foundation

Deliver:

- `AnalysisRun`.
- Start/status endpoints.
- Durable or resumable background processing.
- Provider fetch pipeline.
- Raw provider record persistence.
- Basic event classification.
- Price enrichment through Alchemy.
- Idempotency.

## Phase 3 — Pools + activity reconstruction

Deliver:

- Pool model.
- Strategy model.
- Ledger events.
- Asset movements.
- Activity section.
- Pool list/detail.
- Basic rebalance detection.
- Residual attribution state.

## Phase 4 — Positions + rewards

Deliver:

- Position lifecycle model.
- Position list/detail.
- Reward event model.
- Rewards section.
- Reward timeline.
- Return metrics.

## Phase 5 — Governance

Deliver:

- Governance event model.
- Locks.
- Votes.
- Relays.
- Voting fees.
- Bribes/rebases.
- Governance analytics section.

## Phase 6 — Refinement

Deliver:

- Coverage reports.
- Confidence scoring.
- Improved annualized return formula.
- More robust Mellow accounting.
- Better rebalance inference.
- Incremental analysis updates.
- Performance optimization.

---

# 13. Acceptance Criteria Summary

The implementation is acceptable when:

- Disconnected users see a branded landing page and can connect wallet.
- Connected users immediately see Overview without waiting for full historical analysis.
- Historical analysis runs asynchronously and does not block the UI.
- Sidebar sections unlock based on analysis status.
- Moralis is used for wallet/portfolio data.
- Alchemy is used for pricing and historical pricing.
- CoinGecko or unapproved providers are not introduced.
- The app has a Tamagui-based design system using The Cab brand tokens and Google Fonts.
- Pool analytics preserve capital continuity across withdraw/swap/deposit rebalances.
- Residual assets are attributed per pool, not globally per token.
- Manual and Mellow strategies are separated.
- Positions are lifecycle-based.
- Rewards are claim-based, time-valued, and grouped by source.
- Governance is modeled separately from LP positions.
- Activity provides transaction-level explainability.
- All metrics expose confidence/coverage when incomplete.
- Annualized return is labeled as estimated and based on historical capital, not just current portfolio value.
- The product stays analytics-only and never executes user transactions.

---

# 14. Open Questions

These questions should be resolved before or during implementation planning:

1. Which wallet connection library should be used: RainbowKit, wagmi connectors, Privy, ConnectKit, or another provider?
2. Should the MVP support only Base mainnet, or also Base Sepolia for testing?
3. What exact Moralis endpoints will be used for wallet balances, token transfers, NFT positions, and transaction history?
4. What exact Alchemy endpoints will be used for current and historical token pricing?
5. What background job provider should be used for Vercel deployment: Inngest, Trigger.dev, QStash, or another worker?
6. What is the maximum wallet history size expected in MVP?
7. What is the rebalance inference time window: minutes, hours, or same-day?
8. How long should residual attribution remain active before expiring?
9. Which Aerodrome and Mellow contracts are included in MVP support?
10. How should governance rewards be allocated when voting fees are tied to multiple voted pools?
11. Should the user be able to export CSV data from Activity, Pools, Rewards, and Positions?
12. Should The Cab store wallet analysis data permanently, or expire old analysis records?
13. Should analysis refresh automatically after a ready run, or only on user request?
14. What level of Mellow share accounting is required for MVP versus later phases?

---

# 15. Copilot Implementation Note

When implementing this spec, prioritize:

1. Fast connected Overview.
2. Clear async analysis status.
3. Ledger/event model correctness.
4. Pool-level continuity and rebalance attribution.
5. Strategy separation between manual and Mellow.
6. Readable, trusted dashboard UI.
7. Strict brand consistency.
8. No unapproved third-party provider drift.

If a metric cannot be computed confidently, show partial coverage instead of inventing precision.
