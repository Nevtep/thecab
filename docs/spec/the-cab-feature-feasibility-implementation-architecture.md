# The Cab — Feature Feasibility & Implementation Architecture v1.2

## Document role

This document complements **The Cab Product & Technical Specification v1.4.3**.

It translates the product spec into an implementation-oriented feasibility plan.

For each feature, it defines:

- feasibility level;
- what data is obtainable from Moralis;
- what data is obtainable from Alchemy;
- what must be extended through RPC / contract reads / event logs;
- how data must be persisted;
- how raw data maps into the domain model;
- how the UI should display the result;
- implementation risks;
- confidence and coverage rules;
- chain-aware implementation requirements;
- internationalization/localization implementation requirements.

This document is intended to guide AI-assisted coding by preventing:

- provider drift;
- unclear data ownership;
- incorrect assumptions about public APIs;
- Base-only assumptions leaking into the domain model;
- address-only database identities;
- UI sections consuming provider data directly instead of normalized domain data;
- hardcoded user-facing copy;
- inconsistent English/Spanish translation resources.

---

# 0. Executive summary

The Cab is feasible as a product, but the implementation must be split into these layers:

```txt
Fast API layer
  -> uses Moralis + Alchemy
  -> powers quick Overview and candidate activity discovery

Protocol reconstruction layer
  -> uses RPC, event logs, contract reads, ABIs, official protocol metadata
  -> powers Pools, Deposits, Strategies, Rewards, Governance, Activity

Localization layer
  -> uses i18next + react-i18next + browser language detection
  -> powers all user-facing copy, labels, tooltips, empty states, errors, charts, and formatting
```

Product v1 remains **Base mainnet only**, but the implementation must be **chain-aware from day one**.

Product v1 languages:

```txt
Default/base language: English
Secondary language:    Spanish
Locale selection:      browser language detection
Fallback:              English
```

The app must not be built as:

```txt
hardcoded English copy -> UI
```

It must be built as:

```txt
translation keys -> i18next resources -> localized UI
```

---

# 1. High-level feasibility

| Feature | Feasibility | Moralis / Alchemy enough? | RPC required? | Chain-aware requirement | i18n requirement |
|---|---:|---:|---:|---|---|
| Landing | High | N/A | No | No chain state beyond copy | Fully localized EN/ES |
| Wallet connection | High | N/A | No | Enforce Base for v1; preserve chain state | Localized wallet states/errors |
| Overview recent dashboard | High | Mostly yes | Optional | Query and prices scoped by `chainId` | Localized labels/charts/formatting |
| Analysis status | High | N/A | No | `AnalysisRun = walletAddress + chainId` | Localized statuses/toasts |
| Pools | Medium | No | Yes | `Pool = chainId + poolAddress` | Localized table headers, filters, empty states |
| Deposits | Medium | No | Yes | NFT identity requires `chainId + contract + tokenId` | Localized lifecycle labels |
| Strategies / Mellow | Medium-Low initially | No | Yes | `Strategy = chainId + wrapper/vault/strategy address` | Localized coverage and strategy labels |
| Rewards | Medium | Partially | Yes | Reward scope must include `chainId` | Localized reward sources and metrics |
| Governance | Medium | Partially | Yes | veAERO/Voter/fees/bribes are chain-scoped | Localized governance events |
| Activity raw | High | Partially | Optional | `Activity = chainId + txHash + logIndex/event` | Localized event type display |
| Activity enriched | Medium | Partially | Yes | Requires chain-scoped decoding | Localized classification labels |
| Settings | High | N/A | No | Settings may default by chain | Localized language settings |
| Background analysis | Medium | Partially | Yes | Every run scoped to wallet + chain | Localized run stages/errors in UI |

---

# 2. Chain-aware architecture

## 2.1 Product v1 scope

Product v1 supports:

```txt
Base mainnet only
chainId = 8453
```

However, the implementation must prepare for future Aero multi-chain expansion.

Future chains may include:

- Base;
- Optimism;
- Ethereum mainnet;
- Circle Arc or another EVM-compatible network;
- additional Aero-supported networks.

## 2.2 Chain configuration layer

All chain-specific values must live in one configuration layer.

Suggested file:

```txt
src/chains/chains.ts
```

Suggested shape:

```ts
export const SUPPORTED_CHAINS = {
  base: {
    chainId: 8453,
    name: "Base",
    slug: "base",
    isProductV1Enabled: true,
    moralisChain: "base",
    alchemyNetwork: "base-mainnet",
    nativeCurrencySymbol: "ETH",
    explorerBaseUrl: "https://basescan.org",
  },
} as const;
```

Required helpers:

```ts
getSupportedChain(chainId)
assertSupportedChain(chainId)
getMoralisChain(chainId)
getAlchemyNetwork(chainId)
getRpcClient(chainId)
getAlchemyClient(chainId)
getExplorerBaseUrl(chainId)
```

Rules:

- Do not scatter `"base"`, `"base-mainnet"`, or `8453` across feature code.
- Product v1 can default to Base.
- Every feature query, API call, provider client, and DB query must still accept or derive `chainId`.

## 2.3 Database identity rules

Never key protocol entities by address alone.

Use:

```txt
chainId + address
```

Examples:

| Entity | Identity rule |
|---|---|
| `ProtocolContract` | `chainId + address` |
| `Pool` | `chainId + poolAddress` |
| `Deposit` | `chainId + walletAddress + deposit identity` |
| `Strategy` | `chainId + wrapperAddress` or `chainId + strategyContractAddress` |
| `StrategyExposure` | `chainId + walletAddress + strategyId` |
| `LedgerEvent` | `chainId + txHash + logIndex + eventType` |
| `AssetMovement` | `chainId + ledgerEventId + movementIndex` |
| `PricePoint` | `chainId + tokenAddress + timestamp + source + resolution` |
| `RewardEvent` | `chainId + txHash + logIndex/movementIndex + rewardType` |
| `GovernanceEvent` | `chainId + txHash + logIndex/eventType` |
| `AttributionState` | `chainId + walletAddress + poolId + tokenAddress + sourceLedgerEventId` |
| `AttributionSourceLot` | `chainId + walletAddress + tokenAddress + sourceType + sourceLedgerEventId` |

NFT identity must use:

```txt
chainId + contractAddress + tokenId
```

Transaction identity must use:

```txt
chainId + txHash
```

## 2.4 Provider call rules

Every provider call must be chain-aware.

### Moralis

Moralis calls must derive `chain` from `chainId`.

Product v1:

```txt
chainId = 8453
moralisChain = base
```

### Alchemy Prices

Alchemy price calls must use token address + chain/network.

Product v1:

```txt
chainId = 8453
alchemyNetwork = base-mainnet
```

### Alchemy RPC

RPC endpoints must be selected by `chainId`.

Product v1:

```txt
https://base-mainnet.g.alchemy.com/v2/{apiKey}
```

Future chains must be added in the chain config, not hardcoded inside provider modules.

## 2.5 API route rules

All feature APIs should accept or derive `chainId`.

Examples:

