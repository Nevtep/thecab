# The Cab — Feature Feasibility & Implementation Architecture v1.1

## Document role

This document complements **The Cab Product & Technical Specification v1.4.2 Multi-chain**.

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
- chain-aware implementation requirements.

This document is intended to guide AI-assisted coding by preventing:

- provider drift;
- unclear data ownership;
- incorrect assumptions about public APIs;
- Base-only assumptions leaking into the domain model;
- address-only database identities;
- UI sections consuming provider data directly instead of normalized domain data.

---

# 0. Executive summary

The Cab is feasible as a product, but the implementation must be split into two layers:

```txt
Fast API layer
  -> uses Moralis + Alchemy
  -> powers quick Overview and candidate activity discovery

Protocol reconstruction layer
  -> uses RPC, event logs, contract reads, ABIs, official protocol metadata
  -> powers Pools, Deposits, Strategies, Rewards, Governance, Activity
```

Product v1 remains **Base mainnet only**, but the implementation must be **chain-aware from day one**.

This means:

```txt
Product scope v1: Base mainnet
Architecture: chain-aware
Domain identity: chainId + address
Provider calls: chainId-derived
Query keys: chainId-scoped
API routes: chainId-aware
DB constraints: chainId-aware
```

The APIs are useful, but they are not sufficient for full Aerodrome/Mellow analytics.

---

# 1. High-level feasibility

| Feature | Feasibility | Moralis / Alchemy enough? | RPC required? | Chain-aware requirement |
|---|---:|---:|---:|---|
| Landing | High | N/A | No | No chain state beyond copy. |
| Wallet connection | High | N/A | No | Enforce Base for v1; preserve chain state. |
| Overview recent dashboard | High | Mostly yes | Optional | Query and prices scoped by `chainId`. |
| Analysis status | High | N/A | No | `AnalysisRun = walletAddress + chainId`. |
| Pools | Medium | No | Yes | `Pool = chainId + poolAddress`. |
| Deposits | Medium | No | Yes | NFT identity requires `chainId + contract + tokenId`. |
| Strategies / Mellow | Medium-Low initially | No | Yes | `Strategy = chainId + wrapper/vault/strategy address`. |
| Rewards | Medium | Partially | Yes | Reward scope must include `chainId`. |
| Governance | Medium | Partially | Yes | veAERO/Voter/fees/bribes are chain-scoped. |
| Activity raw | High | Partially | Optional | `Activity = chainId + txHash + logIndex/event`. |
| Activity enriched | Medium | Partially | Yes | Requires chain-scoped decoding. |
| Settings | High | N/A | No | Settings may default by chain. |
| Background analysis | Medium | Partially | Yes | Every run scoped to wallet + chain. |

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

# 3. Provider strategy

## 3.1 Moralis

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

## 3.2 Alchemy

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

## 3.3 Data source hierarchy

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

# 4. Shared ingestion architecture

## 4.1 Background analysis flow

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

## 4.2 Required ingestion modules

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

## 4.3 Persistence flow

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

# 5. Feature feasibility and implementation

---

## 5.1 Landing

### Feasibility

**High.**

No external data required.

### Chain-aware requirements

- Product v1 copy may mention Base.
- Future copy should be adaptable to Aero multi-chain.
- No chain state is required in static landing content.

### Implementation

Use static content and internal Design System components.

### Display

- Hero.
- Feature grid.
- How analysis works.
- Wallet connect CTA.
- Trust/privacy copy.

### Risks

Low.

---

## 5.2 Wallet connection

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

---

## 5.3 Overview

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

---

## 5.4 Pools

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

---

## 5.5 Deposits

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

---

## 5.6 Strategies

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

---

## 5.7 Rewards

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

---

## 5.8 Governance

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

---

## 5.9 Activity

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

---

## 5.10 Settings

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

### Persisted data

- wallet analysis status;
- display preferences;
- diagnostics state;
- provider health metadata.

### Display

Settings should show:

- connected wallet;
- active chain;
- supported chain state;
- last analysis timestamp for chain;
- trigger/retry update;
- display preferences;
- diagnostics.

### Risks

Low.

---

# 6. Cross-feature implementation details

## 6.1 Analysis modes

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

## 6.2 Price enrichment

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

## 6.3 Contract metadata sync

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

## 6.4 Event decoding requirements

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

## 6.5 Confidence model

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

## 6.6 API route implementation

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

---

# 7. Feature-to-storage mapping

| Feature | Reads from | Writes through analysis | Chain key |
|---|---|---|---|
| Overview | PortfolioSnapshot, PerformanceSnapshot, PricePoint, CoverageReport | PortfolioSnapshot, PricePoint | wallet + chain |
| Pools | Pool, Deposit, Strategy, StrategyExposure, AttributionState, RewardEvent, PerformanceSnapshot | Pool, PerformanceSnapshot | pool + chain |
| Deposits | Deposit, LedgerEvent, AssetMovement, RewardEvent, PerformanceSnapshot | Deposit, LedgerEvent, AssetMovement | deposit + chain |
| Strategies | Strategy, StrategyExposure, RewardEvent, PerformanceSnapshot, CoverageReport | Strategy, StrategyExposure | strategy + chain |
| Rewards | RewardEvent, PricePoint, LedgerEvent | RewardEvent | reward + chain |
| Governance | GovernanceEvent, RewardEvent, PerformanceSnapshot | GovernanceEvent | governance + chain |
| Activity | LedgerEvent, AssetMovement, RawProviderRecord | LedgerEvent, AssetMovement | tx/log + chain |
| Settings | WalletContext, AnalysisRun | WalletContext | wallet + chain |

---

# 8. Implementation order

## Phase A — Chain-aware provider foundation

- Chain config layer.
- Moralis client keyed by `chainId`.
- Alchemy price client keyed by `chainId`.
- Alchemy RPC client keyed by `chainId`.
- Query key helpers with `chainId`.
- RawProviderRecord persistence with `chainId`.
- Provider error handling.
- Rate limit handling.

## Phase B — Fast Overview

- Fetch Moralis balances for chain.
- Fetch Alchemy current prices for chain.
- Fetch Moralis recent wallet history for chain.
- Display recent Overview.
- Show analysis CTA.

## Phase C — Analysis pipeline skeleton

- Trigger.dev task.
- AnalysisRun with `chainId`.
- Status polling with `chainId`.
- Raw data fetch/persist with `chainId`.
- Protocol metadata sync with `chainId`.

## Phase D — Aerodrome reconstruction

- Router/defaultFactory sync by chain.
- Pool discovery by chain.
- Deposit reconstruction.
- Gauge/reward reconstruction.
- AssetMovement generation.
- Price enrichment.

## Phase E — Residual attribution

- AttributionState.
- AttributionSourceLot.
- Waterfall consumption.
- Pool residual charts.

## Phase F — Mellow strategies

- Sync official Mellow strategy metadata by chain.
- Decode lpWrapper/StakingRewards activity.
- Build Strategy/StrategyExposure.
- Share-level accounting.
- Coverage model.

## Phase G — Governance

- veAERO/Voter events.
- Bribes/fees/rebases.
- Reward allocation by pool where possible.

## Phase H — Final UI surfaces

- Pools.
- Deposits.
- Strategies.
- Rewards.
- Governance.
- Activity.
- Settings diagnostics.

---

# 9. Feasibility conclusions

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

## Final architecture rule

The product should not be built as:

```txt
Moralis response -> UI
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
```

This is the only path that keeps The Cab’s analytics reliable, explainable, extensible, and ready for a future Aero multi-chain cockpit.
