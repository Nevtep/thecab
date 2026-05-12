# The Cab — Product & Technical Specification v1.1

## Version

- **Document version:** v1.1
- **Product:** The Cab
- **Scope:** MVP product + technical specification
- **Primary chain:** Base mainnet
- **Primary protocol:** Aerodrome Finance
- **Secondary integration:** Mellow Aerodrome strategies
- **Framework:** Next.js
- **Wallet:** WalletConnect + wagmi
- **Background jobs:** Trigger.dev
- **Design System:** Internal The Cab DS built on Tamagui wrappers

---

# 0. Purpose

This document defines the product, UX, technical architecture, domain model, analytics behavior, background analysis process, branding rules, Design System boundaries, and section-by-section implementation requirements for **The Cab**.

The Cab is a **portfolio command cabin for Aerodrome Finance on Base**. It allows a connected wallet to monitor its current Aerodrome-related portfolio, understand historical capital deployment, analyze pools and positions, inspect rewards and governance activity, and reconstruct meaningful portfolio performance over time.

This specification is written to be consumed by AI-assisted development tools such as Copilot, Cursor, Claude Code, Codex, or similar agents. Its goal is to reduce product drift by making product intent, data boundaries, user flows, analytics semantics, implementation choices, and library boundaries explicit.

---

# 1. Product Overview

## 1.1 Product definition

**The Cab** is a web analytics application for users participating in **Aerodrome Finance** on Base.

It provides:

- A quick wallet-connected overview using recent wallet and market data.
- A deeper historical analysis triggered by the user on demand or automatically when stale.
- Pool-level analytics.
- Position-level lifecycle analytics.
- Rewards and claims analytics.
- Governance analytics for veAERO, locks, votes, relays, and voting rewards.
- Activity-level transaction interpretation.
- Clear separation between manual Aerodrome activity and Mellow-managed strategies.

The product should feel like a **control tower for on-chain capital**: precise, technical, aviation-inspired, dashboard-first, and trustworthy.

## 1.2 Product intent

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

## 1.3 Product non-goals

The Cab must not become:

- A generic DeFi portfolio tracker.
- A transaction execution interface.
- A tax reporting product.
- A full blockchain indexer that performs open-ended server-side analysis continuously.
- A background daemon that analyzes every wallet automatically.
- A system requiring manual reconciliation as a core workflow.
- A retail-trading dashboard with hype-oriented language.

The product’s core promise is **fast portfolio visibility first, deeper historical reconstruction when needed**.

---

# 2. Resolved MVP Decisions

This section resolves the previous open questions and must be treated as product direction for implementation.

## 2.1 Wallet connection library

Use:

- **WalletConnect**
- **wagmi**

Implementation direction:

- Use `wagmi` as the React/EVM wallet state and connector layer.
- Use WalletConnect connector for wallet connection.
- Do not add RainbowKit, Privy, ConnectKit, or another wallet abstraction unless explicitly approved later.
- The internal app should consume wallet state through a The Cab wallet adapter/hook rather than importing wagmi directly in every screen.

Required internal abstraction:

```ts
// example API shape
import { useCabWallet } from "@/design-system/wallet";

const {
  address,
  chainId,
  isConnected,
  connect,
  disconnect,
  connectorName,
} = useCabWallet();
```

## 2.2 Supported chain

MVP supports:

- **Base mainnet only**

Rules:

- Base mainnet is the only production-supported chain.
- Do not support Base Sepolia in MVP product flows.
- If testing utilities are added for development, they must not appear as user-facing MVP network options unless explicitly approved.
- Wrong-network state should instruct the user to switch to Base mainnet.

Base chain ID:

```ts
const SUPPORTED_CHAIN_ID = 8453;
```

## 2.3 Moralis endpoint strategy

Moralis is the primary provider for wallet and portfolio data.

Use Moralis for:

- Wallet balances.
- Wallet token transfers.
- Wallet transaction history.
- NFT/position-related wallet data when needed.
- Decoded wallet history/activity.
- Fast recent Overview data.

Recommended endpoint categories from Moralis Wallet API:

### Wallet token balances

Use Moralis EVM wallet token balances endpoints for ERC-20 balances.

Expected use:

- Current token balances for the connected wallet.
- Fast Overview allocation.
- Idle assets and relevant Aerodrome token holdings.

### Wallet net worth / portfolio value

Use Moralis wallet net worth / portfolio endpoints where available.

Expected use:

- Fast net worth approximation.
- Initial Overview before full analysis.

### Wallet history / decoded transaction history

Use Moralis wallet history endpoints for decoded wallet activity.

Expected use:

- Recent activity list in Overview.
- Candidate transaction discovery for background analysis.
- Detection of wallet interactions with Aerodrome, Mellow, AERO, router, pools, gauges, and governance contracts.

### ERC-20 transfers

Use Moralis ERC-20 transfer endpoints for token movement reconstruction.

Expected use:

- Build `AssetMovement` candidates.
- Identify cash in / cash out.
- Track residual pool-attributed balances.
- Detect transfers out to external wallets.

### NFT transfers / NFT ownership

Use Moralis NFT endpoints where needed for Aerodrome position NFTs.

Expected use:

- Detect manual concentrated-liquidity NFT ownership/transfer.
- Support position identity when NFT token IDs are involved.
- Cross-check wallet ownership of position NFTs.

### Native transactions / raw transactions

Use Moralis transaction endpoints where decoded activity is insufficient.

Expected use:

- Fallback for raw transaction inspection.
- Classification support for unsupported/ambiguous events.