```http
GET /api/wallet/overview?chainId=8453
GET /api/pools?chainId=8453
GET /api/pools/:poolId?chainId=8453
GET /api/deposits?chainId=8453
GET /api/deposits/:depositId?chainId=8453
GET /api/strategies?chainId=8453
GET /api/strategies/:strategyId?chainId=8453
GET /api/rewards?chainId=8453
GET /api/governance?chainId=8453
GET /api/activity?chainId=8453
GET /api/settings?chainId=8453
POST /api/analysis/start
```

`POST /api/analysis/start` request:

```json
{
  "walletAddress": "0x...",
  "chainId": 8453,
  "mode": "full_history"
}
```

## 2.6 TanStack Query key rules

All query keys for wallet/protocol data must include `chainId`.

Examples:

```ts
["overview", chainId, walletAddress]
["analysis-status", chainId, walletAddress]
["pools", chainId, walletAddress, filters]
["pool", chainId, poolId]
["deposits", chainId, walletAddress, filters]
["deposit", chainId, depositId]
["strategies", chainId, walletAddress, filters]
["strategy", chainId, strategyId]
["rewards", chainId, walletAddress, filters]
["governance", chainId, walletAddress, filters]
["activity", chainId, walletAddress, filters]
```

Do not create query keys such as:

```ts
["pools", walletAddress]
```

because they will break in a future multi-chain version.

---

# 3. Internationalization and localization architecture

## 3.1 Product language requirements

Product v1 supported languages:

```txt
en = English, default/base language
es = Spanish, secondary language
```

Locale resolution priority:

```txt
explicit user preference -> browser locale -> English fallback
```

The app should display in the browser language when supported:

- `es*` browser locales should use Spanish.
- `en*` browser locales should use English.
- unsupported locales should fallback to English.

## 3.2 Required libraries

Use:

```txt
i18next
react-i18next
i18next-browser-languagedetector
```

Recommended optional helper:

```txt
i18next-resources-to-backend
```

Only add the optional helper if dynamic namespace loading is needed.

Do not introduce another localization framework unless explicitly approved.

## 3.3 Required file structure

```txt
src/i18n/
  config.ts
  index.ts
  I18nProvider.tsx
  useAppLocale.ts
  formatters.ts
  resources/
    en/
      common.json
      navigation.json
      landing.json
      wallet.json
      overview.json
      analysis.json
      pools.json
      deposits.json
      strategies.json
      rewards.json
      governance.json
      activity.json
      settings.json
      errors.json
      validation.json
      coverage.json
      charts.json
    es/
      common.json
      navigation.json
      landing.json
      wallet.json
      overview.json
      analysis.json
      pools.json
      deposits.json
      strategies.json
      rewards.json
      governance.json
      activity.json
      settings.json
      errors.json
      validation.json
      coverage.json
      charts.json
```

## 3.4 i18next configuration

Suggested config responsibilities:

- set fallback language to `en`;
- support `en` and `es`;
- detect browser language;
- normalize locales to base language codes;
- avoid hydration mismatches;
- load all required namespaces for product v1 or lazy-load by route if implemented carefully.

Suggested config shape:

```ts
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export const DEFAULT_LOCALE = "en";

export function normalizeLocale(input?: string): "en" | "es" {
  if (!input) return "en";
  if (input.toLowerCase().startsWith("es")) return "es";
  if (input.toLowerCase().startsWith("en")) return "en";
  return "en";
}
```

Browser detector settings should map regional variants:

```txt
es-AR -> es
es-ES -> es
en-US -> en
en-GB -> en
```

## 3.5 App provider

The app root provider should compose i18n with the existing app providers.

Suggested structure:

```tsx
// src/app/providers.tsx
"use client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </I18nProvider>
  );
}
```

If wallet providers or theme providers are also used, the final composition should keep i18n available to all visual surfaces:

```tsx
<I18nProvider>
  <CabThemeProvider>
    <CabWalletProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </CabWalletProvider>
  </CabThemeProvider>
</I18nProvider>
```

## 3.6 No hardcoded copy rule

No user-facing product copy may be hardcoded.

This applies to:

- page titles;
- sidebar labels;
- button labels;
- tabs;
- breadcrumbs;
- cards;
- metric labels;
- chart labels;
- chart tooltips;
- table headers;
- filters;
- badges;
- empty states;
- loading states;
- error states;
- toast messages;
- analysis stages;
- coverage labels;
- event type labels;
- validation messages;
- accessibility labels where user-facing.

Forbidden:

```tsx
<CabButton>Analyze wallet</CabButton>
<CabEmptyState title="No Aerodrome activity detected" />
<CabMetricCard label="Net Portfolio Value" />
```

Required:

```tsx
const { t } = useTranslation("analysis");

<CabButton>{t("cta.analyzeWallet")}</CabButton>
<CabEmptyState title={t("empty.noAerodromeActivity")} />
<CabMetricCard label={t("metrics.netPortfolioValue")} />
```

## 3.7 Translation namespaces

Use namespaces by product area.

Required namespaces:

| Namespace | Responsibility |
|---|---|
| `common` | shared labels, actions, generic UI |
| `navigation` | sidebar, top nav, route labels |
| `landing` | public landing content |
| `wallet` | connect/disconnect/network states |
| `overview` | dashboard overview |
| `analysis` | analysis CTA/status/stages |
| `pools` | pool list/detail |
| `deposits` | deposit list/detail/lifecycle |
| `strategies` | Mellow/strategy UI |
| `rewards` | rewards/claims |
| `governance` | veAERO/votes/fees/bribes |
| `activity` | transaction ledger/event labels |
| `settings` | settings/diagnostics |
| `errors` | app/provider/domain errors |
| `validation` | form validation |
| `coverage` | confidence/coverage states |
| `charts` | chart labels/tooltips/legends |

## 3.8 Translation key rules

Keys must be semantic, not full English phrases.

Preferred:

```json
{
  "cta": {
    "analyzeWallet": "Analyze wallet"
  }
}
```

Avoid:

```json
{
  "Analyze wallet": "Analyze wallet"
}
```

Key naming rules:

- use camelCase;
- group by UI role;
- avoid protocol addresses in keys;
- avoid dynamic data inside keys;
- interpolate variables using i18next interpolation.

Example:

```json
{
  "analysis": {
    "status": {
      "running": "Analyzing {{walletShort}}…",
      "ready": "Analysis ready"
    }
  }
}
```

## 3.9 Namespace implementation by feature

### Navigation

```ts
useTranslation("navigation")
```

Example keys:

```json
{
  "items": {
    "overview": "Overview",
    "pools": "Pools",
    "deposits": "Deposits",
    "strategies": "Strategies",
    "rewards": "Rewards",
    "governance": "Governance",
    "activity": "Activity",
    "settings": "Settings"
  }
}
```

### Analysis

```ts
useTranslation("analysis")
```

Use for:

- CTA labels;
- status badges;
- polling labels;
- run stages;
- stale/failed/ready states.

### Coverage

```ts
useTranslation("coverage")
```

Use for:

- `full`;
- `share_level`;
- `partial`;
- `unknown`;
- confidence labels;
- partial data warnings.

### Activity

```ts
useTranslation("activity")
```

Use for event labels such as:

- `strategy_deposit`;
- `strategy_withdraw`;
- `strategy_share_mint`;
- `strategy_internal_rebalance`;
- `rebalance`;
- `claim_reward`;
- `lock_aero`.

