# The Cab — Feature Feasibility & Implementation Architecture v1.0

## Document role

This document complements **The Cab Product & Technical Specification v1.4.1**.

It translates the product spec into an implementation-oriented feasibility plan.

For each feature, it defines:

- feasibility level;
- what data is obtainable from Moralis;
- what data is obtainable from Alchemy;
- what must be extended through RPC / contract reads / event logs;
- what data must be persisted;
- how raw data maps into the domain model;
- how the UI should display the result;
- implementation risks and confidence/coverage rules.

This document is intended to guide AI-assisted coding by preventing provider drift, unclear data ownership, and incorrect assumptions about what public APIs can reconstruct.

---

## 0. Executive summary

The Cab is feasible, but the implementation must be split into two layers:

```txt
Fast API layer
  -> uses Moralis + Alchemy
  -> powers quick Overview and candidate activity discovery

Protocol reconstruction layer
  -> uses RPC, event logs, contract reads, ABIs, protocol metadata
  -> powers Pools, Deposits, Strategies, Rewards, Governance, Activity
```

The APIs are useful, but they are not sufficient for full Aerodrome/Mellow analytics.

### High-level feasibility

| Feature | Feasibility | Moralis / Alchemy enough? | RPC required? | Notes |
|---|---:|---:|---:|---|
| Landing | High | N/A | No | Static/product feature. |
| Wallet connection | High | N/A | No | wagmi + WalletConnect. |
| Overview recent dashboard | High | Mostly yes | Optional | Moralis wallet data + Alchemy prices. |
| Analysis status | High | N/A | No | Internal DB + Trigger.dev. |
| Pools | Medium | No | Yes | Need protocol events, pool/gauge/strategy mapping. |
| Deposits | Medium | No | Yes | Need NFT/tokenId, mint vs increase semantics, events. |
| Strategies / Mellow | Medium-Low | No | Yes | Need official Mellow metadata + wrapper/staking events + share accounting. |
| Rewards | Medium | Partially | Yes | Claims/transfers via APIs, attribution via events/contracts. |
| Governance | Medium | Partially | Yes | veAERO/Voter/bribe/fee contracts need RPC/event decoding. |
| Activity | High for raw, Medium for enriched | Partially | Yes | Moralis seeds activity; enrichment needs RPC/decoding. |
| Settings | High | N/A | No | Internal app state/DB. |
| Background analysis | Medium | Partially | Yes | APIs seed; RPC makes it correct. |

---

## 1. Provider strategy

## 1.1 Moralis

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

Use for:

- current wallet token balances;
- Overview asset table;
- idle assets;
- sanity-checking post-analysis balances;
- current token inventory used in attribution states.

Persist into:

- `RawProviderRecord`
- optionally `CurrentWalletTokenBalance` or computed `PortfolioSnapshot`

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
- candidate `LedgerEvent` queue

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
- `CoverageReport` notes if Moralis detects unsupported/partial protocol support.

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

## 1.2 Alchemy

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
POST https://base-mainnet.g.alchemy.com/v2/{apiKey}
method: alchemy_getAssetTransfers
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
POST https://base-mainnet.g.alchemy.com/v2/{apiKey}
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
POST https://base-mainnet.g.alchemy.com/v2/{apiKey}
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

## 1.3 Data source hierarchy

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

---

# 2. Shared ingestion architecture

## 2.1 Background analysis flow

```txt
POST /api/analysis/start
  -> create AnalysisRun
  -> enqueue Trigger.dev analyze-wallet task
  -> return runId

Trigger.dev analyze-wallet
  -> fetch Moralis wallet history
  -> fetch Moralis balances
  -> fetch Moralis DeFi positions
  -> fetch Alchemy transfers if needed
  -> sync protocol metadata
  -> fetch RPC logs for relevant contract families
  -> decode transactions/logs
  -> normalize LedgerEvents
  -> build AssetMovements
  -> enrich PricePoints with Alchemy
  -> build Pools, Deposits, Strategies, StrategyExposures
  -> build RewardEvents and GovernanceEvents
  -> build AttributionStates and AttributionSourceLots
  -> compute snapshots
  -> create CoverageReports
  -> mark AnalysisRun ready/failed
```

## 2.2 Required ingestion modules

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

## 2.3 Persistence flow

Raw data is persisted first, domain entities second.

```txt
RawProviderRecord
  -> LedgerEvent
    -> AssetMovement
      -> PricePoint
    -> RewardEvent
    -> GovernanceEvent
    -> AttributionState
    -> AttributionSourceLot
  -> Pool
  -> Deposit
  -> Strategy
  -> StrategyExposure
  -> PerformanceSnapshot
  -> PortfolioSnapshot
  -> CoverageReport
```

Do not skip `RawProviderRecord`: it is required for debugging, reclassification, and explainability.

---

# 3. Feature feasibility and implementation

---

## 3.1 Landing

### Feasibility

**High.**

No external data required.

### Data sources

None.

### Implementation

Use static content and internal Design System components.

### Storage

None.

### Display

- Hero.
- Feature grid.
- How analysis works.
- Wallet connect CTA.
- Trust/privacy copy.

### Risks

Low.

---

## 3.2 Wallet connection

### Feasibility

**High.**

### Data sources

- wagmi
- WalletConnect

### RPC/API requirements

No Moralis/Alchemy required for connection itself.

### Implementation

Use:

```txt
wagmi
WalletConnect connector
useCabWallet wrapper
```

### Storage