Implementation rule:

- Moralis is not the pricing source of truth for The Cab.
- Moralis may provide USD estimates in fast Overview, but historical valuation and stored `PricePoint` records should use Alchemy.

## 2.4 Alchemy endpoint strategy

Alchemy is the primary provider for pricing and historical pricing.

Use Alchemy Prices API for:

- Current token prices by network/address.
- Historical token prices by address or symbol.
- Event-time valuation.
- Current valuation for snapshots.
- Price enrichment of token-level asset movements.

Recommended endpoints:

### Current token prices by address

Use:

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/by-address
```

Expected use:

- Current price for token balances.
- Overview asset market values.
- Current snapshot valuation.

### Historical token prices

Use:

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/historical
```

Expected use:

- Event-time valuation for `AssetMovement`.
- Historical portfolio/pool/position snapshots.
- Reward valuation at claim time.
- Capital in/out valuation.
- Rebalance valuation.

### Token price by symbol fallback

Use symbol-based pricing only as fallback when contract-address pricing is unavailable or when valuing canonical assets.

Rules:

- Address-based pricing is preferred.
- Symbol fallback must be marked lower confidence.
- The stored `PricePoint` must record source, resolution, and confidence.

Provider rule:

- Do not introduce CoinGecko or any other pricing provider without explicit approval.
- If Alchemy cannot price a token, store a missing-price/partial-coverage record instead of silently substituting another source.

## 2.5 Background job provider

Use:

- **Trigger.dev**

Reason:

- Better suited than raw Vercel functions for long-running wallet-history analysis.
- Integrates with Next.js.
- Supports background tasks outside normal request/response lifecycle.
- Has documented Vercel integration for deployments and environment variable syncing.

Architecture:

- Next.js API route starts analysis by triggering a Trigger.dev task.
- Trigger.dev performs the long-running wallet analysis.
- The database stores progress and results.
- The frontend polls `/api/analysis/status`.
- Vercel serves UI/API.
- Trigger.dev executes analysis pipeline.

Required components:

```txt
/apps/web
  /app
    /api
      /analysis
        /start/route.ts
        /status/route.ts
  /trigger
    analyze-wallet.ts
```

Example flow:

1. User clicks `Analyze wallet`.
2. Frontend calls `POST /api/analysis/start`.
3. Next.js validates wallet and Base mainnet.
4. Next.js creates an `AnalysisRun` in DB with status `queued`.
5. Next.js triggers Trigger.dev task with `{ runId, walletAddress, chainId }`.
6. Trigger.dev runs the analysis pipeline.
7. Trigger.dev updates `AnalysisRun.stage`, `progressPct`, and normalized entities.
8. UI polls `GET /api/analysis/status`.
9. When status is `ready`, sidebar unlocks sections.

## 2.6 Maximum wallet history size

MVP analysis scope:

- **Full wallet history up to one year**

Rules:

- The analysis should inspect Aerodrome/Mellow-relevant wallet history for the previous 365 days.
- If a wallet has older activity, older activity may be ignored in MVP unless needed to understand an open current position.
- If an open position appears to predate the one-year window, mark it as `partial history`.
- Full multi-year reconstruction is out of scope for MVP.

## 2.7 Rebalance inference model

Rebalance inference is **not based on a fixed time window**.

Rebalance is inferred from **remaining pool-attributed balances**.

Example:

1. User had a deposit in `WETH/cbBTC`.
2. User withdraws from that pool.
3. Withdrawal gives the user `+0.1 cbBTC`.
4. The pool now has a residual attributed balance:
   - pool: `WETH/cbBTC`
   - token: `cbBTC`
   - amount: `0.1`
   - status: `waiting_for_rebalance`
5. Later, the user swaps `0.04 cbBTC` for `WETH`.
6. Because `WETH` is the paired token of the original `WETH/cbBTC` pool, this is marked as a rebalance against that pool.
7. The residual attribution is reduced by `0.04 cbBTC`, and the received `WETH` remains attributed to the same pool unless moved elsewhere.

Rules:

- A swap from one pool token to the other pool token is a rebalance.
- A swap from a pool token into an unrelated token is a liquidation from the pool.
- A swap from a pool token into a token belonging to another tracked pool may transfer/reassign attribution to that other pool, depending on context.
- Rebalance detection is driven by the lifecycle of residual attributed balances, not elapsed time.
- There is no fixed minutes/hours/same-day inference window.

## 2.8 Residual attribution expiration

Residual attribution **does not expire**.

A residual balance remains tracked until it is resolved by an actual asset movement.

Resolution states:

- `redeployed_same_pool`
- `rebalanced_same_pool`
- `transferred_to_other_pool`
- `liquidated_to_unrelated_asset`
- `transferred_to_external_wallet`
- `fully_spent`
- `still_waiting`

Rules:

- Do not close attribution because time passed.
- Do not mark residual attribution as expired.
- Always maintain per-pool residual attribution because multiple pools can share the same token.
- If the user has residual `cbBTC` attributed to `WETH/cbBTC`, that attribution remains until a matching token movement resolves it.
- If the token is transferred out of the wallet, classify it as cash out from that pool.
- If the token is swapped for the paired pool token, classify as rebalance.
- If the token is swapped for an unrelated token, classify as liquidation from the pool.
- If the token is swapped for a token of another tracked pool, classify as transfer/reassignment to the other pool where supported.

## 2.9 Aerodrome and Mellow contract support

### Aerodrome

The MVP should avoid maintaining a large hardcoded whitelist.