## 3.10 Locale-aware formatting

All numbers, currency, percentages, token amounts, and dates must use locale-aware helpers.

Required file:

```txt
src/i18n/formatters.ts
```

Required helpers:

```ts
formatUsd(value: number, locale: string): string
formatTokenAmount(value: number, locale: string, options?: TokenFormatOptions): string
formatPercent(value: number, locale: string): string
formatDateTime(value: Date | string, locale: string): string
formatRelativeTime(value: Date | string, locale: string): string
formatCompactNumber(value: number, locale: string): string
```

Use:

- `Intl.NumberFormat`
- `Intl.DateTimeFormat`
- `Intl.RelativeTimeFormat`

Rules:

- Do not hardcode comma/period formatting.
- Do not use `toFixed()` directly in UI components.
- USD remains the main valuation currency.
- Token amounts may need precision control but must still respect locale.
- Financial values should use tabular numerals in UI.

## 3.11 Design System integration

Design System primitives should not own product-specific copy.

DS components should receive localized strings as props:

```tsx
<CabMetricCard label={t("metrics.netPortfolioValue")} />
```

Acceptable DS-owned generic labels must come from:

- props; or
- centralized `common` translations passed from wrappers.

DS components must not hardcode product terms such as:

- Overview;
- Pools;
- Deposits;
- Strategies;
- Analyze wallet;
- No activity;
- Ready;
- Partial coverage.

## 3.12 Container/component pattern with i18n

The app uses `.container.tsx` for state orchestration and `.component.tsx` for presentational rendering.

i18n rule:

- Containers may call `useTranslation` and pass translated strings to components.
- Components may call `useTranslation` for local display strings if they remain presentational.
- Neither containers nor components may hardcode user-facing copy.

Preferred for complex pages:

```txt
Container:
  - fetch data
  - prepare callbacks
  - prepare view model
  - optionally prepare translated labels

Component:
  - render UI from props
  - use DS components
  - no data fetching
  - no hardcoded copy
```

## 3.13 Testing and linting for i18n

Add checks to prevent hardcoded copy.

Recommended checks:

- ESLint rule or custom script scanning `.tsx` for string literals in JSX.
- Translation key parity check between `en` and `es`.
- Unit tests for `normalizeLocale`.
- Unit tests for formatters.
- Storybook/visual QA in both `en` and `es` if Storybook is added.

Suggested script:

```txt
pnpm i18n:check
```

Responsibilities:

- ensure every English namespace file has matching Spanish file;
- ensure key structure parity;
- report missing translations;
- optionally report unused keys.

## 3.14 i18n acceptance criteria

The implementation is not acceptable if:

- product UI contains hardcoded user-facing copy;
- sidebar labels are hardcoded;
- chart labels are hardcoded;
- table headers are hardcoded;
- empty/error/loading states are hardcoded;
- English and Spanish resource files do not share the same key structure;
- browser locale is ignored;
- unsupported locales do not fallback to English;
- numbers, dates, currencies, percentages, or token amounts are formatted manually in UI components.

---

# 4. Provider strategy

## 4.1 Moralis

Use Moralis primarily for wallet-centric data and fast discovery.

### Primary uses

- current wallet token balances;
- wallet history;
- decoded transaction summaries;
- ERC-20/NFT transfer discovery;
- DeFi position discovery where supported;
- fast Overview data;
- candidate transaction discovery for background analysis.

### Relevant Moralis endpoints

#### Token balances

```http
GET https://api.moralis.com/v1/wallets/{walletAddressOrPublicKey}/tokens?chains=base
```

Chain-aware implementation:

```ts
const moralisChain = getMoralisChain(chainId);
```

Use for:

- current wallet token balances;
- Overview asset table;
- idle assets;
- sanity-checking post-analysis balances;
- current token inventory used in attribution states.

Persist into:

- `RawProviderRecord`
- `PortfolioSnapshot`
- current wallet balance cache if implemented

#### Wallet history

```http
GET https://deep-index.moralis.io/api/v2.2/wallets/{address}/history?chain=base
```

Use for:

- decoded wallet transaction history;
- candidate Aerodrome/Mellow activity;
- recent Activity preview;
- seed list for background analysis.

Persist into:

- `RawProviderRecord`
- candidate event queue
- normalized `LedgerEvent` only after classification

#### DeFi positions

```http
GET https://api.moralis.com/v1/wallets/{walletAddress}/defi/positions
```

Use for:

- current DeFi exposure discovery;
- sanity-checking detected open positions;
- Overview approximation;
- possible pool/strategy hints.

Persist into:

- `RawProviderRecord`
- `CoverageReport` notes if Moralis detects unsupported or partial protocol support

#### Detailed DeFi positions by protocol

```http
GET https://api.moralis.com/v1/wallets/{walletAddress}/defi/{protocol}/positions
```

Use for:

- protocol-specific position discovery where Moralis supports the protocol;
- current exposure approximation;
- validation against The Cab reconstructed state.

Important:

- Do not rely on Moralis DeFi positions as source of truth for lifecycle analytics.
- Treat this endpoint as a hint/validation source.

---

## 4.2 Alchemy

Use Alchemy primarily for pricing and RPC-backed reconstruction.

### Primary uses

- current token prices;
- historical token prices;
- transfer history fallback;
- RPC `eth_getLogs`;
- RPC `eth_call`;
- transaction receipt/log inspection;
- block timestamp lookup;
- contract reads.

### Relevant Alchemy endpoints

#### Current token prices by address

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/by-address
```

Use for:

- current token prices;
- current portfolio valuation;
- current pool/deposit/strategy/residual valuation;
- Overview price enrichment.

Persist into:

- `PricePoint`

Identity:

```txt
chainId + tokenAddress + timestamp + source + resolution
```

#### Historical token prices

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/historical
```

Use for:

- event-time valuation;
- capital in/out valuation;
- reward valuation at claim time;
- rebalance valuation;
- historical chart snapshots.

Persist into:

- `PricePoint`

#### Asset transfers

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: alchemy_getAssetTransfers
```

Product v1 network:

```txt
base-mainnet
```

Use for:

- transfer history fallback;
- token movement verification;
- ERC-20 transfer discovery;
- NFT transfer discovery where supported;
- cross-checking Moralis transfer/history data.

Persist into:

- `RawProviderRecord`
- `AssetMovement` candidates

#### RPC logs

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: eth_getLogs
```

Use for:

- Aerodrome pool events;
- position manager events;
- gauge events;
- reward/bribe/fee events;
- veAERO/Voter events;
- Mellow wrapper/staking events.

Persist into:

- `RawProviderRecord`
- `LedgerEvent`
- `AssetMovement`

#### Contract reads

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: eth_call
```

Use for:

- Router `defaultFactory()`;
- Router `poolFor(...)`;
- gauge-to-pool mapping where available;
- Mellow wrapper/share balance reads;
- total supply / share supply reads;
- current strategy/vault values when available;
- token decimals/symbol fallbacks;
- metadata discovery.

Persist into:

- `ProtocolContract`
- `Strategy`
- `StrategyExposure`
- `PricePoint`
- `CoverageReport`

---

## 4.3 Data source hierarchy

The implementation should use this source hierarchy:

```txt
Official protocol docs / official metadata
  -> protocol contract registry and known strategy surfaces