Persist only non-sensitive UI state if needed.

### Display

- Connected wallet address.
- Chain status.
- Wrong-network notice.
- Disconnect action.

### Risks

- Wrong network handling.
- Wallet state must not leak raw wagmi usage into feature components.

---

## 3.3 Overview

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
GET /v1/wallets/{walletAddressOrPublicKey}/tokens?chains=base
GET /api/v2.2/wallets/{address}/history?chain=base
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
- analysis status.

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

## 3.4 Pools

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

## 3.5 Deposits

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

## 3.6 Strategies

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

## 3.7 Rewards

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

## 3.8 Governance

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

## 3.9 Activity

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

## 3.10 Settings

### Feasibility

**High.**

### Data sources

Internal DB.

### Requires RPC/API?

No, except for diagnostics display.

### Persisted data

- wallet analysis status;
- display preferences;
- diagnostics state;
- provider health metadata.

### Display

Settings should show:

- connected wallet;
- chain;
- last analysis timestamp;
- trigger/retry update;
- display preferences;
- diagnostics.

### Risks

Low.

---

# 4. Cross-feature implementation details

## 4.1 Analysis modes

### Full history

Scope:

- last 365 days;
- older events only if needed to understand current open positions.

### Incremental update

Scope:

- from last indexed block/cursor to current head;
- recompute affected snapshots.

## 4.2 Price enrichment

Use Alchemy historical prices for every valued event.

Process:

```txt
AssetMovement
  -> tokenAddress + timestamp
  -> Alchemy historical price
  -> PricePoint
  -> usdValueAtEvent
```

Rules:

- address-based pricing preferred;
- symbol fallback only if needed and lower confidence;
- missing price should create CoverageReport entry;
- do not silently use another provider.

## 4.3 Contract metadata sync

Before analysis, sync:

- Aerodrome AERO token;
- Aerodrome Router;
- Aerodrome default factory from `router.defaultFactory()`;
- Mellow official strategy metadata;
- Mellow lpWrapper/StakingRewards pairs.

Persist into:

- `ProtocolContract`
- `Strategy`
- `Pool` when known.

## 4.4 Event decoding requirements

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

## 4.5 Confidence model

### High confidence

- official contract metadata;
- decoded event + matching token transfer;
- known ABI;
- known pool/strategy mapping;
- priced by address.

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
- unknown strategy internals.

Persist confidence on:

- `LedgerEvent`
- `Strategy`
- `StrategyExposure`
- `RewardEvent`
- `AttributionState`
- `CoverageReport`

## 4.6 API route implementation

Recommended Next.js API routes:

```http
GET  /api/wallet/overview
POST /api/analysis/start
GET  /api/analysis/status
GET  /api/pools
GET  /api/pools/:poolId
GET  /api/deposits
GET  /api/deposits/:depositId
GET  /api/strategies
GET  /api/strategies/:strategyId
GET  /api/rewards
GET  /api/governance
GET  /api/activity
GET  /api/settings
POST /api/settings
```

Rules:

- API routes read from DB.
- API routes should not run long analysis.
- Analysis runs in Trigger.dev.
- Provider calls should be centralized in provider modules.
- Feature containers call typed query hooks, not raw fetch.

---

# 5. Feature-to-storage mapping

| Feature | Reads from | Writes through analysis |
|---|---|---|
| Overview | PortfolioSnapshot, PerformanceSnapshot, PricePoint, CoverageReport | PortfolioSnapshot, PricePoint |
| Pools | Pool, Deposit, Strategy, StrategyExposure, AttributionState, RewardEvent, PerformanceSnapshot | Pool, PerformanceSnapshot |
| Deposits | Deposit, LedgerEvent, AssetMovement, RewardEvent, PerformanceSnapshot | Deposit, LedgerEvent, AssetMovement |
| Strategies | Strategy, StrategyExposure, RewardEvent, PerformanceSnapshot, CoverageReport | Strategy, StrategyExposure |
| Rewards | RewardEvent, PricePoint, LedgerEvent | RewardEvent |
| Governance | GovernanceEvent, RewardEvent, PerformanceSnapshot | GovernanceEvent |
| Activity | LedgerEvent, AssetMovement, RawProviderRecord | LedgerEvent, AssetMovement |
| Settings | WalletContext, AnalysisRun | WalletContext |

---

# 6. Implementation order

## Phase A — API provider foundation

- Moralis client.
- Alchemy price client.
- Alchemy RPC client.
- RawProviderRecord persistence.
- Provider error handling.
- Rate limit handling.

## Phase B — Fast Overview

- Fetch Moralis balances.
- Fetch Alchemy current prices.
- Fetch Moralis recent wallet history.
- Display recent Overview.
- Show analysis CTA.

## Phase C — Analysis pipeline skeleton

- Trigger.dev task.
- AnalysisRun.
- Status polling.
- Raw data fetch/persist.
- Protocol metadata sync.

## Phase D — Aerodrome reconstruction

- Router/defaultFactory sync.
- Pool discovery.
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

- Sync official Mellow strategy metadata.
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

# 7. Feasibility conclusions

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

## Final architecture rule

The product should not be built as:

```txt
Moralis response -> UI
```

It should be built as:

```txt
Moralis / Alchemy / RPC / official metadata
  -> RawProviderRecord
  -> normalized domain model
  -> snapshots
  -> typed feature APIs
  -> TanStack Query
  -> containers
  -> pure components
```

This is the only path that keeps The Cab’s analytics reliable, explainable, and extensible.