Instead, use official protocol surfaces and deterministic discovery.

Known key Aerodrome addresses on Base:

```ts
export const AERODROME_BASE = {
  router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
  aeroToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da"
};
```

Discovery approach:

- Identify direct interactions with Aerodrome Router.
- Identify AERO token movements.
- Identify pool interactions derived from Factory/Router.
- Discover pools using official factory/router mechanics instead of keeping a custom pool address list.
- Use Router `poolFor` behavior where possible to derive pool addresses from:
  - token A
  - token B
  - stable flag
  - factory address
- Use official Aerodrome sources as source of truth for core addresses.

Important implementation note:

- Aerodrome Router’s `poolFor` calculates pool addresses deterministically using clone mechanics.
- Offchain code can mirror the deterministic derivation or call/read from contract where appropriate.
- Do not manually curate a long static list of all pools.

### Mellow

Mellow MVP support should use official Mellow documentation for Aerodrome CL strategies.

Rules:

- Use official Mellow Aerodrome CL strategy contract address docs as the source of truth.
- Do not maintain our own unverified list when official docs are available.
- Treat Mellow exposures as strategy-level positions, not as if the user manually owns underlying Aerodrome NFTs.
- For MVP, account for whatever can be reconstructed from Mellow contract events:
  - deposits
  - withdrawals
  - share movements
  - staking/unstaking where applicable
  - reward claims where available
  - wrapper/staking contract relationships where available

## 2.10 Governance rewards allocation

Governance rewards should be displayed **by pool**, matching the way Aerodrome’s own dashboard presents voting fees/rewards.

Rules:

- If a governance reward is associated with a voted pool, allocate/display it under that pool.
- Governance section should still show aggregate governance totals.
- Rewards section should be able to group by reward type and pool.
- Avoid double-counting governance rewards in both pool rewards and governance rewards.
- Use shared `RewardEvent` records with scopes/tags to allow multiple views of the same reward.

## 2.11 CSV export

No CSV/export functionality in MVP.

Rules:

- Do not build export buttons.
- Do not create CSV API endpoints.
- Keep data tables internal to the app.
- Revisit export later after analytics semantics stabilize.

## 2.12 Data retention

Store wallet analysis data in DB permanently.

Rules:

- Analysis data persists unless explicitly deleted by an admin/user feature introduced later.
- Do not auto-expire historical analysis records.
- Future privacy/data deletion workflows can be added later.
- Use permanent storage to support incremental updates and avoid repeated full analysis.

## 2.13 Analysis refresh behavior

Analysis should refresh automatically when data is stale.

Rule:

- When the last successful analysis is **more than one week old**, trigger an analysis update.

Behavior:

- If the user connects a wallet and analysis is older than 7 days:
  - Mark status as `stale`.
  - Trigger incremental update automatically when appropriate.
  - Show sidebar status `Updating…` or `Stale — updating`.
  - Keep existing sections available using last successful data.
- Do not block user access while refreshing.
- If auto-refresh fails, preserve existing data and show retry/update CTA.

## 2.14 Mellow share accounting

MVP Mellow accounting should reconstruct whatever can be obtained reliably from Mellow contract events.

MVP target:

- Display Mellow strategies similarly to manual positions when possible.
- Use contract event data for:
  - strategy deposits
  - strategy withdrawals
  - share balances
  - wrapper exposure
  - staking/reward contract activity
  - reward claims
- Avoid pretending to have perfect underlying position accounting if Mellow does not expose enough data.
- Mark Mellow metrics as partial when only share-level accounting is available.
- Later phases can add deeper strategy-specific valuation if required.

---

# 3. User Modes

The application has two major modes:

1. **Disconnected mode**
2. **Connected wallet mode**

Authentication is wallet-based. The initial product supports one connected wallet at a time.

---

# 4. Disconnected Experience

## 4.1 Layout

When no wallet is connected, the application shows a public landing experience.

The disconnected layout must include:

- A horizontal top navigation bar.
- Brand logo / wordmark.
- Navigation anchors for landing sections.
- Primary CTA: connect wallet.
- Optional secondary CTA: learn how analysis works.
- A visual hero section that communicates aviation + DeFi analytics.

The top menu should remain visible while the user scrolls through the landing page.

## 4.2 Landing purpose

The landing page introduces The Cab to new users and should communicate:

- The Cab is a control tower for Aerodrome portfolios.
- The user connects a wallet to get an immediate dashboard.
- The app shows quick recent analytics first.
- A deeper historical analysis can be requested or auto-refreshed when stale.
- Once historical analysis is ready, more sections unlock.
- The product supports Aerodrome manual activity and Mellow strategies.
- The app does not require the user to manually reconstruct transactions.

---

# 5. Connected Application Layout

## 5.1 Shell

Once a wallet is connected, the user is redirected to the connected app shell.

The connected layout must include:

- Vertical left sidebar.
- Wallet identity area.
- Navigation sections.
- Analysis CTA/status module.
- Main content panel.
- Optional top status bar for sync state, data age, chain, and selected wallet.

## 5.2 Sidebar navigation

Sidebar sections:

1. Overview
2. Pools
3. Positions
4. Rewards
5. Governance
6. Activity
7. Settings

Rewards and Governance are first-class sections because they are explicit product modules and should not be hidden inside Activity.

## 5.3 Section availability states

Sections are enabled or disabled based on analysis status.

Initial connected state:

- Overview: enabled.
- Pools: disabled until analysis ready.
- Positions: disabled until analysis ready.
- Rewards: disabled until analysis ready.
- Governance: disabled until analysis ready.
- Activity: disabled or limited to recent activity preview until analysis ready.
- Settings: enabled.

Reason:

- Overview can use recent API data from Moralis and Alchemy.
- Deep sections require normalized historical analysis.

## 5.4 Analysis CTA states

The sidebar includes a CTA for starting wallet analysis.

Supported states:

### Not analyzed

- CTA label: `Analyze wallet`
- Sections requiring historical analysis are disabled.
- Disabled sections should show lock/disabled styling and tooltip:
  - “Run historical analysis to unlock this section.”

### Analysis requested / queued

- CTA label: `Queued`
- CTA disabled.
- Show message:
  - “Historical analysis queued. We’ll notify you when it’s ready.”

### Analysis running

- CTA label: `Analyzing…`
- CTA disabled.
- Show progress state when available.
- User can keep navigating Overview and any already available partial surfaces.

### Analysis ready

- CTA replaced or supplemented by status badge:
  - `Ready`
  - Optional brand alternative: `Cleared`
- Sections unlock.
- User can trigger refresh/update analysis when needed.

### Analysis stale

- Status badge:
  - `Stale`
- If older than 7 days, trigger incremental update automatically.
- Existing analyzed sections remain available using last successful data.
- Show update status.

### Analysis failed

- CTA label: `Retry analysis`
- Show error summary.
- Preserve all previously available data.
- Do not block Overview.

## 5.5 Polling behavior

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

# 6. Technical Architecture

## 6.1 Framework

The application will be developed in **Next.js**.

Next.js responsibilities:

- Public landing pages.
- Connected app shell.
- API routes.
- Background job orchestration endpoints.
- Server-side data fetching where appropriate.
- Client-side dashboard rendering.
- Integration with database and third-party APIs.

## 6.2 Wallet architecture

Use:

- wagmi
- WalletConnect

Architecture rule:

- Screens/components must not call wagmi directly unless they are in the wallet adapter layer.
- Create a The Cab wallet adapter/hook.
- The app consumes wallet state from internal abstractions.

Suggested files:

```txt
src/wallet/createWagmiConfig.ts
src/wallet/CabWalletProvider.tsx
src/wallet/useCabWallet.ts
src/wallet/supportedChains.ts
```

Supported chain config:

```ts
export const SUPPORTED_CHAIN = {
  id: 8453,
  name: "Base",
  network: "base"
};
```

## 6.3 Third-party APIs

The application integrates with two third-party API providers:

### Moralis

Primary use:

- Wallet portfolio data.
- Wallet balances.
- Recent wallet activity.
- Token transfers.
- NFT/position-related data when available.
- Fast current and recent wallet overview.
- Candidate historical transaction discovery.

### Alchemy

Primary use:

- Token prices.
- Historical prices.
- Price enrichment for event-time valuation.
- Current valuation for snapshots.
- Base chain data where Alchemy is stronger or more reliable.

Important provider rule:

- Do not introduce CoinGecko or other pricing providers unless explicitly approved.
- The expected pricing provider is Alchemy.
- Provider abstractions may exist, but Alchemy must be the configured implementation for pricing in this spec.

## 6.4 Data strategy

The product has two data layers:

### Fast recent layer

Used for Overview before full analysis is complete.

Characteristics:

- Fetches recent data quickly.
- Focuses on last 7 days by default.
- May use direct API responses without full normalization.
- Used to populate current portfolio, recent activity, current balances, and basic charts.
- Should expose coverage/limitations clearly.

### Historical analysis layer

Used for deep sections.

Characteristics:

- Triggered on demand by the user or automatically when stale.
- Runs asynchronously/non-blocking in Trigger.dev.
- Fetches full wallet transaction history relevant to Aerodrome/Mellow up to one year.
- Classifies transactions into normalized domain events.
- Enriches events with historical prices.
- Computes snapshots and metrics.
- Stores normalized model in database.
- Unlocks deep sections when complete.

## 6.5 Database

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
- Residual attribution states.
- Raw provider records.
- Reward events.
- Governance events.

Recommended database:

- PostgreSQL.

Implementation may use:

- Drizzle ORM for typed schema and migrations.
- Raw SQL migrations for auditability.

## 6.6 API design

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
- Chain ID supported.
- Connected wallet matches requested wallet via signature.
- Analysis availability for deep routes.

---

# 7. Design System

## 7.1 Requirement

The Cab must have a coherent internal Design System instead of ad hoc styling.

The UI must integrate:

- **Tamagui** as the low-level component/styling system.
- **Google Fonts** for the brand font stack.
- **Lucide React** as the icon library.
- **Recharts** as the charting library.
- Brand tokens derived from The Cab brand specification.
- Reusable components for dashboard surfaces.
- Consistent spacing, typography, surfaces, charts, and semantic states.

## 7.2 Third-party library boundary rule

All third-party UI libraries must be wrapped inside the internal The Cab Design System.

The application must consume only internal DS exports.

This means:

- Product screens must not import Tamagui primitives directly.
- Product screens must not import Lucide icons directly.
- Product screens must not import Recharts components directly.
- Product screens must not import raw Google font objects directly.
- Product screens must not import third-party UI helpers directly.

Instead, product code must import from:

```ts
import {
  CabButton,
  CabCard,
  CabIcon,
  CabLineChart,
  CabAreaChart,
  CabPoolValueChart,
  CabRewardsTimelineChart,
  CabSidebar,
  CabMetricCard,
} from "@/design-system";
```