Onchain RPC reads and event logs
  -> canonical protocol semantics and lifecycle reconstruction

Moralis wallet APIs
  -> fast wallet data and candidate discovery

Alchemy Prices API
  -> canonical price source

Alchemy Transfers API
  -> fallback transfer discovery and verification
```

Rules:

- Do not introduce CoinGecko or other pricing providers.
- Do not use Moralis prices for canonical historical valuation.
- Do not treat Moralis decoded labels as final classification for Aerodrome/Mellow lifecycle.
- Do not assume Router interaction covers all protocol activity.
- Do not key any provider result without `chainId`.

---

# 5. Shared ingestion architecture

## 5.1 Background analysis flow

```txt
POST /api/analysis/start
  -> validate walletAddress + chainId
  -> create AnalysisRun
  -> enqueue Trigger.dev analyze-wallet task
  -> return runId

Trigger.dev analyze-wallet
  -> fetch Moralis wallet history for chainId
  -> fetch Moralis balances for chainId
  -> fetch Moralis DeFi positions for chainId
  -> fetch Alchemy transfers if needed for chainId
  -> sync protocol metadata for chainId
  -> fetch RPC logs for relevant contract families on chainId
  -> decode transactions/logs
  -> normalize LedgerEvents
  -> build AssetMovements
  -> enrich PricePoints with Alchemy for chainId
  -> build Pools, Deposits, Strategies, StrategyExposures
  -> build RewardEvents and GovernanceEvents
  -> build AttributionStates and AttributionSourceLots
  -> compute snapshots
  -> create CoverageReports
  -> mark AnalysisRun ready/failed
```

## 5.2 Required ingestion modules

```txt
src/server/providers/moralis/
  getWalletTokens.ts
  getWalletHistory.ts
  getWalletDefiPositions.ts
  getWalletDefiProtocolPositions.ts

src/server/providers/alchemy/
  getCurrentTokenPrices.ts
  getHistoricalTokenPrices.ts
  getAssetTransfers.ts
  rpcClient.ts
  getLogs.ts
  contractRead.ts

src/server/chains/
  getSupportedChain.ts
  providerNetworkMap.ts
  explorerMap.ts

src/server/protocols/aerodrome/
  syncAerodromeMetadata.ts
  discoverPools.ts
  decodeRouterActivity.ts
  decodePoolEvents.ts
  decodePositionManagerEvents.ts
  decodeGaugeEvents.ts
  decodeRewardsEvents.ts
  decodeGovernanceEvents.ts

src/server/protocols/mellow/
  syncMellowStrategies.ts
  decodeWrapperEvents.ts
  decodeStakingRewardsEvents.ts
  decodeStrategyInternalEvents.ts
  computeShareLevelAccounting.ts

src/server/analysis/
  analyzeWalletTask.ts
  normalizeLedgerEvents.ts
  buildAssetMovements.ts
  enrichPrices.ts
  buildDeposits.ts
  buildStrategies.ts
  buildRewards.ts
  buildGovernance.ts
  buildResidualAttribution.ts
  computeSnapshots.ts
```

## 5.3 Persistence flow

Raw data is persisted first, domain entities second.

```txt
RawProviderRecord(chainId)
  -> LedgerEvent(chainId)
    -> AssetMovement(chainId)
      -> PricePoint(chainId)
    -> RewardEvent(chainId)
    -> GovernanceEvent(chainId)
    -> AttributionState(chainId)
    -> AttributionSourceLot(chainId)
  -> Pool(chainId)
  -> Deposit(chainId)
  -> Strategy(chainId)
  -> StrategyExposure(chainId)
  -> PerformanceSnapshot(chainId)
  -> PortfolioSnapshot(chainId)
  -> CoverageReport(chainId)
```

Do not skip `RawProviderRecord`: it is required for debugging, reclassification, and explainability.

---

# 6. Feature feasibility and implementation

---

## 6.1 Landing

### Feasibility

**High.**

No external data required.

### Chain-aware requirements

- Product v1 copy may mention Base.
- Future copy should be adaptable to Aero multi-chain.
- No chain state is required in static landing content.

### i18n requirements

Landing must be fully localized.

Namespace:

```txt
landing
```

Required localized content:

- hero headline;
- hero body;
- CTA labels;
- feature cards;
- how analysis works;
- trust/privacy copy;
- footer text.

No landing copy may be hardcoded in page components.

### Implementation

Use static content, translation resources, and internal Design System components.

### Display

- Hero.
- Feature grid.
- How analysis works.
- Wallet connect CTA.
- Trust/privacy copy.

### Risks

Low.

---

## 6.2 Wallet connection

### Feasibility

**High.**

### Data sources

- wagmi
- WalletConnect

### RPC/API requirements

No Moralis/Alchemy required for connection itself.

### Chain-aware requirements

- Wallet connection must expose `chainId`.
- Product v1 must enforce Base mainnet.
- Wrong-network state should instruct the user to switch to Base.
- The wallet adapter should not hide `chainId`.

### i18n requirements

Namespaces:

```txt
wallet
errors
```

Localized content:

- connect wallet;
- disconnect;
- wrong network;
- switch to Base;
- connection failed;
- wallet unsupported;
- connected wallet label.

### Implementation

Use:

```txt
wagmi
WalletConnect connector
useCabWallet wrapper
```

`useCabWallet` should expose:

```ts
address
chainId
isConnected
isSupportedChain
connect()
disconnect()
switchToSupportedChain()
```

### Display

- Connected wallet address.
- Chain status.
- Wrong-network notice.
- Disconnect action.

### Risks

- Wrong network handling.
- Wallet state must not leak raw wagmi usage into feature components.
- Wallet errors must be localized.

---

## 6.3 Overview

### Feasibility

**High for current/recent view. Medium for analyzed historical view.**

Overview can be useful before full analysis.

### Data obtainable via Moralis

Use Moralis for:

- token balances;
- wallet history;
- DeFi positions if supported;
- current wallet portfolio approximation.

Endpoints:

```http
GET /v1/wallets/{walletAddressOrPublicKey}/tokens?chains={moralisChain}
GET /api/v2.2/wallets/{address}/history?chain={moralisChain}
GET /v1/wallets/{walletAddress}/defi/positions
```

### Data obtainable via Alchemy

Use Alchemy for:

- current token prices;
- historical prices for recent chart;
- transfer fallback if needed.

Endpoints:

```http
POST /prices/v1/{apiKey}/tokens/by-address
POST /prices/v1/{apiKey}/tokens/historical
```

### Requires RPC?

Optional for the quick Overview.

Required only when showing analyzed data from the historical layer.

### Chain-aware requirements

- Query key: `["overview", chainId, walletAddress]`.
- API route: `/api/wallet/overview?chainId=8453`.
- Prices keyed by `chainId + tokenAddress`.
- Portfolio snapshot keyed by `walletAddress + chainId + timestamp`.

### i18n requirements

Namespace:

```txt
overview
charts
common
coverage
```

Localized content:

- metric labels;
- chart labels;
- chart legends;
- chart tooltips;
- empty states;
- loading states;
- coverage badges;
- recent/analyzed view labels.

Formatting:

- USD values through `formatUsd`;
- percentages through `formatPercent`;
- dates through `formatDateTime`;
- token balances through `formatTokenAmount`.

### Persisted data

- `RawProviderRecord`
- `PricePoint`
- `PortfolioSnapshot`
- `CoverageReport`

### Mapping

```txt
Moralis token balances
  -> current wallet inventory
  -> PortfolioSnapshot.idleAssetsValueUsd

Moralis wallet history
  -> recent activity preview
  -> provisional LedgerEvents

Alchemy current prices
  -> PricePoint
  -> current USD values
```

### Display

Overview should show:

- net portfolio value;
- deployed value;
- idle value;
- manual deposit exposure;
- automated strategy exposure;
- residual attributed value;
- governance value;
- recent activity;
- analysis status;
- chain indicator.

### Coverage behavior

Before full analysis:

- label as `Recent view`;
- show partial/inferred status;
- avoid deep return metrics.

After full analysis:

- use snapshots from DB;
- show `Analyzed history`.

### Risks

- Moralis portfolio values may include non-Aerodrome assets; filter relevant assets clearly.
- Moralis DeFi positions may not support every Aerodrome/Mellow surface.
- Avoid presenting recent API data as final PnL.
- Chart labels/tooltips often get hardcoded by AI; enforce translation resources.

---

## 6.4 Pools

### Feasibility

**Medium.**

Pool-level analytics are feasible but require reconstruction beyond Moralis/Alchemy.

### Data obtainable via Moralis

Useful as discovery only:

- wallet history;
- ERC-20 transfers;
- NFT transfers;
- DeFi position hints;
- decoded labels.

Moralis can tell that a wallet interacted with contracts, but it is not enough to reconstruct pool attribution with confidence.

### Data obtainable via Alchemy

Useful for:

- current/historical prices;
- transfer fallback;
- RPC logs;
- contract reads.

### Requires RPC?

**Yes.**

Required RPC/log sources:

- Router calls/events;
- pool events;
- LP token mint/burn/transfer events;
- position manager events;
- gauge events;
- Mellow wrapper/staking events;
- token transfer logs;
- Router `defaultFactory()`;
- Router `poolFor(...)`.

### Chain-aware requirements

- Pool identity: `chainId + poolAddress`.
- Factory metadata: `chainId + factoryAddress`.
- Router metadata: `chainId + routerAddress`.
- Query key: `["pools", chainId, walletAddress, filters]`.
- API route: `/api/pools?chainId=8453`.

### i18n requirements

Namespace:

```txt
pools
coverage
charts
common
```

Localized content:

- pool list title;
- detail page labels;
- table headers;
- filters;
- manual deposits group;
- automated strategies group;
- residual attribution group;
- rebalance timeline labels;
- coverage states.

### Persisted data

- `ProtocolContract`
- `Pool`
- `Deposit`
- `Strategy`
- `StrategyExposure`
- `LedgerEvent`
- `AssetMovement`
- `AttributionState`
- `RewardEvent`
- `PerformanceSnapshot`
- `CoverageReport`

### Mapping

```txt
Router/pool metadata
  -> Pool

Deposit lifecycle events
  -> Deposit
  -> Pool aggregate

Mellow official metadata + wrapper/staking events
  -> Strategy
  -> StrategyExposure
  -> Pool aggregate

Withdrawn pool tokens
  -> AttributionState
  -> Pool residual value

Rewards
  -> RewardEvent
  -> Pool aggregate
```

### Display

Pools list:

- pool name;
- chain;
- total attributed value;
- manual deposit value;
- automated strategy value;
- residual attributed value;
- rewards;
- realized/unrealized PnL;
- coverage.

Pool detail:

```txt
Pool Detail
├── Header
├── Total attributed exposure
├── Manual Deposits
├── Automated Strategies
├── Residual Attribution
├── Rebalance Timeline
├── Rewards
└── Activity
```

### Implementation notes

Mellow must appear under `Automated Strategies`, not under manual deposits.

Each automated strategy row should show:

- strategy name;
- current estimated value;
- capital deposited;
- capital withdrawn;
- rewards claimed;
- share balance;
- coverage status;
- link to Strategy detail.

### Risks

- Pool mapping can be wrong if relying only on Router.
- Gauge-to-pool and reward-to-pool mapping need contract reads/events.
- Mellow pool association should prefer official Mellow metadata.
- Residual attribution must avoid over-consuming balances.
- Pool labels and fallback names must be localized where possible, but protocol symbols remain raw.

---

## 6.5 Deposits

### Feasibility

**Medium.**

Manual Aerodrome deposit reconstruction is feasible but requires decoded tx input, position NFT identity, logs, and token movements.

### Data obtainable via Moralis

Useful for:

- candidate transactions;
- NFT ownership/transfers;
- decoded history;
- token transfers.

Not sufficient for:

- distinguishing `mint()` from `increaseLiquidity()` with full reliability;
- complete fee/collect accounting;
- reliable lifecycle reconstruction.

### Data obtainable via Alchemy

Useful for:

- historical prices;
- RPC logs;
- transaction receipts;
- asset transfers fallback;
- contract reads.

### Requires RPC?

**Yes.**

Required:

- transaction receipt logs;
- position manager logs;
- NFT transfer logs;
- function selector / decoded input;
- tokenId extraction;
- collect/decrease/increase events;
- gauge stake/unstake events if staked.

### Chain-aware requirements

- Deposit identity must include `chainId`.
- NFT identity must be `chainId + contractAddress + tokenId`.
- Query key: `["deposits", chainId, walletAddress, filters]`.
- API route: `/api/deposits?chainId=8453`.

### i18n requirements

Namespace:

```txt
deposits
activity
coverage
common
```

Localized content:

- lifecycle event labels;
- deposit status labels;
- table headers;
- filters;
- empty states;
- action labels;
- partial history warnings.

### Persisted data

- `Deposit`
- `LedgerEvent`
- `AssetMovement`
- `RewardEvent`
- `AttributionState`
- `PerformanceSnapshot`
- `CoverageReport`

### Mapping

```txt
mint()
  -> Deposit.open

increaseLiquidity(existing tokenId)
  -> Deposit.capital_increase

decreaseLiquidity(tokenId)
  -> Deposit.partial_reduce
  -> possible AttributionState opened

collect(tokenId)
  -> RewardEvent / fee realization

stake
  -> Deposit.staked

unstake
  -> Deposit.unstaked

withdraw/burn/close
  -> Deposit.closed where applicable