Rationale:

- If Tamagui, Lucide, Recharts, or another dependency changes later, the change is isolated to the Design System.
- Product screens remain stable.
- Brand consistency is enforceable.
- AI-assisted coding has fewer opportunities to drift into arbitrary third-party usage.

## 7.3 Approved third-party libraries for UI MVP

### Component/styling base

Use:

- `tamagui`

Usage:

- Only inside DS primitives and composed DS components.
- Product screens use Cab-prefixed components.

### Icons

Use:

- `lucide-react`

Usage:

- Only inside `CabIcon` / icon registry wrappers.
- Product screens should pass semantic icon names instead of importing icon components.

Example:

```tsx
<CabIcon name="radar" size="sm" tone="signal" />
<CabIcon name="wallet" size="md" tone="muted" />
<CabIcon name="alert-triangle" size="sm" tone="warning" />
```

### Charts

Use:

- `recharts`

Usage:

- Only inside chart wrappers.
- Product screens should pass typed chart data and config to DS chart components.
- Product screens should not construct raw Recharts components.

Example:

```tsx
<CabPoolValueChart
  data={poolValueSeries}
  series={[
    { key: "deployedValueUsd", label: "Deployed" },
    { key: "residualValueUsd", label: "Residual" },
    { key: "rewardValueUsd", label: "Rewards" }
  ]}
/>
```

### Fonts

Use Google Fonts:

- `Orbitron`
- `Inter`
- `IBM Plex Mono`

Usage:

- Font loading/config belongs to app root and DS theme/tokens.
- Product screens should use typography components or text variants.

## 7.4 Suggested DS folder structure

```txt
src/design-system
  index.ts

  /tokens
    colors.ts
    fonts.ts
    spacing.ts
    radius.ts
    shadows.ts
    zIndex.ts

  /theme
    tamagui.config.ts
    CabThemeProvider.tsx

  /primitives
    CabBox.tsx
    CabText.tsx
    CabStack.tsx
    CabButton.tsx
    CabCard.tsx
    CabInput.tsx
    CabBadge.tsx
    CabSeparator.tsx
    CabTooltip.tsx

  /icons
    CabIcon.tsx
    iconRegistry.ts

  /charts
    CabChartFrame.tsx
    CabLineChart.tsx
    CabAreaChart.tsx
    CabBarChart.tsx
    CabDonutChart.tsx
    CabPoolValueChart.tsx
    CabPortfolioEvolutionChart.tsx
    CabRewardsTimelineChart.tsx
    CabRebalanceTimelineChart.tsx

  /layout
    DisconnectedShell.tsx
    ConnectedShell.tsx
    CabSidebar.tsx
    CabTopNav.tsx
    CabDashboardGrid.tsx
    CabSectionHeader.tsx

  /data-display
    CabMetricCard.tsx
    CabKpiStrip.tsx
    CabDataPanel.tsx
    CabCoverageBadge.tsx
    CabAnalysisStatusBadge.tsx
    CabTokenAmount.tsx
    CabUsdValue.tsx
    CabWalletAddress.tsx
    CabTxHash.tsx

  /feedback
    CabEmptyState.tsx
    CabPartialCoverageNotice.tsx
    CabUnsupportedEventNotice.tsx
    CabLoadingPanel.tsx
    CabErrorPanel.tsx
```

## 7.5 Import policy

Allowed in app/product screens:

```ts
import { CabButton, CabCard, CabText } from "@/design-system";
import { useCabWallet } from "@/wallet/useCabWallet";
```

Forbidden in app/product screens:

```ts
import { Button } from "tamagui";
import { Radar } from "lucide-react";
import { LineChart } from "recharts";
```

Allowed inside Design System only:

```ts
import { Button, XStack, YStack } from "tamagui";
import { Radar, Wallet, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis } from "recharts";
```

## 7.6 Font stack

Use Google Fonts:

- `Orbitron` for brand/display/headline moments.
- `Inter` for UI, body, navigation, cards, labels, and tables.
- `IBM Plex Mono` for wallet addresses, tx hashes, timestamps, block numbers, and technical metadata.

Rules:

- Do not use Orbitron for dense UI, tables, or long body copy.
- Use Inter as the default product font.
- Use IBM Plex Mono only as a technical accent.
- Apply `font-variant-numeric: tabular-nums` to financial values, balances, timestamps, tables, and KPI values.

## 7.7 Tamagui token requirements

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

## 7.8 Component families

Required reusable component groups:

### Layout

- `DisconnectedShell`
- `ConnectedShell`
- `CabSidebar`
- `CabTopNav`
- `CabDashboardGrid`
- `CabSectionHeader`

### Data display

- `CabMetricCard`
- `CabKpiStrip`
- `CabDataPanel`
- `CabChartPanel`
- `CabCoverageBadge`
- `CabAnalysisStatusBadge`
- `CabTokenAmount`
- `CabUsdValue`
- `CabWalletAddress`
- `CabTxHash`

### Navigation

- `CabSidebarNavItem`
- `CabSectionLockState`
- `CabAnalysisCta`
- `CabRangeSelector`
- `CabFilterBar`

### Feedback

- `CabEmptyState`
- `CabPartialCoverageNotice`
- `CabUnsupportedEventNotice`
- `CabLoadingPanel`
- `CabErrorPanel`

### DeFi analytics

- `CabPoolCard`
- `CabPositionCard`
- `CabRewardTimeline`
- `CabActivityEventRow`
- `CabRebalanceMarker`
- `CabResidualAttributionPanel`