```

### Display

Deposits list:

- deposit label/tokenId;
- pool;
- status;
- open date;
- current/closed value;
- capital in;
- rewards;
- return;
- coverage.

Deposit detail:

- lifecycle timeline;
- token movement table;
- fee/reward events;
- stake/unstake history;
- performance decomposition.

### Risks

- `IncreaseLiquidity` event is ambiguous; must use method context.
- Missing decoded input may require selector/ABI decoding.
- Partial history if deposit existed before one-year window.
- Do not create Deposit from Mellow activity unless wallet owns underlying NFT.
- Lifecycle labels must be translated from event type keys, not hardcoded.

---

## 6.6 Strategies

### Feasibility

**Medium-Low initially; Medium with strong Mellow metadata and ABI decoding.**

Strategy analytics are feasible at share-level first. Full internal accounting may be partial.

### Data obtainable via Moralis

Useful for:

- candidate wallet interactions with Mellow wrapper/staking contracts;
- token transfers;
- decoded transaction history;
- current wallet balances.

Not enough for:

- share-level accounting if wrapper token behavior is custom;
- internal strategy activity;
- share price/TVL reconstruction;
- fee dilution.

### Data obtainable via Alchemy

Useful for:

- historical prices;
- RPC logs;
- contract reads;
- transfer fallback;
- current share balances;
- wrapper/vault/staking event decoding.

### Requires RPC?

**Yes.**

Required:

- official Mellow strategy metadata sync;
- lpWrapper logs;
- StakingRewards logs;
- share balance reads;
- share token transfer logs;
- deposit/withdraw event decoding;
- reward claim event decoding;
- optional TVL/share price reads if available.

### Chain-aware requirements

- Strategy identity includes `chainId`.
- StrategyExposure identity includes `chainId`.
- Official Mellow metadata must be stored per chain.
- Query key: `["strategies", chainId, walletAddress, filters]`.
- API route: `/api/strategies?chainId=8453`.

### i18n requirements

Namespace:

```txt
strategies
coverage
activity
charts
common
```

Localized content:

- strategy list labels;
- strategy detail sections;
- user exposure labels;
- lifecycle timeline labels;
- internal strategy activity labels;
- coverage explanations;
- `share_level`, `partial`, `unknown`, `full` labels;
- Mellow-specific warnings.

### Persisted data

- `ProtocolContract`
- `Strategy`
- `StrategyExposure`
- `LedgerEvent`
- `AssetMovement`
- `RewardEvent`
- `PerformanceSnapshot`
- `CoverageReport`
- `PricePoint`

### Mapping

```txt
Official Mellow docs
  -> Strategy
  -> ProtocolContract(lpWrapper, StakingRewards)
  -> Pool relationship

Wallet interaction with lpWrapper
  -> StrategyExposure lifecycle

Deposit/DepositAndStake/Deposit event
  -> strategy_deposit
  -> strategy_share_mint

Withdraw/UnstakeAndWithdraw/Withdraw event
  -> strategy_withdraw
  -> strategy_share_burn

StakingRewards claim
  -> strategy_claim
  -> RewardEvent

Visible operator/vault rebalance
  -> strategy_internal_rebalance
  -> Strategy-level Activity only
```

### Display

Strategies list:

- strategy name;
- protocol: Mellow;
- underlying pool;
- current value;
- capital deposited;
- capital withdrawn;
- share balance;
- rewards;
- return;
- coverage.

Strategy detail:

```txt
Strategy Detail
├── Header
│   ├── Strategy name
│   ├── Protocol
│   ├── Underlying pool
│   ├── lpWrapper
│   ├── StakingRewards
│   └── Coverage status
├── User Exposure
│   ├── Deposited value
│   ├── Withdrawn value
│   ├── Current value
│   ├── Share balance
│   ├── Shares received
│   └── Shares redeemed
├── Rewards
├── Lifecycle Timeline
├── Internal Strategy Activity
└── Coverage / Limitations
```

### Coverage states

- `full`
- `share_level`
- `partial`
- `unknown`

Default to `share_level` when:

- user deposits/withdrawals/shares are reliable;
- underlying internal strategy state is not fully reconstructed.

### Risks

- Mellow ABI may vary by strategy/wrapper.
- Share valuation may require vault TVL and total supply.
- Internal rebalances may not be user-facing and should not be treated as manual rebalances.
- Fee dilution may be hard to compute accurately.
- Coverage labels are product-critical and must be localized consistently.

---

## 6.7 Rewards

### Feasibility

**Medium.**

Claims are discoverable; correct attribution requires protocol-specific event mapping.

### Data obtainable via Moralis

Useful for:

- wallet history;
- token transfers to wallet;
- decoded claim-like transactions;
- recent claims preview.

### Data obtainable via Alchemy

Useful for:

- historical price at claim time;
- logs for reward events;
- token transfer fallback.

### Requires RPC?

**Yes for reliable attribution.**

Required for:

- gauge rewards;
- collect fees;
- Mellow StakingRewards claims;
- bribe rewards;
- voting fees;
- rebases;
- pool attribution.

### Chain-aware requirements

- RewardEvent identity includes `chainId`.
- Reward token pricing uses `chainId + tokenAddress + timestamp`.
- Query key: `["rewards", chainId, walletAddress, filters]`.
- API route: `/api/rewards?chainId=8453`.

### i18n requirements

Namespace:

```txt
rewards
charts
coverage
common
```

Localized content:

- reward source labels;
- reward type labels;
- claim timeline labels;
- chart legends;
- table headers;
- APR/annualized return explanations;
- no rewards empty state.

### Persisted data

- `RewardEvent`
- `LedgerEvent`
- `AssetMovement`
- `PricePoint`
- `CoverageReport`

### Mapping

```txt
collect(tokenId)
  -> lp_fee RewardEvent
  -> linked to Deposit + Pool

Gauge reward claim
  -> gauge_reward RewardEvent
  -> linked to Deposit/Pool where possible

Mellow StakingRewards claim
  -> strategy_reward / mellow_reward
  -> linked to Strategy + StrategyExposure + Pool

Voting fee / bribe / rebase
  -> governance RewardEvent
  -> linked to GovernanceEvent + Pool where possible
```

### Display

Rewards should show:

- total rewards;
- by source:
  - manual deposits;
  - Mellow strategies;
  - governance;
- by token;
- by pool;
- by strategy;
- claim timeline;
- annualized estimated rewards return.

### Risks

- Reward-to-pool mapping may be unavailable for some governance rewards.
- Claimed tokens may later be swapped; the claim value must be fixed at claim time.
- Avoid double counting rewards in Pools, Strategies, Governance, and Rewards.
- Reward source labels must come from translation keys.

---

## 6.8 Governance

### Feasibility

**Medium.**

Current and historical governance activity requires veAERO/Voter/bribe/fee event decoding.

### Data obtainable via Moralis

Useful for:

- candidate governance transactions;
- AERO token movements;
- decoded wallet activity.

### Data obtainable via Alchemy

Useful for:

- historical prices;
- RPC logs;
- contract reads;
- transfer verification.

### Requires RPC?

**Yes.**

Required surfaces:

- AERO token;
- VotingEscrow / veAERO;
- Voter;
- bribe contracts;
- fee distributor contracts;
- managed rewards where applicable.

### Chain-aware requirements

- GovernanceEvent identity includes `chainId`.
- Governance contract metadata is chain-scoped.
- Query key: `["governance", chainId, walletAddress, filters]`.
- API route: `/api/governance?chainId=8453`.

### i18n requirements

Namespace:

```txt
governance
rewards
coverage
common
```

Localized content:

- lock labels;
- vote labels;
- relay labels;
- voting fees;
- bribes;
- rebases;
- governance reward explanations;
- epoch labels;
- coverage states.

### Persisted data

- `GovernanceEvent`
- `RewardEvent`
- `LedgerEvent`
- `AssetMovement`
- `PricePoint`
- `PerformanceSnapshot`
- `CoverageReport`

### Mapping

```txt
lock / increase / relock
  -> GovernanceEvent

vote / reset / relay
  -> GovernanceEvent

claim voting fees / bribes / rebases
  -> RewardEvent
  -> GovernanceEvent
  -> Pool where mappable
```

### Display

Governance should show:

- veAERO/lock exposure;
- lock timeline;
- vote timeline by epoch;
- relays;
- governance rewards;
- rewards by pool where supported;
- coverage.

### Risks

- Pool allocation for voting rewards requires reliable event/contract mapping.
- Managed/rebase rewards may have special semantics.
- Avoid mixing governance returns with LP deposit returns unless explicitly labeled.
- Governance terminology must be translated carefully without corrupting protocol terms like `veAERO`.

---

## 6.9 Activity

### Feasibility

**High for raw activity; Medium for enriched activity.**

### Data obtainable via Moralis

Moralis wallet history can provide decoded activity feed and summaries.

Use for:

- raw Activity list;
- recent preview;
- candidate event classification;
- raw transaction metadata.

### Data obtainable via Alchemy

Use for:

- transaction receipts;
- logs;
- transfers;
- contract reads;
- historical prices.

### Requires RPC?

**Yes for enriched classification.**

Required for:

- confirming function/event semantics;
- splitting one transaction into multiple LedgerEvents;
- token-level asset movement reconstruction;
- strategy internal activity;
- residual attribution.

### Chain-aware requirements

- LedgerEvent identity includes `chainId`.
- Activity query keys include `chainId`.
- Explorer links use `getExplorerBaseUrl(chainId)`.
- API route: `/api/activity?chainId=8453`.

### i18n requirements

Namespace:

```txt
activity
coverage
common
```

Localized content:

- event type labels;
- classification labels;
- confidence labels;
- filters;
- table headers;
- transaction detail headings;
- source allocation labels;
- rebalance explanation labels.

Event types must be translated from enum keys.

Example:

```json
{
  "eventTypes": {
    "strategyDeposit": "Strategy deposit",
    "strategyWithdraw": "Strategy withdrawal",
    "strategyInternalRebalance": "Strategy internal rebalance",
    "rebalance": "Rebalance",
    "claimReward": "Claim reward"
  }
}
```

### Persisted data

- `RawProviderRecord`
- `LedgerEvent`
- `AssetMovement`
- `RewardEvent`
- `GovernanceEvent`
- `AttributionState`
- `AttributionSourceLot`
- `CoverageReport`

### Mapping

```txt
Moralis wallet history
  -> RawProviderRecord
  -> provisional Activity row

RPC logs + decoding
  -> LedgerEvent
  -> AssetMovement
  -> enriched Activity row

Price enrichment
  -> PricePoint
  -> USD values
```

### Display

Activity rows should show:

- timestamp;
- tx hash;
- chain;
- event type;
- protocol;
- pool;
- deposit;
- strategy;
- token movements;
- USD value;
- classification confidence;
- coverage status;
- explorer link.

### Strategy-specific events

Activity must include:

- `strategy_deposit`
- `strategy_withdraw`
- `strategy_stake`
- `strategy_unstake`
- `strategy_claim`
- `strategy_share_mint`
- `strategy_share_burn`
- `strategy_internal_rebalance`
- `strategy_fee_dilution`

### Risks

- One transaction may produce multiple events.
- Moralis decoded labels may be too broad.
- Internal Mellow activity must not be treated as user manual activity.
- Event labels and explanation copy are likely to be hardcoded by AI unless enforced.

---

## 6.10 Settings

### Feasibility

**High.**

### Data sources

Internal DB.

### Requires RPC/API?

No, except for diagnostics display.

### Chain-aware requirements

- Settings may display active chain.
- Diagnostics should be chain-scoped.
- Analysis status should be wallet + chain scoped.
- Future multi-chain settings should be added through chain config.

### i18n requirements

Namespace:

```txt
settings
wallet
common
```

Localized content:

- language selector if added;
- active chain;
- diagnostics;
- analysis state;
- refresh/retry labels;
- display preferences;
- data freshness labels.

If a language selector is implemented, persist preference either:

- locally for v1; or
- in user settings if authenticated user persistence is added later.

### Persisted data

- wallet analysis status;
- display preferences;
- language preference if implemented;
- diagnostics state;
- provider health metadata.

### Display

Settings should show:

- connected wallet;
- active chain;
- supported chain state;
- language preference if implemented;
- last analysis timestamp for chain;
- trigger/retry update;
- display preferences;
- diagnostics.

### Risks

Low.

---

# 7. Cross-feature implementation details

## 7.1 Analysis modes

### Full history

Scope:

- last 365 days;
- one wallet;
- one chain;
- older events only if needed to understand current open positions.

### Incremental update

Scope:

- same wallet + same chain;
- from last indexed block/cursor to current head;
- recompute affected snapshots.

## 7.2 Price enrichment

Use Alchemy historical prices for every valued event.

Process:

```txt
AssetMovement(chainId)
  -> tokenAddress + timestamp + chainId
  -> Alchemy historical price
  -> PricePoint(chainId)
  -> usdValueAtEvent