## 7.9 Chart styling

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

## 7.10 DS acceptance criteria

The implementation is not acceptable if:

- Product screens import from `tamagui`.
- Product screens import from `lucide-react`.
- Product screens import from `recharts`.
- Product screens use hardcoded brand colors instead of tokens.
- Product screens build custom chart primitives directly.
- Product screens bypass Cab-prefixed DS components for common UI.

---

# 8. Background Historical Analysis Job

## 8.1 Purpose

The background analysis job reconstructs the historical Aerodrome/Mellow activity of a wallet.

It must populate the domain model so each section can display historical data clearly and consistently.

The job is not a general open-ended chain indexer. It is a wallet-scoped, user-requested or stale-triggered reconstruction pipeline.

## 8.2 Job trigger

The user starts analysis from the connected sidebar CTA, or the app triggers update when analysis is older than one week.

Frontend call:

```http
POST /api/analysis/start
```

Request:

```json
{
  "walletAddress": "0x...",
  "chainId": 8453,
  "mode": "full_history | incremental_update"
}
```

Response:

```json
{
  "runId": "analysis_run_id",
  "status": "queued"
}
```

## 8.3 Trigger.dev architecture

Trigger.dev task:

```ts
export const analyzeWalletTask = task({
  id: "analyze-wallet",
  run: async ({ runId, walletAddress, chainId, mode }) => {
    // run wallet analysis pipeline
  }
});
```

Responsibilities:

- Fetch relevant wallet history.
- Persist raw provider records.
- Classify events.
- Enrich with prices.
- Build ledger events and asset movements.
- Track residual attribution.
- Compute snapshots.
- Mark analysis ready/failed.

Next.js responsibilities:

- Validate wallet/chain.
- Create/update `AnalysisRun`.
- Trigger the task.
- Return immediately.
- Expose status to UI.

## 8.4 Serverless hosting constraint

Vercel serverless functions are not ideal for long-running processes. Therefore:

- Do not process full wallet history inside a single Next.js route.
- Use Trigger.dev for long-running work.
- Next.js routes should only enqueue and report status.
- Trigger.dev should own the analysis lifecycle.

## 8.5 Analysis pipeline stages

The pipeline should be deterministic and restartable.

### Stage 1 — Initialize run

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

### Stage 2 — Fetch transaction history

Fetch wallet history from Moralis/Alchemy.

Scope:

- Base mainnet.
- Last 365 days.
- Include older activity only when needed to understand an open position.

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
- Swaps involving pool tokens around residual attribution states.

Persist raw provider records or raw event envelopes for auditability.

### Stage 3 — Identify supported protocol surfaces

Classify raw transactions into supported interaction families:

- Aerodrome manual LP.
- Aerodrome swaps.
- Aerodrome gauges.
- Aerodrome rewards.
- Mellow Aerodrome strategy.
- veAERO governance.
- Unknown/unsupported.
- Malicious/spam.

### Stage 4 — Normalize ledger events

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

### Stage 5 — Build asset movements

For each ledger event, create token-level `AssetMovement` records.

Each movement must include:

- Token address.
- Symbol.
- Raw amount.
- Normalized amount.
- Direction.
- USD value at event time.
- Price source.

### Stage 6 — Price enrichment

Use Alchemy for historical price enrichment.

Requirements:

- Price every relevant asset movement at event time.
- Store `PricePoint` records.
- Track source, confidence, and resolution.
- If exact timestamp pricing is unavailable, use nearest acceptable resolution and mark confidence accordingly.
- Avoid silently using another provider.

### Stage 7 — Build pools, strategies, and positions

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

### Stage 8 — Track residual attribution and detect rebalances

Rebalance detection is residual-balance-based.

When a pool withdrawal occurs:

- Create residual attribution for withdrawn pool tokens.
- Mark attribution state as `waiting_for_rebalance`.
- Keep attribution open indefinitely until resolved.

When a later movement uses attributed token balance:

- If swapped into the paired token of the same pool: classify as same-pool rebalance.
- If swapped into an unrelated token: classify as liquidation/cashout from the pool.
- If swapped into a token associated with another active/tracked pool: classify as transfer/reassignment where supported.
- If transferred out of the wallet: classify as external cashout.
- If redeposited into same pool: classify as redeployment.

This avoids misleading pool charts that drop to zero during a rebalance process.

### Stage 9 — Compute snapshots

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
- Idle asset value.
- Residual attributed value.
- Estimated annualized return.
- Coverage/confidence.

### Stage 10 — Mark run complete

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

## 8.6 Idempotency

Every analysis stage must be idempotent.

Recommended unique keys:

- `LedgerEvent`: wallet + chain + txHash + logIndex + eventType + protocol.
- `AssetMovement`: ledgerEventId + tokenAddress + direction + amountRaw + movementIndex.
- `PricePoint`: tokenAddress + timestamp bucket + source + resolution.
- `PositionInstance`: strategy + tokenId for manual, strategy + wrapper/share identity for Mellow.
- `AnalysisRun`: runId.
- `AttributionState`: wallet + poolId + tokenAddress + sourceLedgerEventId.

A repeated run must not duplicate events or inflate metrics.

## 8.7 Incremental updates

After an initial full historical run, future updates should be incremental.

Update behavior:

- Start from `lastIndexedBlock` or last successful cursor.
- Fetch only new wallet activity.
- Recompute affected snapshots.
- Preserve previous historical data.
- Mark old snapshots as superseded if snapshot versioning is used.