```

Rules:

- address-based pricing preferred;
- symbol fallback only if needed and lower confidence;
- missing price should create CoverageReport entry;
- do not silently use another provider;
- token address without `chainId` is invalid.

## 7.3 Contract metadata sync

Before analysis, sync for the target `chainId`:

- Aerodrome AERO token;
- Aerodrome Router;
- Aerodrome default factory from `router.defaultFactory()`;
- Mellow official strategy metadata for that chain;
- Mellow lpWrapper/StakingRewards pairs for that chain.

Persist into:

- `ProtocolContract`
- `Strategy`
- `Pool` when known.

## 7.4 Event decoding requirements

Create ABI registry:

```txt
abis/aerodrome/router.json
abis/aerodrome/pool.json
abis/aerodrome/positionManager.json
abis/aerodrome/gauge.json
abis/aerodrome/voter.json
abis/aerodrome/votingEscrow.json
abis/aerodrome/rewards.json
abis/mellow/lpWrapper.json
abis/mellow/stakingRewards.json
abis/mellow/rootVault.json
abis/erc20.json
abis/erc721.json
```

Use ABI decoding for:

- function selectors;
- log topics;
- tokenId extraction;
- share event extraction;
- reward event extraction.

ABI usage must be chain-aware when contract versions differ by chain.

## 7.5 Confidence model

### High confidence

- official contract metadata;
- decoded event + matching token transfer;
- known ABI;
- known pool/strategy mapping;
- priced by address;
- chain-scoped identity confirmed.

### Medium confidence

- decoded wallet history + partial logs;
- inferred pool mapping;
- share-level strategy accounting only;
- price symbol fallback.

### Low confidence

- unknown wallet inventory;
- missing ABI;
- inferred event without confirming transfers;
- missing price;
- unknown strategy internals;
- provider record without chain-specific validation.

Persist confidence on:

- `LedgerEvent`
- `Strategy`
- `StrategyExposure`
- `RewardEvent`
- `AttributionState`
- `CoverageReport`

## 7.6 API route implementation

Recommended Next.js API routes:

```http
GET  /api/wallet/overview?chainId=8453
POST /api/analysis/start
GET  /api/analysis/status?chainId=8453
GET  /api/pools?chainId=8453
GET  /api/pools/:poolId?chainId=8453
GET  /api/deposits?chainId=8453
GET  /api/deposits/:depositId?chainId=8453
GET  /api/strategies?chainId=8453
GET  /api/strategies/:strategyId?chainId=8453
GET  /api/rewards?chainId=8453
GET  /api/governance?chainId=8453
GET  /api/activity?chainId=8453
GET  /api/settings?chainId=8453
POST /api/settings
```

Rules:

- API routes read from DB.
- API routes should not run long analysis.
- Analysis runs in Trigger.dev.
- Provider calls should be centralized in provider modules.
- Feature containers call typed query hooks, not raw fetch.
- Every route either accepts `chainId` or derives Base mainnet default for product v1.
- Backend validation must reject unsupported chains.

## 7.7 Localized API/domain errors

Backend errors should return stable error codes, not localized strings.

Example:

```json
{
  "code": "UNSUPPORTED_CHAIN",
  "message": "Unsupported chain",
  "details": {
    "chainId": 1
  }
}
```

Frontend maps `code` to localized strings:

```ts
t(`errors:${error.code}`)
```

Rules:

- Backend may include developer-readable English messages for logs.
- UI must display localized error text from translation resources.
- Error codes must be stable and documented.

---

# 8. Feature-to-storage mapping

| Feature | Reads from | Writes through analysis | Chain key | i18n namespaces |
|---|---|---|---|---|
| Overview | PortfolioSnapshot, PerformanceSnapshot, PricePoint, CoverageReport | PortfolioSnapshot, PricePoint | wallet + chain | overview, charts, coverage |
| Pools | Pool, Deposit, Strategy, StrategyExposure, AttributionState, RewardEvent, PerformanceSnapshot | Pool, PerformanceSnapshot | pool + chain | pools, charts, coverage |
| Deposits | Deposit, LedgerEvent, AssetMovement, RewardEvent, PerformanceSnapshot | Deposit, LedgerEvent, AssetMovement | deposit + chain | deposits, activity, coverage |
| Strategies | Strategy, StrategyExposure, RewardEvent, PerformanceSnapshot, CoverageReport | Strategy, StrategyExposure | strategy + chain | strategies, activity, coverage |
| Rewards | RewardEvent, PricePoint, LedgerEvent | RewardEvent | reward + chain | rewards, charts |
| Governance | GovernanceEvent, RewardEvent, PerformanceSnapshot | GovernanceEvent | governance + chain | governance, rewards |
| Activity | LedgerEvent, AssetMovement, RawProviderRecord | LedgerEvent, AssetMovement | tx/log + chain | activity, coverage |
| Settings | WalletContext, AnalysisRun | WalletContext | wallet + chain | settings, wallet |
| Landing | Translation resources | none | none | landing, common |
| Navigation | Translation resources | none | none | navigation |

---

# 9. Implementation order

## Phase A — Chain-aware provider foundation

- Chain config layer.
- Moralis client keyed by `chainId`.
- Alchemy price client keyed by `chainId`.
- Alchemy RPC client keyed by `chainId`.
- Query key helpers with `chainId`.
- RawProviderRecord persistence with `chainId`.
- Provider error handling.
- Rate limit handling.

## Phase B — i18n foundation

- Install and configure `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- Create `src/i18n` structure.
- Create EN/ES resource files.
- Add `I18nProvider`.
- Add `normalizeLocale`.
- Add locale-aware formatters.
- Add namespace parity check script.
- Replace all navigation and shell copy with translation keys.

## Phase C — Fast Overview

- Fetch Moralis balances for chain.
- Fetch Alchemy current prices for chain.
- Fetch Moralis recent wallet history for chain.
- Display recent Overview.
- Show analysis CTA.
- Ensure all Overview labels/charts/empty states are localized.

## Phase D — Analysis pipeline skeleton

- Trigger.dev task.
- AnalysisRun with `chainId`.
- Status polling with `chainId`.
- Raw data fetch/persist with `chainId`.
- Protocol metadata sync with `chainId`.
- Localized UI states for queued/running/ready/stale/failed.

## Phase E — Aerodrome reconstruction

- Router/defaultFactory sync by chain.
- Pool discovery by chain.
- Deposit reconstruction.
- Gauge/reward reconstruction.
- AssetMovement generation.
- Price enrichment.

## Phase F — Residual attribution

- AttributionState.
- AttributionSourceLot.
- Waterfall consumption.
- Pool residual charts.
- Localized residual/rebalance explanations.

## Phase G — Mellow strategies

- Sync official Mellow strategy metadata by chain.
- Decode lpWrapper/StakingRewards activity.
- Build Strategy/StrategyExposure.
- Share-level accounting.
- Coverage model.
- Localized strategy coverage warnings.

## Phase H — Governance

- veAERO/Voter events.
- Bribes/fees/rebases.
- Reward allocation by pool where possible.
- Localized governance labels.

## Phase I — Final UI surfaces

- Pools.
- Deposits.
- Strategies.
- Rewards.
- Governance.
- Activity.
- Settings diagnostics.
- Validate all hardcoded copy removed.

---

# 10. Feasibility conclusions

## What APIs can handle well

Moralis and Alchemy can handle:

- quick wallet overview;
- current balances;
- transaction discovery;
- current and historical prices;
- raw transfer discovery;
- candidate activity;
- current DeFi position hints.

## What must be custom protocol reconstruction

The Cab must implement custom RPC/log decoding for:

- manual deposit lifecycle;
- mint vs increase distinction;
- pool/deposit/gauge mapping;
- residual attribution;
- strategy exposure;
- Mellow share accounting;
- Mellow internal activity;
- governance rewards;
- high-confidence activity classification.

## What multi-chain readiness changes

Multi-chain readiness does not change Product v1 scope.

It changes implementation discipline:

```txt
Do not hardcode Base everywhere.
Do not key by address alone.
Do not create provider clients without chain context.
Do not create query keys without chainId.
Do not create database constraints that assume global address uniqueness.
```

## What i18n readiness changes

i18n readiness does not change product analytics scope.

It changes implementation discipline:

```txt
Do not hardcode user-facing copy.
Do not format numbers/dates manually.
Do not hardcode chart labels or event labels.
Do not return localized backend errors directly.
Do not let EN/ES resource keys drift.
```

## Final architecture rule

The product should not be built as:

```txt
Moralis response -> UI
```

or:

```txt
hardcoded English copy -> UI
```

It should be built as:

```txt
Moralis / Alchemy / RPC / official metadata
  -> RawProviderRecord(chainId)
  -> normalized domain model(chainId)
  -> snapshots(chainId)
  -> typed feature APIs(chainId)
  -> TanStack Query(chainId keys)
  -> containers
  -> pure components
  -> i18next localized copy
```

This is the only path that keeps The Cab’s analytics reliable, explainable, extensible, localized, and ready for a future Aero multi-chain cockpit.