Auto-update rule:

- If last successful analysis is older than 7 days, trigger incremental update.
- Keep previous ready data visible while the update runs.

---

# 9. Domain Model

The initial data model remains the primary structure, with additions required for analysis status, raw provider auditability, residual attribution, rewards, governance, and coverage.

## 9.1 Existing core model

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

Design principles:

- Pool-first analysis.
- Strategy isolation.
- Position lifecycle integrity.
- Ledger-first truth.
- Portfolio completeness.

## 9.2 Required additions

### AnalysisRun

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

### RawProviderRecord

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

### GovernanceEvent

Governance can be represented through `LedgerEvent`, but a dedicated derived entity makes the Governance section easier to query.

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
- `poolId`
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

### RewardEvent

Rewards can also be represented through `LedgerEvent`, but a dedicated derived entity helps Rewards analytics.

Fields:

- `rewardEventId`
- `walletAddress`
- `poolId`
- `strategyId`
- `positionInstanceId`
- `governanceEventId`
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

### AttributionState

Tracks residual pool-attributed assets after withdraw/rebalance operations.

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

Status candidates:

- `waiting_for_rebalance`
- `rebalanced_same_pool`
- `redeployed_same_pool`
- `transferred_to_other_pool`
- `liquidated_to_unrelated_asset`
- `transferred_to_external_wallet`
- `fully_spent`
- `still_waiting`

Important:

- There is no expiration status.
- Attribution does not expire due to elapsed time.

### CoverageReport

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

---

# 10. Metrics & Financial Semantics

## 10.1 Base valuation

All primary analytics should be USD/USDC-centric.

Rules:

- Use USD as display unit.
- Treat USDC as the practical stable reference.
- Store event-time USD valuations for historical accuracy.
- Store current USD valuations for open exposure.
- Never mix nominal token amount returns with USD returns without labeling clearly.

## 10.2 Capital entered

Capital entered is external value deployed into an Aerodrome/Mellow/governance scope.

Examples:

- Tokens deposited into a manual LP position.
- Tokens deposited into a Mellow strategy.
- AERO locked into veAERO.
- Idle assets explicitly allocated into a tracked Aerodrome operation.

Do not count internal movement twice.

## 10.3 Capital withdrawn

Capital withdrawn is value leaving a tracked scope.

Examples:

- Withdraw from LP position to wallet.
- Withdraw from Mellow.
- Transfer residual assets away.
- Swap into unrelated assets after exiting a pool.
- Unlock/exit governance exposure when applicable.

## 10.4 Residual pool capital

When a user withdraws from a pool but keeps the withdrawn assets in the wallet, those assets remain economically attributed to the pool until resolved by actual movement.

This is required because:

- A withdraw does not necessarily mean the user exited the pool economically.
- The user may be rebalancing.
- Multiple pools may share one token.
- Pool-level charts should show economic continuity.

Residual attribution ends only when:

- The assets are transferred out.
- The assets are swapped into unrelated assets.
- The assets are swapped into a same-pool token as rebalance.
- The assets are redeployed into the same pool.
- The assets are transferred/reassigned to another pool.

Residual attribution does not expire.

## 10.5 Realized PnL

Realized PnL should reflect value made or lost when capital is closed, withdrawn, swapped, claimed, or otherwise crystallized.

Examples:

- Fees collected.
- Rewards claimed.
- Gains/losses from rebalance swaps.
- Difference between capital entered and capital withdrawn for closed exposure.

## 10.6 Unrealized PnL

Unrealized PnL reflects current market value change of open exposure.

Examples:

- Open LP position value change.
- Mellow share value change.
- Idle residual pool assets still attributed to a pool.
- veAERO lock value where supported.

## 10.7 Asset price effect

Asset price effect isolates gains/losses caused by market movement of held assets.

This should be separated from:

- Claim rewards.
- LP fees.
- Rebalance gains/losses.
- Fresh capital deposits.
- Withdrawals.

## 10.8 Rewards return

Rewards return includes realized claimed value from:

- LP fees.
- Gauge rewards.
- Mellow rewards.
- Voting fees.
- Bribes.
- Rebases where applicable.

Rewards should be shown separately from total PnL and also included in total return when appropriate.

## 10.9 Estimated annualized return

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

# 11. Application Sections

## 11.1 Landing

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
6. Refresh analysis later or let stale data auto-update.

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

## 11.2 Overview

### Purpose

Overview is the first connected dashboard.

It provides immediate insight using recent wallet data before full historical analysis is complete.

### Availability

Overview is always available after wallet connection.

It should work even when historical analysis has not been run.

### Data source

Initial Overview data should use:

- Moralis wallet/portfolio APIs.
- Alchemy current and historical pricing APIs.
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

## 11.3 Pools

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

- Pool value must not reset to zero simply because of a withdraw if withdrawn assets remain attributable to that pool.
- Residual assets should remain part of pool-level value until attribution resolves.

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
- Attribution status.
- Confidence.

This is necessary because several pools may share the same token, and residual balances must be tracked individually per pool.

### Pool attribution rules

When a withdraw occurs:

- Create or update `AttributionState`.
- Keep withdrawn token amounts attributed to original pool.
- If matching same-pool token swap occurs, classify as rebalance.
- If token is transferred away, close attribution as `transferred_to_external_wallet`.
- If token is swapped into unrelated assets, close as `liquidated_to_unrelated_asset`.
- If token moves into another tracked pool, transfer/reassign attribution where supported.
- Never expire attribution merely because time passed.

### Acceptance criteria

- Pools are unavailable until analysis is ready.
- Each pool is a stable analytical unit.
- Manual and Mellow strategies are separated.
- Rebalance detection preserves economic continuity.
- Residual assets are tracked per pool, not globally per token.
- Pool charts do not show misleading zero-value drops during rebalance sequences.
- Confidence/coverage is visible when inference is partial.

---

## 11.4 Positions

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

## 11.5 Rewards

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

## 11.6 Governance

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

Governance rewards should be allocated and displayed by pool where Aerodrome provides that association.

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
- Governance rewards can be displayed by pool.

---

## 11.7 Activity

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
- Related residual attribution state.
- Related swap(s).
- Related deposit/increase event if applicable.
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

## 11.8 Settings

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
- Optional later: delete stored wallet analysis data.

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

# 12. Branding

The Cab must follow the approved brand specification.

## 12.1 Brand positioning

The Cab should feel:

- Technical.
- Futuristic.
- Precise.
- Premium.
- Masculine.
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

## 12.2 Core concept

The Cab is a **control tower for on-chain portfolios**.

The visual system should communicate:

- Oversight.
- Signal clarity.
- Navigation.
- Capital flow monitoring.
- Technical confidence.
- Operational awareness.

The UI should feel like a **premium control surface**, not a casual crypto dashboard.

## 12.3 Visual direction

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

## 12.4 Color palette

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

## 12.5 Typography

Use:

- Orbitron for logo, hero titles, main page titles, major dashboard section anchors.
- Inter for navigation, cards, body copy, labels, tables, controls.
- IBM Plex Mono for wallet snippets, tx hashes, timestamps, block numbers, diagnostic metadata.

## 12.6 Brand copy tone

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

# 13. Implementation Priorities

## Phase 1 — Product shell + landing + connected overview

Deliver:

- Landing page.
- WalletConnect + wagmi connection flow.
- Base mainnet enforcement.
- Connected shell.
- Sidebar.
- Analysis CTA states.
- Overview with recent data from Moralis/Alchemy.
- Tamagui-based internal DS tokens and core components.
- Lucide wrapped via DS.
- Recharts wrapped via DS.
- Settings basics.

Do not require historical analysis for Overview.

## Phase 2 — Analysis job foundation

Deliver:

- Trigger.dev integration.
- `AnalysisRun`.
- Start/status endpoints.
- Durable background processing.
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
- Residual attribution model.
- Rebalance detection based on remaining pool-attributed balances.

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
- Governance reward display by pool.

## Phase 6 — Refinement

Deliver:

- Coverage reports.
- Confidence scoring.
- Improved annualized return formula.
- More robust Mellow accounting.
- Better cross-pool attribution.
- Incremental analysis updates.
- Performance optimization.

---

# 14. Acceptance Criteria Summary

The implementation is acceptable when:

- Disconnected users see a branded landing page and can connect wallet.
- Wallet connection uses WalletConnect + wagmi.
- MVP supports Base mainnet only.
- Connected users immediately see Overview without waiting for full historical analysis.
- Historical analysis runs asynchronously through Trigger.dev and does not block the UI.
- Sidebar sections unlock based on analysis status.
- Moralis is used for wallet/portfolio/history data.
- Alchemy is used for pricing and historical pricing.
- CoinGecko or unapproved providers are not introduced.
- The app has a Tamagui-based internal Design System using The Cab brand tokens and Google Fonts.
- Lucide React is used only through DS icon wrappers.
- Recharts is used only through DS chart wrappers.
- Product screens do not import third-party UI libraries directly.
- Pool analytics preserve capital continuity across withdraw/swap/deposit/rebalance flows.
- Residual assets are attributed per pool, not globally per token.
- Residual attribution does not expire.
- Manual and Mellow strategies are separated.
- Positions are lifecycle-based.
- Mellow accounting uses reliably available contract events and marks partial coverage where needed.
- Rewards are claim-based, time-valued, and grouped by source.
- Governance rewards are displayed by pool where supported.
- Governance is modeled separately from LP positions.
- Activity provides transaction-level explainability.
- All metrics expose confidence/coverage when incomplete.
- Annualized return is labeled as estimated and based on historical capital, not just current portfolio value.
- Wallet analysis data is stored permanently.
- Analysis auto-refreshes when older than one week.
- No CSV/export is implemented in MVP.
- The product stays analytics-only and never executes user transactions.

---

# 15. External Source References

Use official sources of truth where possible:

- Moralis Wallet API documentation for wallet balances, history, transfers, NFTs, and decoded activity.
- Alchemy Prices API documentation for current and historical token prices.
- Trigger.dev Next.js and Vercel integration documentation for background jobs.
- Aerodrome official contract/address documentation and verified router contract source for Router/Factory/AERO discovery.
- Mellow official Aerodrome CL strategy contract address documentation.

Do not maintain custom protocol address lists when official discovery or official documentation is available.
Do not add unapproved providers for pricing or wallet analytics.

---

# 16. Copilot Implementation Note

When implementing this spec, prioritize:

1. Fast connected Overview.
2. Clear async analysis status.
3. Correct DS boundaries and no direct third-party UI imports in product screens.
4. Ledger/event model correctness.
5. Residual attribution model.
6. Pool-level continuity and rebalance attribution.
7. Strategy separation between manual and Mellow.
8. Readable, trusted dashboard UI.
9. Strict brand consistency.
10. No unapproved third-party provider drift.

If a metric cannot be computed confidently, show partial coverage instead of inventing precision.
