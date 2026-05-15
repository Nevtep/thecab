# The Cab — Product & Technical Specification v1.4.3

## Version

- **Document version:** v1.4.3
- **Product:** The Cab
- **Scope:** Product technical specification
- **Primary chain:** Base mainnet for Product v1
- **Multi-chain posture:** chain-aware domain and persistence from day one
- **Primary protocol:** Aerodrome Finance
- **Secondary integration:** Mellow Aerodrome strategies
- **Framework:** Next.js
- **Wallet:** WalletConnect + wagmi
- **Background jobs:** Trigger.dev
- **Design System:** Internal The Cab DS built on Tamagui wrappers
- **Localization:** i18next; English default; Spanish secondary; browser language detection

---

# 0. Purpose

This document defines the product, UX, technical architecture, domain model, analytics behavior, background analysis process, branding rules, Design System boundaries, and section-by-section implementation requirements for **The Cab**.

The Cab is a **portfolio command cabin for Aerodrome Finance on Base**. It allows a connected wallet to monitor its current Aerodrome-related portfolio, understand historical capital deployment, analyze pools, deposits, and strategies, inspect rewards and governance activity, and reconstruct meaningful portfolio performance over time.

This specification is written to be consumed by AI-assisted development tools such as Copilot, Cursor, Claude Code, Codex, or similar agents. Its goal is to reduce product drift by making product intent, data boundaries, user flows, analytics semantics, implementation choices, and library boundaries explicit.

---

# 1. Product Overview

## 1.1 Product definition

**The Cab** is a web analytics application for users participating in **Aerodrome Finance** on Base.

It provides:

- A quick wallet-connected overview using recent wallet and market data.
- A deeper historical analysis triggered by the user on demand or automatically when stale.
- Pool-level analytics.
- Deposit-level lifecycle analytics.
- Rewards and claims analytics.
- Governance analytics for veAERO, locks, votes, relays, and voting rewards.
- Activity-level transaction interpretation.
- Clear separation between pool-level analysis, manual deposits, and automated strategies such as Mellow.

The product should feel like a **control tower for on-chain capital**: precise, technical, aviation-inspired, dashboard-first, and trustworthy.

## 1.2 Product intent

The Cab is not a trading terminal and not an execution interface. It is an **analytics and monitoring cockpit**.

The user should be able to answer:

- What is the current state of my wallet?
- How has my Aerodrome portfolio evolved over time?
- Which pools have I participated in?
- Which deposits and automated strategies performed well or poorly?
- How much capital did I deploy, withdraw, rebalance, or leave idle?
- How much did I earn from rewards, fees, claims, locks, or votes?
- Which swaps were normal swaps and which were likely rebalance operations?
- How much of my return came from rewards versus asset price movement?
- What is my estimated annualized return overall, per pool, per deposit, and per strategy?

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

The product v1 scope is Base mainnet, but The Cab must be architected as a chain-aware analytics product. This is required because Aero is expected to evolve Aerodrome/Velodrome into a broader multi-chain platform. The Cab must avoid hardcoding Base assumptions outside the chain configuration layer.

---

# 2. Resolved Product Decisions

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

Product v1 supports:

- **Base mainnet only**

Rules:

- Base mainnet is the only production-supported chain for product v1.
- Do not support Base Sepolia in product v1 flows unless explicitly approved as a development/testing mode.
- If testing utilities are added for development, they must not appear as user-facing product v1 network options unless explicitly approved.
- Wrong-network state should instruct the user to switch to Base mainnet.
- All product v1 UI should default to Base mainnet.

Base chain ID:

```ts
const SUPPORTED_CHAIN_ID = 8453;
```

### Future Aero multi-chain compatibility

Product v1 is Base mainnet only and remains focused on Aerodrome on Base.

However, the domain model, provider architecture, protocol metadata model, query keys, API routes, and persistence layer must remain chain-aware from day one because Aero is expected to unify Aerodrome and Velodrome and expand across multiple EVM networks.

Future chains may include:

- Base;
- Optimism;
- Ethereum mainnet;
- Circle Arc or other EVM-compatible networks;
- additional Aero-supported networks.

The product must be architected so a future version can evolve from:

```txt
Aerodrome on Base cockpit
```

to:

```txt
Aero multi-chain cockpit
```

without rewriting the domain model.

### Chain-aware implementation rules

All protocol-specific persisted entities must include `chainId` directly or inherit it unambiguously from a parent scope.

Address-based entities must never be keyed by address alone.

Use:

```txt
chainId + address
```

not:

```txt
address
```

The product must not assume that any of the following are globally unique across chains:

- wallet address;
- token address;
- pool address;
- strategy address;
- gauge address;
- reward contract address;
- governance contract address;
- transaction hash;
- NFT token ID;
- wrapper/vault address.

All provider clients, API route params, TanStack Query keys, database unique constraints, analysis jobs, protocol metadata sync jobs, and price lookups must accept or derive `chainId`.

Product v1 may default to Base mainnet, but implementation must avoid hardcoding Base assumptions outside the chain configuration layer.

### Chain configuration layer

Create a single chain configuration layer.

Suggested file:

```ts
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
    rpcNetwork: "base-mainnet",
    moralisChain: "base",
    alchemyNetwork: "base-mainnet",
    nativeCurrencySymbol: "ETH",
  },
} as const;
```

Future chains must be added through this configuration layer, not by scattering chain-specific constants across features.


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

Product v1 analysis scope:

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
8. If the user swaps an amount higher than the residual amount attributed to the pool, only the attributed portion is assigned to that pool first. The excess amount must be allocated according to the source-priority waterfall:
   1. first from matching-token cash-ins;
   2. then from balances currently marked as liquidation-derived inventory;
   3. finally, pro rata across other open residual attribution states for the same token.
9. Example: if the `WETH/cbBTC` pool has `0.1 cbBTC` residual attribution and the user swaps `0.14 cbBTC` into `WETH`, then `0.1 cbBTC` is classified as a rebalance for `WETH/cbBTC`. The remaining `0.04 cbBTC` is not assigned to that pool unless no higher-priority source exists. The system first checks cash-ins of `cbBTC`, then liquidation-derived `cbBTC`, and only then other pool residuals.
10. Liquidation-derived inventory includes balances obtained from prior liquidations or unrelated reward conversions. For example, if the user claims AERO and swaps it for `cbBTC`, that `cbBTC` should be marked as liquidation-derived inventory, not as residual balance from a pool.

Rules:

- A swap from one pool token to the other pool token is a rebalance.
- A swap from a pool token into an unrelated token is a liquidation from the pool.
- A swap from a pool token into a token belonging to another tracked pool may transfer/reassign attribution to that other pool, depending on context.
- Rebalance detection is driven by the lifecycle of residual attributed balances, not elapsed time.
- There is no fixed minutes/hours/same-day inference window.
- When a swap consumes more of a token than the residual attributed amount for a specific pool, attribution must be split rather than forcing the entire swap into that pool.
- Excess swap amount must follow the allocation waterfall: matching-token cash-ins first, liquidation-derived inventory second, and pro-rata allocation across other residual attribution states last.
- Pro-rata allocation across other residual attribution states should only be used when no cash-in or liquidation-derived balance can explain the excess.
- This waterfall prevents over-attributing a large swap to the most recently active pool when the wallet has multiple possible sources for the same token.

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
- If a swap amount exceeds the residual amount attributed to a pool, reduce that pool attribution only up to its available residual amount.
- Allocate the excess using the source-priority waterfall:
  1. matching-token cash-ins;
  2. liquidation-derived inventory;
  3. pro-rata split across other residual attribution states for the same token.
- Never create negative residual attribution.
- Never allow a single pool to absorb more of a swap than the token amount currently attributed to that pool unless explicit user action or higher-confidence evidence supports it.

## 2.9 Aerodrome and Mellow contract support

### Aerodrome

Product v1 should avoid maintaining a large hardcoded whitelist.

Instead, use official protocol surfaces, onchain protocol metadata, deterministic discovery, and event-based protocol family detection.

The Router is a primary discovery surface for swaps and liquidity add/remove operations, but it is **not** the only Aerodrome protocol surface.

The Cab must not assume that all Aerodrome-related activity passes through the Router.

Known key Aerodrome addresses on Base:

```ts
export const AERODROME_BASE = {
  // AERO token address.
  // Must be verified against Aerodrome official deployment/security references.
  aeroToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",

  // Aerodrome Router address.
  // Must be verified against official Aerodrome deployment references and/or Basescan labels.
  router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
};
```

The PoolFactory address should **not** be treated as a manually maintained hardcoded constant in product logic.

Instead, The Cab should obtain the active factory from the Aerodrome Router contract at runtime or during protocol metadata sync:

```ts
const factoryAddress = await router.defaultFactory();
```

This factory address should then be stored as protocol metadata with:

- `source`: `router.defaultFactory()`
- `routerAddress`: address of the Router contract used for the read
- `chainId`: Base mainnet chain ID
- `blockNumber`: block number at which the factory was read
- `timestamp`: timestamp at which the metadata sync occurred
- `confidence`: `high`

Pool discovery should use the factory obtained from the Router as the source of truth.

When deriving pool addresses, The Cab may use the Router’s `poolFor(tokenA, tokenB, stable, factory)` behavior or an equivalent offchain derivation, but the factory input should come from `router.defaultFactory()` unless a specific non-default factory is explicitly discovered from the transaction or contract call being analyzed.

The Cab must avoid maintaining a long static list of Aerodrome pool or factory addresses. If a factory address is hardcoded temporarily for development, it must be marked as a fallback and validated against `router.defaultFactory()` before production use.

#### Router role

Router-based discovery is useful for:

- swaps;
- add liquidity;
- remove liquidity;
- deriving pool addresses through `poolFor`;
- obtaining the active factory through `defaultFactory()`;
- identifying token pairs and stable/volatile pool intent from routed calls;
- identifying candidate pool interactions that should be cross-checked against pool events and token transfers.

Router-based discovery is insufficient for:

- staking;
- unstaking;
- gauge reward claims;
- veAERO locks;
- relocks;
- governance voting;
- vote resets;
- bribes;
- voting fees;
- rebase claims;
- Mellow wrapper/vault/staking activity;
- Mellow strategy-level accounting.

#### Protocol discovery approach

The Cab must combine multiple discovery surfaces.

Discovery should include:

- direct wallet interactions with the Aerodrome Router;
- direct wallet interactions with Aerodrome pools;
- pool events derived from the Router/Factory relationship;
- LP token mint/burn/transfer events;
- direct wallet interactions with Gauge contracts;
- Gauge stake/unstake/reward events;
- AERO token movements;
- veAERO / voting escrow events;
- Voter contract interactions;
- vote/reset/relay events where available;
- bribe, fee, and reward distributor events;
- token transfers surrounding any of the above;
- Mellow wrapper, vault, staking, and strategy events;
- Mellow contract addresses and strategy metadata from official Mellow documentation.

Discovery must use official Aerodrome sources as the source of truth for core addresses and contract semantics whenever possible.

#### Discovery by activity family

The Cab should classify Aerodrome activity by protocol family rather than assuming a single Router flow.

| Activity family | Primary discovery surfaces | Notes |
|---|---|---|
| Swaps | Router, pool events, token transfers | Usually router-mediated, but must be confirmed with token movements. |
| Add liquidity / deposit LP | Router, pool events, LP token mint/transfer | May pass through Router, but classification should be confirmed with pool and token events. |
| Remove liquidity / withdraw LP | Router, pool events, LP token burn/transfer | May pass through Router, but residual attribution is computed from resulting token movements. |
| Stake LP | Gauge contracts, LP token transfers | Do not assume Router involvement. |
| Unstake LP | Gauge contracts, LP token transfers | Do not assume Router involvement. |
| Claim LP/gauge rewards | Gauge/reward contracts, AERO/token transfers | Do not assume Router involvement. |
| veAERO lock/relock/increase | Voting escrow / veAERO contracts, AERO transfers | Governance surface, not Router surface. |
| Vote/reset/relay | Voter/governance contracts | Governance surface, not Router surface. |
| Claim voting fees/bribes/rebases | Bribe/fee/reward distributor contracts, token transfers | Should be grouped by pool where supported. |
| Mellow deposit/withdraw | Mellow wrapper/vault/staking contracts, token transfers | Do not model as manual Aerodrome NFT unless wallet actually owns the NFT. |
| Mellow strategy internals | Mellow strategy contracts plus underlying Aerodrome events where visible | Mark partial coverage when only share-level accounting is available. |

#### Pool identity discovery

Pool identity should be discovered from:

1. Router call data where available.
2. Router `poolFor(tokenA, tokenB, stable, factory)`.
3. Pool events and pool contract addresses.
4. LP token movement events.
5. Gauge-to-pool relationships where available.
6. Mellow strategy metadata where the strategy maps to an Aerodrome pool.

Rules:

- Do not manually curate a long static list of pools.
- Do not assume any random token transfer is Aerodrome activity without protocol-surface evidence.
- Do not assume Router interaction alone is enough to fully classify lifecycle state.
- Always reconcile routed intent with actual token movements.
- Prefer onchain reads and official protocol metadata over local hardcoded assumptions.

#### Important implementation notes

- Aerodrome Router’s `poolFor` calculates pool addresses deterministically using clone mechanics.
- Offchain code may mirror the deterministic derivation or read/call the contract where appropriate.
- The active factory must be treated as protocol metadata, not as a permanent manually curated constant.
- Router is an anchor for discovery, not a complete index.
- The analysis pipeline must discover and classify protocol activity across Router, Pool, Gauge, Reward, veAERO/Voter, and Mellow surfaces.
- Do not manually curate a long static list of all pools.


### Mellow

Mellow product v1 support should use official Mellow documentation for Aerodrome CL strategies.

Mellow strategy support must be consistent with the protocol mechanics research:

- Mellow should be modeled as an automated `Strategy`.
- Wallet participation in a Mellow strategy should be modeled as `StrategyExposure`.
- Mellow deposits and withdrawals should not be modeled as manual Aerodrome `Deposit` records unless the wallet actually owns the underlying manual Aerodrome NFT.
- Mellow strategy value may contribute to `Pool` aggregates when the underlying Aerodrome pool is known.
- Mellow-specific accounting must remain visible in the `Strategies` section.

#### Official strategy metadata

The Cab should sync official Mellow Aerodrome CL strategy metadata into `ProtocolContract` and `Strategy`.

Required metadata where available:

- strategy name;
- strategy width;
- underlying Aerodrome pool;
- `lpWrapper`;
- `StakingRewards`.

Domain mapping:

| Mellow docs field | The Cab entity/field |
|---|---|
| Name | `Strategy.label` |
| width | `Strategy.metadataJson.width` |
| POOL | `Strategy.primaryPoolId` / `Strategy.metadataJson.underlyingPoolAddress` |
| lpWrapper | `Strategy.wrapperAddress` / `ProtocolContract.contractType = mellow_wrapper` |
| StakingRewards | `Strategy.stakingRewardsAddress` / `ProtocolContract.contractType = mellow_staking_rewards` |

Provenance rules:

- `source = official_mellow_docs`
- `sourceReference = Mellow Aerodrome CL strategies docs`
- `confidence = high`

#### Mellow discovery surfaces

The Cab should detect Mellow strategy activity from:

- official Mellow strategy metadata;
- wallet interactions with `lpWrapper` contracts;
- wallet interactions with paired `StakingRewards` contracts;
- ERC20/share transfers involving wrapper/vault/share tokens;
- deposit/withdraw events;
- stake/unstake events where available;
- reward claim events;
- token transfers to/from wallet;
- Mellow strategy/vault internal activity where it can be confidently tied to known contracts.

#### lpWrapper behavior

The `lpWrapper` is the primary candidate surface for user-facing strategy deposit/withdraw/share behavior.

Track:

- deposits;
- withdrawals;
- share mint/burn;
- wrapper token transfers;
- token transfers in/out;
- relationship to the underlying pool.

A wallet interaction with `lpWrapper` should be considered candidate `StrategyExposure` lifecycle activity.

#### StakingRewards behavior

The `StakingRewards` contract is the primary candidate surface for strategy reward/staking behavior.

Track:

- stake-like events where present;
- unstake-like events where present;
- reward claims;
- emitted reward events;
- reward token transfers to the wallet;
- reward token type;
- claim timestamp.

A wallet interaction with `StakingRewards` should be considered candidate strategy reward/staking activity.

The paired `lpWrapper` and `StakingRewards` from official Mellow metadata must map to the same `Strategy` record.

#### Mellow event and function watchlist

The exact ABI should be verified per deployed contract, but The Cab should look for the following categories.

Deposit / entry signals:

- `deposit(...)`
- `depositAndStake(...)`
- `Deposit(...)`
- ERC20 transfer from wallet to wrapper/root vault
- LP/share token mint or transfer to wallet
- wrapper balance increase

Classifications:

- `strategy_deposit`
- `strategy_share_mint`

Withdraw / exit signals:

- `withdraw(...)`
- `unstakeAndWithdraw(...)`
- `Withdraw(...)`
- LP/share token burn or transfer from wallet
- ERC20 transfer from wrapper/root vault to wallet

Classifications:

- `strategy_withdraw`
- `strategy_share_burn`

Stake / unstake signals:

- staking contract calls;
- staking balance changes;
- wrapper token transfer to/from `StakingRewards`;
- stake/withdraw events if emitted by `StakingRewards`.

Classifications:

- `strategy_stake`
- `strategy_unstake`

Reward claim signals:

- reward claim call;
- reward paid event;
- ERC20 transfer from `StakingRewards` to wallet;
- reward token transfer.

Classifications:

- `strategy_claim`
- `strategy_reward`

Internal rebalance signals:

- strategy/operator calls;
- vault/subvault token movement;
- DEX interaction by strategy/vault;
- `pull(...)`;
- `externalCall(...)`.

Classification:

- `strategy_internal_rebalance`

Important:

- Mellow internal rebalances are strategy-level behavior.
- They should not be treated as manual user rebalances.
- They should not create manual `Deposit` entities.
- They should not open user residual attribution unless tokens actually move to the user wallet.

#### Mellow accounting model

Product v1 should use a safe share-level accounting model by default.

Track:

- amount deposited by user;
- token amounts accepted;
- token amounts returned as excess;
- LP/share amount minted or received;
- share balance changes;
- amount withdrawn;
- output tokens received;
- rewards claimed;
- current share balance;
- current estimated value if available.

Minimum strategy analytics:

- capital entered;
- capital withdrawn;
- share balance;
- rewards claimed;
- current value estimate;
- coverage status.

Preferred strategy analytics when data is available:

- share price over time;
- underlying token composition;
- fee dilution effect;
- strategy internal rebalance impact;
- realized/unrealized PnL;
- estimated annualized return.

#### Coverage states

Strategies must display a coverage model because automated strategies may expose reliable user-level share accounting without exposing complete underlying strategy internals.

Coverage states:

- `full`: deposits, withdrawals, shares, rewards, and underlying valuation are reconstructable.
- `share_level`: user deposits, withdrawals, shares, and rewards are reliable, but underlying strategy internals are not fully reconstructed.
- `partial`: some deposits, withdrawals, rewards, prices, mappings, or share values are missing.
- `unknown`: strategy was detected but cannot be reliably analyzed.

Rules:

- Avoid pretending to have perfect underlying position accounting if Mellow does not expose enough data.
- Mark Mellow metrics as `share_level` or `partial` when only share-level accounting is available.
- Later phases can add deeper strategy-specific valuation if required.


## 2.10 Governance rewards allocation

Governance rewards should be displayed **by pool**, matching the way Aerodrome’s own dashboard presents voting fees/rewards.

Rules:

- If a governance reward is associated with a voted pool, allocate/display it under that pool.
- Governance section should still show aggregate governance totals.
- Rewards section should be able to group by reward type and pool.
- Avoid double-counting governance rewards in both pool rewards and governance rewards.
- Use shared `RewardEvent` records with scopes/tags to allow multiple views of the same reward.

## 2.11 CSV export

No CSV/export functionality in product v1.

Rules:

- Do not build export buttons in product v1.
- Do not create CSV API endpoints in product v1.
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

Product v1 Mellow accounting should reconstruct whatever can be obtained reliably from Mellow contract events, using share-level accounting as the default safe model.

The Cab must treat Mellow as automated strategy exposure, not as manual deposit exposure.

Product v1 target:

- Display Mellow strategies in the dedicated `Strategies` section.
- Display Mellow exposure inside `Pools` only as an `Automated Strategies` exposure group.
- Use official Mellow metadata to pair underlying pool, `lpWrapper`, and `StakingRewards`.
- Use contract event data for:
  - strategy deposits;
  - strategy withdrawals;
  - share balances;
  - share mint/burn;
  - wrapper exposure;
  - staking/unstaking where applicable;
  - staking/reward contract activity;
  - reward claims;
  - strategy internal rebalances where confidently detectable.
- Avoid pretending to have perfect underlying position accounting if Mellow does not expose enough data.
- Mark Mellow metrics as `share_level`, `partial`, or `unknown` when appropriate.
- Later phases can add deeper strategy-specific valuation if required.

Mellow internal strategy activity must not create manual `Deposit` entities.

Mellow internal rebalances should be classified as `strategy_internal_rebalance` and affect Strategy analytics, not Deposits.

Returned tokens from Mellow withdrawals may become:

- idle wallet assets;
- residual pool attribution if they map to the underlying pool and remain in the wallet;
- liquidation inventory if swapped into unrelated assets;
- cash out if transferred externally.


## 2.15 State management and frontend architecture

The Cab is a production product, not a prototype. State management must be explicit, layered, and predictable for both human developers and AI-assisted development.

Use:

- **TanStack Query** for server state, API cache, async backend synchronization, polling, refetching, mutations, stale data handling, and background analysis status.
- **Zustand** for lightweight shared client UI state.
- **React local hooks** only for ephemeral component-local state.
- **wagmi** for wallet state, wrapped behind `useCabWallet`.
- **React Hook Form + Zod** for complex forms when needed.
- **URL search params** for shareable filters, ranges, and table views where appropriate.

Do not use Redux Toolkit unless a future requirement introduces complex client-side state machines that justify it.

### State ownership rules

#### TanStack Query owns server state

Use TanStack Query for:

- Overview data.
- Analysis status polling.
- Pools list and detail.
- Positions list and detail.
- Rewards data.
- Governance data.
- Activity data.
- Settings loaded from backend.
- Mutations such as `startAnalysis`, `refreshAnalysis`, and settings updates.

Product screens must not call raw `fetch` directly. Data access should go through typed query and mutation hooks.

Required query/mutation hooks:

```ts
useOverviewQuery()
useAnalysisStatusQuery()
useStartAnalysisMutation()
usePoolsQuery()
usePoolDetailQuery()
useDepositsQuery()
useDepositDetailQuery()
useStrategiesQuery()
useStrategyDetailQuery()
useRewardsQuery()
useGovernanceQuery()
useActivityQuery()
useSettingsQuery()
useUpdateSettingsMutation()
```

#### Zustand owns shared client UI state

Use Zustand for lightweight state that is local to the browser but shared across sections.

Examples:

- Sidebar collapsed/expanded.
- Selected global time range.
- Dashboard layout preferences.
- Selected filters that do not need to be URL-shareable.
- Analysis notification/toast state.
- User UI preferences that are not backend-persisted.

Recommended stores:

```ts
useCabUiStore()
useDashboardFiltersStore()
useAnalysisNotificationStore()
```

Avoid one large global store. Prefer small, focused stores.

#### React hooks own ephemeral local state

Use `useState`, `useMemo`, `useReducer`, and related React hooks only for state that does not need to be shared outside the component.

Examples:

- Dropdown open state.
- Modal open state.
- Local hover/selection state.
- Temporary form field UI state before submit.
- Local chart tooltip interaction state.

#### URL search params own shareable state

Use URL search params for state that should survive reloads or be shareable.

Examples:

- Date range.
- Selected pool filter.
- Activity type filter.
- Table pagination.
- Sort direction.

#### Wallet state is wrapped

The underlying wallet state comes from wagmi, but product code must consume it through the internal wallet adapter.

Use:

```ts
import { useCabWallet } from "@/wallet/useCabWallet";
```

Do not import wagmi directly in product feature files.

### Next.js and Vercel compatibility

TanStack Query is compatible with Next.js and Vercel when used with a proper provider and hydration strategy.

Implementation requirements:

- Create a `QueryProvider` client component.
- Configure a `QueryClient` with sensible defaults.
- Use client components for interactive query-driven dashboard surfaces.
- Use server components for static shells and non-interactive layout where appropriate.
- Avoid using TanStack Query inside server-only modules.
- For App Router, keep query hooks inside client components or containers marked with `"use client"`.

Suggested provider structure:

```tsx
// src/app/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```


---


## 2.17 Internationalization and localization

The Cab must support internationalization from the beginning.

Product v1 languages:

- English: default/base language.
- Spanish: secondary supported language.

The app should display in the browser language when supported.

Language resolution priority:

1. Explicit user-selected language, if a language selector/user preference is added.
2. Browser language / locale detection.
3. English fallback.

Use:

- `i18next`
- `react-i18next`
- browser language detection

Recommended packages:

```txt
i18next
react-i18next
i18next-browser-languagedetector
```

### No hardcoded product copy

Product copy must not be hardcoded in components, containers, API-facing UI errors, empty states, chart labels, sidebar labels, tooltips, table headers, filters, buttons, badges, toasts, or validation messages.

All user-facing copy must come from translation resources.

Forbidden:

```tsx
<CabButton>Analyze wallet</CabButton>
<CabEmptyState title="No Aerodrome activity detected" />
```

Required:

```tsx
const { t } = useTranslation("analysis");

<CabButton>{t("cta.analyzeWallet")}</CabButton>
<CabEmptyState title={t("empty.noAerodromeActivity")} />
```

### Supported locale codes

Use:

```txt
en
es
```

English is the canonical source language.

Spanish translations should be complete enough that the product can be used comfortably by Spanish-speaking users.

### Translation namespaces

Use namespaces by product area to avoid one giant translation file.

Required namespaces:

```txt
common
navigation
landing
wallet
overview
analysis
pools
deposits
strategies
rewards
governance
activity
settings
errors
validation
coverage
charts
```

Suggested structure:

```txt
src/i18n/
  index.ts
  config.ts
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

### Browser localization

The app should detect browser language and choose the best supported language.

Rules:

- If browser locale starts with `es`, use Spanish.
- If browser locale starts with `en`, use English.
- If browser locale is unsupported, fallback to English.
- Locale detection must run on the client without causing hydration instability.
- If SSR/server rendering is used for localized content, the selected locale must be resolved consistently between server and client.

### Formatting localization

Numbers, currency, percentages, and dates must use locale-aware formatting.

Use `Intl.NumberFormat` and `Intl.DateTimeFormat` through internal formatting helpers.

Required helpers:

```ts
formatUsd(value, locale)
formatTokenAmount(value, locale)
formatPercent(value, locale)
formatDateTime(value, locale)
formatRelativeTime(value, locale)
```

Rules:

- Do not hardcode comma/period number formatting.
- Financial values should use tabular numerals in UI.
- USD remains the main valuation currency, but formatting should respect locale.
- Dates/times should respect browser/user locale where appropriate.

### i18n in Design System

Design System primitives should not own product copy.

DS components may receive translated strings as props:

```tsx
<CabMetricCard label={t("metrics.netPortfolioValue")} />
```

DS components may own generic accessibility labels only if they are passed through i18n-aware props or centralized common translations.

### i18n in containers/components

Containers may call `useTranslation` and pass translated copy to `.component` files.

Presentational `.component` files may also call `useTranslation` only for local display strings if this does not mix state/data logic into the component.

Preferred pattern:

- containers prepare data and event handlers;
- components render translated labels using namespace keys or receive translated labels as props;
- no component should contain hardcoded user-facing English copy.

### Translation key rules

Translation keys should be semantic, not full English phrases.

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

### Acceptance criteria

The implementation is not acceptable if:

- product UI contains hardcoded user-facing copy;
- sidebar labels are hardcoded;
- chart labels are hardcoded;
- table headers are hardcoded;
- error/empty/loading states are hardcoded;
- English and Spanish resource files do not share the same key structure;
- browser locale is ignored;
- unsupported locales do not fallback to English.


# 3. Core Product Terminology

The Cab must use precise terminology to avoid mixing different analytical units.

## 3.1 Pool

A **Pool** is the venue/base market where liquidity and swaps happen.

Examples:

- `WETH/cbBTC`
- `AERO/USDC`
- `wstETH/WETH`

A pool is the market-level aggregation layer.

A pool may contain:

- manual deposits;
- automated strategies;
- rewards;
- rebalances;
- residual attributed balances;
- activity events.

Pool-level analytics answer:

- How much total exposure did the wallet have to this market?
- How did value evolve for this market?
- How much was manual versus automated?
- Which rebalances affected this pool?
- Which rewards are associated with this pool?

## 3.2 Manual deposit

A **manual deposit** is a direct user-owned exposure inside an Aerodrome pool.

It may correspond to:

- a user-created liquidity position;
- an Aerodrome NFT/token ID where applicable;
- a manually managed deposit/increase/decrease/withdraw lifecycle;
- a staked LP position in a Gauge.

Manual deposits are lifecycle entities.

Manual deposit lifecycle events may include:

- deposit / mint;
- increase liquidity;
- stake;
- claim;
- unstake;
- decrease liquidity;
- withdraw;
- close.

## 3.3 Automated strategy

An **automated strategy** is a managed strategy layer over one or more protocol contracts, initially focused on Mellow.

An automated strategy may sit on top of an Aerodrome pool, but it has a different accounting model from a manual deposit.

Automated strategies may include:

- wrapper contracts;
- vault contracts;
- StakingRewards contracts;
- shares;
- managed liquidity behavior;
- strategy-level rewards;
- strategy-specific withdrawal behavior;
- internal strategy rebalances;
- different confidence and coverage rules.

A Mellow strategy should not be modeled as if it were a manual Aerodrome deposit unless the wallet actually owns the relevant manual position.

## 3.4 Relationship between Pools, Deposits, and Strategies

The product model should be understood as:

```txt
Pool
  ├── Manual Deposits
  ├── Automated Strategies
  └── Residual Attribution
```

The UI must separate the user-facing concepts:

```txt
Pools      = aggregate by market
Deposits   = individual manual/user-owned deposit lifecycle
Strategies = automated strategy lifecycle/accounting
```

A Mellow strategy may be associated with an Aerodrome pool, and its value should contribute to pool-level aggregate analytics. However, it must also have its own dedicated `Strategies` analysis surface because its share accounting, wrapper behavior, StakingRewards behavior, contract events, internal strategy operations, and confidence model differ from manual Aerodrome deposits.

Manual Aerodrome deposits and automated Mellow strategy deposits must not be collapsed into the same user-facing section without preserving their exposure type.

---

# 4. User Modes

The application has two major modes:

1. **Disconnected mode**
2. **Connected wallet mode**

Authentication is wallet-based. The initial product supports one connected wallet at a time.

---

# 5. Disconnected Experience

## 5.1 Layout

When no wallet is connected, the application shows a public landing experience.

The disconnected layout must include:

- A horizontal top navigation bar.
- Brand logo / wordmark.
- Navigation anchors for landing sections.
- Primary CTA: connect wallet.
- Optional secondary CTA: learn how analysis works.
- A visual hero section that communicates aviation + DeFi analytics.

The top menu should remain visible while the user scrolls through the landing page.

## 5.2 Landing purpose

The landing page introduces The Cab to new users and should communicate:

- The Cab is a control tower for Aerodrome portfolios.
- The user connects a wallet to get an immediate dashboard.
- The app shows quick recent analytics first.
- A deeper historical analysis can be requested or auto-refreshed when stale.
- Once historical analysis is ready, more sections unlock.
- The product supports Aerodrome manual activity and Mellow strategies.
- The app does not require the user to manually reconstruct transactions.

---

# 6. Connected Application Layout

## 6.1 Shell

Once a wallet is connected, the user is redirected to the connected app shell.

The connected layout must include:

- Vertical left sidebar.
- Wallet identity area.
- Navigation sections.
- Analysis CTA/status module.
- Main content panel.
- Optional top status bar for sync state, data age, chain, and selected wallet.

## 6.2 Sidebar navigation

Sidebar sections:

1. Overview
2. Pools
3. Deposits
4. Strategies
5. Rewards
6. Governance
7. Activity
8. Settings

Rewards, Governance, Deposits, and Strategies are first-class sections because they are explicit product modules and should not be hidden inside Activity or collapsed into Pools.

Navigation semantics:

- `Overview` shows the current wallet cockpit and high-level analytics.
- `Pools` shows market-level aggregation by Aerodrome pool.
- `Deposits` shows manual/user-owned deposit lifecycle analytics.
- `Strategies` shows automated strategy analytics, initially focused on Mellow.
- `Rewards` shows claims and reward return across pools, deposits, strategies, and governance.
- `Governance` shows veAERO, voting, relay, fees, bribes, and governance-specific rewards.
- `Activity` shows the transaction-level interpreted ledger.
- `Settings` shows wallet, analysis, display, and diagnostics settings.

## 6.3 Section availability states

Sections are enabled or disabled based on analysis status.

Initial connected state:

- Overview: enabled.
- Pools: disabled until analysis ready.
- Deposits: disabled until analysis ready.
- Strategies: disabled until analysis ready.
- Rewards: disabled until analysis ready.
- Governance: disabled until analysis ready.
- Activity: disabled or limited to recent activity preview until analysis ready.
- Settings: enabled.

Reason:

- Overview can use recent API data from Moralis and Alchemy.
- Deep sections require normalized historical analysis.

## 6.4 Analysis CTA states

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

## 6.5 Polling behavior

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

# 7. Technical Architecture

## 7.1 Framework

The application will be developed in **Next.js**.

Next.js responsibilities:

- Public landing pages.
- Connected app shell.
- API routes.
- Background job orchestration endpoints.
- Server-side data fetching where appropriate.
- Client-side dashboard rendering.
- Integration with database and third-party APIs.

## 7.2 Wallet architecture

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

## 7.2.1 Chain configuration architecture

Product v1 is Base-only, but chain support must be centralized.

The implementation must include a chain configuration module and must not scatter chain-specific constants across features.

Required responsibilities:

- map `chainId` to provider network names;
- map `chainId` to Moralis chain params;
- map `chainId` to Alchemy RPC endpoints;
- define enabled product chains;
- define development/test chains separately from product chains;
- provide chain-aware provider factories;
- provide chain-aware query key helpers.

Suggested helpers:

```ts
getSupportedChain(chainId)
assertSupportedChain(chainId)
getMoralisChain(chainId)
getAlchemyNetwork(chainId)
getRpcClient(chainId)
getExplorerBaseUrl(chainId)
```

Product features should receive or derive `chainId` and pass it through to query hooks, API routes, provider calls, and database queries.


## 7.3 Third-party APIs

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

## 7.4 Data strategy

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

## 7.5 Database

The database schema must be chain-aware. All protocol-specific tables must include `chainId`, and unique constraints involving addresses or transaction hashes must include `chainId`.

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

## 7.6 API design

Initial API surface:

```http
GET  /api/wallet/overview?chainId=8453
POST /api/analysis/start
GET  /api/analysis/status
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

All wallet-specific endpoints must validate:

- Wallet address format.
- Chain ID supported and scoped to Product v1 allowed chains.
- Connected wallet matches requested wallet via signature.
- Analysis availability for deep routes.


## 7.7 Internationalization architecture

The app must use `i18next` and `react-i18next` for internationalization.

English is the base language. Spanish is the second supported language.

### Required files

```txt
src/i18n/config.ts
src/i18n/index.ts
src/i18n/resources/en/*.json
src/i18n/resources/es/*.json
src/i18n/useAppLocale.ts
src/i18n/formatters.ts
```

### App provider

The app must initialize i18next in a provider included in the app root.

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

### Locale storage

If language switching is added, persist the selected language in local storage or user settings.

Resolution priority:

```txt
user preference -> browser locale -> English fallback
```

### Namespace loading

Use namespace-based resources.

Feature code should load/use the namespace for its section:

```ts
useTranslation("pools")
useTranslation("strategies")
useTranslation("activity")
```

Shared UI terms should live in `common` or `navigation`.


## 7.8 Frontend state architecture

The frontend must follow a layered state architecture.

```txt
Server/API state:      TanStack Query
Global UI state:       Zustand
Wallet state:          wagmi behind useCabWallet
Local UI state:        React hooks
Forms:                 React Hook Form + Zod
URL state:             search params
Visual rendering:      *.component.tsx
State orchestration:   *.container.tsx
```

### Core rule

Containers think. Components show.

A `.container` file owns state orchestration, data access, view-model preparation, and callbacks.

A `.component` file owns visual rendering and conditional display based only on props.

### `.container` files

Container files own state, data fetching, mutations, routing awareness, query params, derived view models, and event handlers.

Responsibilities:

- Call TanStack Query hooks.
- Call Zustand stores.
- Call wallet hooks.
- Read/write URL search params.
- Prepare component props.
- Handle user actions.
- Trigger mutations.
- Map API/domain data into view models.
- Decide loading/error/empty states.
- Render the corresponding `.component` file.

Containers may import:

- typed query hooks
- mutation hooks
- Zustand stores
- wallet hooks
- route/search-param utilities
- domain/view-model mappers
- `.component` files

Containers must not contain complex visual markup. They may compose a single top-level component and pass props.

Filename convention:

```txt
Overview.container.tsx
Pools.container.tsx
PoolDetail.container.tsx
Deposits.container.tsx
Rewards.container.tsx
Governance.container.tsx
Activity.container.tsx
Settings.container.tsx
```

### `.component` files

Component files are presentational components.

Responsibilities:

- Receive props.
- Render UI based on props.
- Select visual states based on props.
- Emit callbacks passed by containers.
- Use only Design System components.
- Avoid any direct knowledge of API fetching, query caches, wallet clients, stores, or backend persistence.

Components must not:

- Contain hardcoded user-facing copy.
- Bypass translation resources for labels, buttons, empty states, errors, or chart text.
- Call TanStack Query directly.
- Call Zustand stores directly.
- Call wagmi directly.
- Fetch data directly.
- Read/write URL state directly.
- Access backend clients directly.
- Access database clients directly.
- Contain business data fetching logic.
- Import third-party UI libraries directly.

Filename convention:

```txt
Overview.component.tsx
Pools.component.tsx
PoolDetail.component.tsx
Deposits.component.tsx
Rewards.component.tsx
Governance.component.tsx
Activity.component.tsx
Settings.component.tsx
```

### Feature folder pattern

Each product section should follow this structure:

```txt
src/features/overview/
  Overview.container.tsx
  Overview.component.tsx
  overview.queries.ts
  overview.mappers.ts
  overview.types.ts

src/features/pools/
  Pools.container.tsx
  Pools.component.tsx
  PoolDetail.container.tsx
  PoolDetail.component.tsx
  pools.queries.ts
  pools.mappers.ts
  pools.types.ts

src/features/deposits/
  Deposits.container.tsx
  Deposits.component.tsx
  DepositDetail.container.tsx
  DepositDetail.component.tsx
  deposits.queries.ts
  deposits.mappers.ts
  deposits.types.ts

src/features/strategies/
  Strategies.container.tsx
  Strategies.component.tsx
  StrategyDetail.container.tsx
  StrategyDetail.component.tsx
  strategies.queries.ts
  strategies.mappers.ts
  strategies.types.ts

src/features/activity/
  Activity.container.tsx
  Activity.component.tsx
  activity.queries.ts
  activity.mappers.ts
  activity.types.ts
```

### Query files

`*.queries.ts` files define typed TanStack Query hooks and mutations.

Examples:

```ts
export function useOverviewQuery(params: OverviewQueryParams) {}
export function useAnalysisStatusQuery(params: AnalysisStatusQueryParams) {}
export function useStartAnalysisMutation() {}
```

Rules:

- Query hooks must be typed.
- Query keys must be centralized or generated consistently.
- Query keys must include `chainId` for all wallet/protocol data.
- Polling behavior belongs in query hooks or container-level query options, not in components.
- Query hooks must not import visual components.

### Mapper files

`*.mappers.ts` files transform API/domain responses into view models for presentational components.

Rules:

- Components receive display-ready view models.
- Components should not perform domain-heavy calculations.
- Currency formatting helpers may be used before props are passed, unless the DS component owns formatting.

Example:

```ts
export function mapOverviewToViewModel(data: OverviewApiResponse): OverviewViewModel {
  return {
    netPortfolioValue: {
      raw: data.totalValueUsd,
      formatted: formatUsd(data.totalValueUsd),
    },
    portfolioSeries: data.snapshots.map(mapSnapshotToChartPoint),
  };
}
```

### Type files

`*.types.ts` files define API params, view models, and component prop types when shared.

Rules:

- Prefer explicit view-model types over passing raw API responses into components.
- Component props should be stable and intentionally designed.
- Do not leak provider-specific API response shapes into visual components.

### Example

```tsx
// Overview.container.tsx
"use client";

import { useCabWallet } from "@/wallet/useCabWallet";
import { OverviewComponent } from "./Overview.component";
import { useOverviewQuery } from "./overview.queries";
import { mapOverviewToViewModel } from "./overview.mappers";

export function OverviewContainer() {
  const { address, chainId } = useCabWallet();

  const overviewQuery = useOverviewQuery({
    walletAddress: address,
    chainId,
  });

  const viewModel = overviewQuery.data
    ? mapOverviewToViewModel(overviewQuery.data)
    : null;

  return (
    <OverviewComponent
      data={viewModel}
      isLoading={overviewQuery.isLoading}
      isError={overviewQuery.isError}
      errorMessage={overviewQuery.error?.message}
      onRefresh={() => overviewQuery.refetch()}
    />
  );
}
```

```tsx
// Overview.component.tsx
import {
  CabDashboardGrid,
  CabMetricCard,
  CabPortfolioEvolutionChart,
  CabEmptyState,
  CabLoadingPanel,
  CabErrorPanel,
} from "@/design-system";
import type { OverviewViewModel } from "./overview.types";

type Props = {
  data: OverviewViewModel | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRefresh: () => void;
};

export function OverviewComponent({
  data,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
}: Props) {
  if (isLoading) return <CabLoadingPanel label="Loading cockpit data..." />;

  if (isError) {
    return (
      <CabErrorPanel
        title="Overview unavailable"
        message={errorMessage}
        onRetry={onRefresh}
      />
    );
  }

  if (!data) {
    return <CabEmptyState title="No Aerodrome activity detected" />;
  }

  return (
    <CabDashboardGrid>
      <CabMetricCard
        label="Net Portfolio Value"
        value={data.netPortfolioValue.formatted}
        delta={data.netPortfolioDelta}
      />

      <CabPortfolioEvolutionChart data={data.portfolioSeries} />
    </CabDashboardGrid>
  );
}
```

### Replaceability rule

A `.component` file should be replaceable in isolation without touching data fetching, cache, wallet, backend, or business state.

A `.container` file should be replaceable in isolation without rewriting visual layout.

This rule exists to make The Cab easier to maintain, easier to refactor, and safer for AI-assisted development.

Translation resources are the only allowed source of user-facing copy.


---

# 8. Design System

## 8.1 Requirement

The Cab must have a coherent internal Design System instead of ad hoc styling.

The UI must integrate:

- **Tamagui** as the low-level component/styling system.
- **Google Fonts** for the brand font stack.
- **Lucide React** as the icon library.
- **Recharts** as the charting library.
- **i18next/react-i18next** for localized user-facing copy.
- Brand tokens derived from The Cab brand specification.
- Reusable components for dashboard surfaces.
- Consistent spacing, typography, surfaces, charts, and semantic states.

## 8.2 Third-party library boundary rule

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

## 8.3 Approved third-party libraries for UI MVP

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

## 8.4 Suggested DS folder structure

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

## 8.5 Import policy

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


## 8.5.1 Component/container import policy

The component/container separation is part of the Design System boundary.

### Product `.component` files may import only:

- `@/design-system`
- local type definitions
- local presentational helpers
- other presentational components

### Product `.container` files may import:

- typed query hooks
- mutation hooks
- Zustand stores
- wallet adapters
- view-model mappers
- `.component` files
- route/search-param utilities

### Forbidden in `.component` files:

```ts
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { useAccount } from "wagmi";
import { Button } from "tamagui";
import { Radar } from "lucide-react";
import { LineChart } from "recharts";
```

### Forbidden in `.component` files conceptually:

- raw `fetch`
- direct API clients
- database clients
- Trigger.dev clients
- provider SDK clients
- wallet SDK calls
- query cache access
- mutation calls
- route mutation side effects


## 8.6 Font stack

Use Google Fonts:

- `Orbitron` for brand/display/headline moments.
- `Inter` for UI, body, navigation, cards, labels, and tables.
- `IBM Plex Mono` for wallet addresses, tx hashes, timestamps, block numbers, and technical metadata.

Rules:

- Do not use Orbitron for dense UI, tables, or long body copy.
- Use Inter as the default product font.
- Use IBM Plex Mono only as a technical accent.
- Apply `font-variant-numeric: tabular-nums` to financial values, balances, timestamps, tables, and KPI values.

## 8.7 Tamagui token requirements

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

## 8.8 Component families

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
- `CabDepositCard`
- `CabStrategyCard`
- `CabRewardTimeline`
- `CabActivityEventRow`
- `CabRebalanceMarker`
- `CabResidualAttributionPanel`

## 8.9 Chart styling

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

## 8.10 DS acceptance criteria

The implementation is not acceptable if:

- Product screens import from `tamagui`.
- Product screens import from `lucide-react`.
- Product screens import from `recharts`.
- Product screens use hardcoded brand colors instead of tokens.
- Product screens build custom chart primitives directly.
- Product screens bypass Cab-prefixed DS components for common UI.

---

# 9. Background Historical Analysis Job

## 9.1 Purpose

The background analysis job reconstructs the historical Aerodrome/Mellow activity of a wallet.

It must populate the domain model so each section can display historical data clearly and consistently.

The job is not a general open-ended chain indexer. It is a wallet-scoped, user-requested or stale-triggered reconstruction pipeline.

## 9.2 Job trigger

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

## 9.3 Trigger.dev architecture

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

## 9.4 Serverless hosting constraint

Vercel serverless functions are not ideal for long-running processes. Therefore:

- Do not process full wallet history inside a single Next.js route.
- Use Trigger.dev for long-running work.
- Next.js routes should only enqueue and report status.
- Trigger.dev should own the analysis lifecycle.

## 9.5 Analysis pipeline stages

The pipeline should be deterministic and restartable.

The pipeline must be chain-aware. Every analysis run is scoped to a single `walletAddress + chainId` pair. Product v1 defaults to Base mainnet, but no analysis stage may assume address uniqueness without `chainId`.



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

- Aerodrome Router interactions.
- Aerodrome pool interactions.
- Pool events and LP token mint/burn/transfer events.
- Gauge/staking interactions.
- Gauge stake/unstake/reward events.
- Reward, bribe, fee, and distributor contract interactions.
- AERO token movements.
- veAERO / voting escrow contract interactions.
- Voter, vote, reset, and relay contracts.
- Mellow wrapper/vault/staking/strategy contracts.
- Token transfers relevant to any of these operations.
- Swaps involving pool tokens around residual attribution states.

Important:

- The Router should be treated as a primary discovery anchor, not as the only source of protocol activity.
- Stake, unstake, claims, veAERO, votes, fees, bribes, and Mellow activity must be detected through their own protocol surfaces, not inferred as Router activity.

Persist raw provider records or raw event envelopes for auditability.

### Stage 3 — Identify supported protocol surfaces

Classify raw transactions into supported interaction families:

- Aerodrome manual LP.
- Aerodrome swaps.
- Aerodrome gauges.
- Aerodrome rewards.
- Mellow Aerodrome strategy.
- Mellow wrapper/vault/share activity.
- Mellow StakingRewards activity.
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
- `strategy_deposit`
- `strategy_withdraw`
- `strategy_stake`
- `strategy_unstake`
- `strategy_claim`
- `strategy_share_mint`
- `strategy_share_burn`
- `strategy_internal_rebalance`
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

### Stage 7 — Build pools, deposits, strategies, and strategy exposures

Create or update:

- Pools.
- Deposits.
- Strategies.
- Strategy exposures.
- Lifecycle state.

Manual deposit identity:

- Aerodrome NFT token ID identifies the position.
- Mint creates a new position.
- Increase liquidity updates same position.
- Decrease/withdraw/collect affect same position.
- Burn/fully withdrawn closes the position if no active exposure remains.

Mellow strategy exposure identity:

- Track Mellow exposure as `StrategyExposure`.
- Do not treat Mellow as if user directly owns the underlying Aerodrome NFT.
- Use wrapper, vault, StakingRewards, and share behavior as the identity basis.
- Link the `StrategyExposure` to the underlying `Pool` when official Mellow metadata or reliable onchain data provides that relationship.
- Mark coverage as `share_level` when user share accounting is reliable but internal strategy accounting is incomplete.

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

When a swap consumes more of a token than the residual amount attributed to the candidate pool, the swap must be decomposed into source allocations.

Source allocation priority:

1. Consume the candidate pool residual attribution up to the available amount.
2. Consume matching-token cash-ins.
3. Consume liquidation-derived inventory.
4. Consume remaining same-token residual attribution from other pools pro rata.

This means a single swap may produce multiple analytical allocations:

- one portion classified as same-pool rebalance;
- one portion classified as cash-in-funded swap;
- one portion classified as liquidation-inventory swap;
- one or more portions allocated against other pool residual states.

The analysis job must not force the full swap amount into the candidate pool if the pool residual does not cover the full token input.

This avoids misleading pool charts that drop to zero during a rebalance process, and also avoids over-attributing unrelated wallet inventory to the wrong pool.

### Stage 9 — Compute snapshots

Compute reusable snapshots for:

- Portfolio.
- Pool.
- Strategy.
- Deposit.
- Strategy.
- Strategy exposure.

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

## 9.6 Idempotency

Every analysis stage must be idempotent.

Recommended unique keys:

- `LedgerEvent`: wallet + chain + txHash + logIndex + eventType + protocol.
- `AssetMovement`: ledgerEventId + tokenAddress + direction + amountRaw + movementIndex.
- `PricePoint`: tokenAddress + timestamp bucket + source + resolution.
- `PositionInstance`: strategy + tokenId for manual, strategy + wrapper/share identity for Mellow.
- `AnalysisRun`: runId.
- `ProtocolContract`: chainId + address.
- `Pool`: chainId + poolAddress.
- `Strategy`: chainId + wrapperAddress or chainId + strategyContractAddress.
- `PricePoint`: chainId + tokenAddress + timestamp bucket + source + resolution.

- `AttributionState`: chainId + wallet + poolId + tokenAddress + sourceLedgerEventId.

A repeated run must not duplicate events or inflate metrics.

## 9.7 Incremental updates

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

# 10. Domain Model

This section defines the complete domain model for The Cab.

The model must be consistent with the product terminology:

- **Pool**: the venue/base market, such as `WETH/cbBTC` or `AERO/USDC`.
- **Deposit**: a direct user-owned/manual exposure lifecycle inside an Aerodrome pool.
- **Strategy**: an automated strategy layer, initially focused on Mellow, with its own wrapper/vault/share/reward accounting.
- **Residual attribution**: token inventory that remains economically attributed to a pool after a withdrawal until it is resolved by an actual token movement.
- **Ledger events**: the normalized source of truth for all analytics.
- **Asset movements**: token-level deltas caused by ledger events.
- **Snapshots**: computed analytics states for portfolio, pools, deposits, strategies, and governance scopes.

The model is designed for:

- one connected wallet at a time;
- Base mainnet;
- Aerodrome Finance;
- Mellow Aerodrome strategies;
- USD/USDC-centric valuation;
- deterministic onchain reconstruction;
- pool-level aggregation;
- direct deposit lifecycle analytics;
- automated strategy analytics;
- historical performance reconstruction;
- transaction-level explainability;
- permanent analysis storage.

---

## 10.1 Design principles

The domain model follows these principles:

1. **Pool-first aggregation**  
   Pools are the main market-level aggregation unit.

2. **Deposit/strategy separation**  
   Manual deposits and automated strategies must remain separate analytical concepts.

3. **Lifecycle integrity**  
   Deposits and strategies must have explicit lifecycle events from opening through closing.

4. **Ledger-first truth**  
   All analytics must derive from normalized `LedgerEvent` and `AssetMovement` records.

5. **Portfolio completeness**  
   Open deposits, automated strategies, idle assets, residual attributed assets, rewards, and governance exposure all contribute to portfolio understanding.

6. **Explainability**  
   Every metric should be traceable back to transactions, ledger events, asset movements, price points, and attribution decisions.

7. **Confidence and coverage**  
   The system must expose when data is complete, partial, inferred, unsupported, or ambiguous.

8. **No silent over-attribution**  
   A pool must not absorb more of a token movement than its residual attribution can support. Excess token movement must follow the source-priority waterfall.

---

## 10.2 Chain-aware domain requirement

Product v1 is Base mainnet only, but the domain model must be chain-aware from day one.

Every entity that represents protocol state, protocol metadata, wallet activity, token balances, prices, pool exposure, strategy exposure, rewards, governance, or analytics snapshots must either include `chainId` directly or inherit it unambiguously from a parent scope.

Reason:

- Aero is expected to evolve Aerodrome/Velodrome toward a multi-chain platform.
- The same wallet address can exist on multiple chains.
- Token addresses are chain-scoped.
- Pool addresses are chain-scoped.
- Strategy, wrapper, vault, and gauge addresses are chain-scoped.
- Governance and reward contracts are chain-scoped.
- Transaction hashes should not be treated as globally unique for application-level identity.
- Historical prices must be resolved by `chainId + tokenAddress + timestamp`.
- Protocol metadata must be versioned and scoped by chain.

Implementation rule:

```txt
Never key protocol entities by address alone.
Always key them by chainId + address.
```

All database indexes and unique constraints involving addresses, transaction hashes, token IDs, protocol contracts, pools, deposits, strategies, rewards, governance events, and price points must include `chainId` where applicable.


## 10.3 Entity overview

Core entities:

- `WalletContext`
- `AnalysisRun`
- `RawProviderRecord`
- `Protocol`
- `ProtocolContract`
- `Pool`
- `Deposit`
- `Strategy`
- `StrategyExposure`
- `LedgerEvent`
- `AssetMovement`
- `PricePoint`
- `AttributionState`
- `AttributionSourceLot`
- `RewardEvent`
- `GovernanceEvent`
- `PerformanceSnapshot`
- `PortfolioSnapshot`
- `CoverageReport`
- `DiscardedEvent`

---

## 10.3 WalletContext

Represents the connected wallet being analyzed.

### Fields

- `walletContextId`
- `address`
- `chainId`
- `connectedAt`
- `lastAnalyzedAt`
- `lastIndexedBlock`
- `analysisStatus`
- `createdAt`
- `updatedAt`

### Status candidates

- `not_started`
- `queued`
- `running`
- `ready`
- `stale`
- `failed`

### Purpose

- Identifies the wallet context for all analysis.
- Powers connected app state.
- Stores analysis freshness.
- Provides the parent scope for portfolio-level analytics.

### Notes

- The product supports one active wallet at a time in the connected UI.
- Historical analysis data is stored permanently unless a future deletion workflow is added.

---

## 10.4 AnalysisRun

Represents one wallet analysis execution.

### Fields

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

### Mode candidates

- `full_history`
- `incremental_update`
- `retry`

### Status candidates

- `not_started`
- `queued`
- `running`
- `ready`
- `failed`
- `stale`
- `cancelled`

### Purpose

- Powers background analysis status.
- Supports Trigger.dev job orchestration.
- Enables polling from the connected UI.
- Tracks progress and failure state.
- Enables incremental updates after the initial full analysis.

---

## 10.5 RawProviderRecord

Stores raw external API records used for reconstruction.

### Fields

- `rawProviderRecordId`
- `analysisRunId`
- `walletAddress`
- `chainId`
- `provider`
- `sourceType`
- `externalId`
- `txHash`
- `blockNumber`
- `timestamp`
- `payloadJson`
- `createdAt`

### Provider candidates

- `moralis`
- `alchemy`
- `onchain_rpc`
- `manual_protocol_metadata_sync`

### Source type candidates

- `wallet_history`
- `erc20_transfer`
- `nft_transfer`
- `transaction`
- `decoded_transaction`
- `token_price`
- `contract_read`
- `protocol_metadata`

### Purpose

- Provides auditability.
- Allows reclassification without refetching where possible.
- Supports debugging and provider comparison.
- Makes analysis explainable.

---

## 10.6 Protocol

Represents a supported DeFi protocol or protocol family.

### Fields

- `protocolId`
- `name`
- `slug`
- `chainId`
- `status`
- `createdAt`
- `updatedAt`

### Initial protocol values

- `aerodrome`
- `mellow_aerodrome`

### Purpose

- Groups protocol-specific interpretation.
- Allows manual Aerodrome and Mellow strategy behavior to remain distinct.
- Supports future extension to additional strategy providers.

---

## 10.7 ProtocolContract

Represents an official or discovered contract used for protocol discovery.

### Fields

- `protocolContractId`
- `protocolId`
- `chainId`
- `address`
- `contractType`
- `label`
- `source`
- `sourceReference`
- `discoveredAtBlock`
- `discoveredAtTimestamp`
- `confidence`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Contract type candidates

- `router`
- `factory`
- `pool`
- `gauge`
- `reward_distributor`
- `bribe`
- `fee_distributor`
- `voter`
- `voting_escrow`
- `aero_token`
- `mellow_wrapper`
- `mellow_vault`
- `mellow_strategy`
- `mellow_staking_rewards`

### Source candidates

- `official_docs`
- `router_default_factory`
- `router_pool_for`
- `contract_event`
- `onchain_read`
- `provider_detection`
- `manual_fallback`

### Purpose

- Stores Router, AERO token, active factory, discovered pools, gauges, and Mellow strategy contracts.
- Prevents long hardcoded whitelists.
- Records provenance and confidence for protocol metadata.

### Important rules

- The Aerodrome PoolFactory should be read from the Router via `defaultFactory()` and stored here as protocol metadata.
- Hardcoded factory addresses are fallback only and must be validated against the Router before production use.
- Router is an anchor for discovery, not a complete index.

---

## 10.8 Pool

Represents an Aerodrome market/venue.

A Pool is the market-level aggregation layer.

Examples:

- `WETH/cbBTC`
- `AERO/USDC`
- `wstETH/WETH`

### Fields

- `poolId`
- `protocolId`
- `chainId`
- `poolAddress`
- `factoryAddress`
- `token0Address`
- `token1Address`
- `token0Symbol`
- `token1Symbol`
- `stable`
- `feeTier`
- `displayName`
- `isActive`
- `discoverySource`
- `confidence`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Purpose

A pool aggregates:

- manual deposits;
- automated strategies;
- residual attributed balances;
- pool-level rewards;
- rebalances;
- activity;
- performance snapshots.

### Rules

- A Pool must not be treated as a Deposit.
- A Pool must not be treated as a Strategy.
- Pool-level analytics aggregate manual and automated exposure while preserving the distinction between them.
- A Mellow strategy may contribute to pool-level aggregate value, but detailed strategy accounting belongs in `Strategy`.

---

## 10.9 Deposit

Represents a direct user-owned/manual exposure lifecycle inside an Aerodrome pool.

This is the user-facing replacement for the old “Position” concept.

### Fields

- `depositId`
- `walletAddress`
- `chainId`
- `poolId`
- `protocolId`
- `depositType`
- `status`
- `openedAt`
- `closedAt`
- `openTxHash`
- `closeTxHash`
- `openedValueUsd`
- `closedValueUsd`
- `currentValueUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `rewardRealizedUsd`
- `confidence`
- `coverageStatus`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Deposit type candidates

- `manual_aerodrome_lp`
- `manual_aerodrome_cl`
- `manual_staked_lp`
- `automated_strategy_reference`

### Status candidates

- `open`
- `partially_reduced`
- `staked`
- `unstaked`
- `closed`
- `burned`
- `archived`
- `partial_history`

### Manual Aerodrome-specific fields

These may be columns or stored under `metadataJson`, depending on implementation preference:

- `tokenId`
- `tickLower`
- `tickUpper`
- `initialLiquidity`
- `currentLiquidity`
- `gaugeAddress`
- `stakedAt`
- `unstakedAt`

### Purpose

Deposits power the `Deposits` section.

They answer:

- What manual deposits did the user open?
- What was the entry value?
- What changes occurred over time?
- Was the deposit staked?
- What was claimed?
- What was withdrawn?
- What is the current or closed value?
- What was the return?

### Rules

- Manual Aerodrome deposits are user-owned lifecycle entities.
- If an Aerodrome NFT token ID exists, it is the primary identity for the deposit.
- `increaseLiquidity(existing tokenId)` updates the same deposit.
- `decreaseLiquidity`, `collect`, `stake`, `unstake`, and `withdraw` affect the same deposit lifecycle where identity can be established.
- Mellow exposure should not be modeled as a manual deposit unless the wallet actually owns the relevant manual Aerodrome position.
- Automated strategies are represented in `Strategy` and `StrategyExposure`.
- If the UI needs to reference automated exposure from Deposits, use `depositType = automated_strategy_reference` as a cross-link, not as the canonical strategy model.

---

## 10.10 Strategy

Represents an automated strategy layer.

Initial focus:

- Mellow Aerodrome strategies.

A Strategy may be associated with one or more Aerodrome pools, but it has its own accounting model.

### Fields

- `strategyId`
- `protocolId`
- `chainId`
- `strategyType`
- `label`
- `status`
- `primaryPoolId`
- `sourceContractAddress`
- `wrapperAddress`
- `vaultAddress`
- `stakingRewardsAddress`
- `rootVaultAddress`
- `erc20RootVaultAddress`
- `strategyContractAddress`
- `shareTokenAddress`
- `underlyingToken0Address`
- `underlyingToken1Address`
- `discoverySource`
- `confidence`
- `coverageStatus`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Strategy type candidates

- `mellow_auto`
- `managed_lp`
- `vault_strategy`
- `unknown_automated_strategy`

### Status candidates

- `active`
- `inactive`
- `deprecated`
- `unsupported`
- `partial`

### Purpose

Strategies power the `Strategies` section.

They answer:

- Which automated strategies has the wallet used?
- Which pool or pools does the strategy map to?
- What contracts define the strategy?
- What share accounting is available?
- What value was deposited?
- What was withdrawn?
- What rewards were claimed?
- What is the current value?
- What is the coverage/confidence level?

### Rules

- Strategy is not the same as Pool.
- Strategy is not the same as Deposit.
- Mellow strategy exposure should be modeled here, not collapsed into manual Deposits.
- Strategy value may contribute to Pool aggregate analytics when the underlying pool is known.
- If only share-level accounting is available, coverage must be marked as `share_level` or `partial`.

---

## 10.11 StrategyExposure

Represents the wallet’s lifecycle within a Strategy.

A Strategy is the product/integration definition. A StrategyExposure is the user wallet’s actual participation in that strategy.

### Fields

- `strategyExposureId`
- `walletAddress`
- `chainId`
- `strategyId`
- `poolId`
- `status`
- `openedAt`
- `closedAt`
- `openTxHash`
- `closeTxHash`
- `shareBalance`
- `sharesReceived`
- `sharesRedeemed`
- `shareTokenAddress`
- `sharePriceUsd`
- `coverageReason`
- `openedValueUsd`
- `closedValueUsd`
- `currentValueUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `rewardRealizedUsd`
- `confidence`
- `coverageStatus`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Status candidates

- `open`
- `partially_reduced`
- `closed`
- `share_level_only`
- `partial_history`
- `unsupported`

### Purpose

- Tracks a wallet’s deposits, withdrawals, shares, and rewards inside an automated strategy.
- Allows Mellow to have its own lifecycle without pretending it is a manual Aerodrome deposit.
- Supports strategy-level performance snapshots.

### Rules

- If the strategy maps to a pool, `poolId` should be set.
- If the pool relationship is inferred rather than official, confidence must reflect that.
- StrategyExposure is the canonical user-level lifecycle for automated strategies.
- Deposit may cross-link to StrategyExposure, but should not duplicate it.

---

## 10.12 LedgerEvent

Represents a normalized event derived from one or more onchain actions.

LedgerEvent is the canonical event-level source of truth.

### Fields

- `ledgerEventId`
- `analysisRunId`
- `walletAddress`
- `chainId`
- `protocolId`
- `poolId`
- `depositId`
- `strategyId`
- `strategyExposureId`
- `governanceEventId`
- `eventType`
- `txHash`
- `logIndex`
- `blockNumber`
- `timestamp`
- `confidence`
- `rawSource`
- `isDiscarded`
- `metadataJson`
- `createdAt`

### Event type candidates

#### Wallet and capital flow

- `cash_in`
- `cash_out`
- `external_deposit`
- `external_withdrawal`
- `idle_balance_change`

#### Pool/deposit lifecycle

- `mint_deposit`
- `increase_liquidity`
- `decrease_liquidity`
- `collect_fees`
- `stake`
- `unstake`
- `withdraw`
- `burn`
- `close_deposit`

#### Strategy lifecycle

- `strategy_deposit`
- `strategy_withdraw`
- `strategy_stake`
- `strategy_unstake`
- `strategy_claim`
- `strategy_share_mint`
- `strategy_share_burn`

#### Swaps and attribution

- `swap`
- `rebalance`
- `liquidation`
- `residual_attribution_opened`
- `residual_attribution_consumed`
- `source_lot_consumed`

#### Rewards

- `claim_reward`
- `claim_fees`
- `claim_bribe`
- `claim_rebase`

#### Governance

- `lock_aero`
- `increase_lock_amount`
- `extend_lock_time`
- `relock_aero`
- `vote`
- `reset_vote`
- `relay_join`
- `relay_exit`
- `claim_voting_fees`

#### Classification states

- `unsupported`
- `malicious`
- `ambiguous`
- `discarded`

### Purpose

- Provides the canonical timeline for Activity.
- Links raw provider records to domain entities.
- Allows every metric to be traced back to one or more events.
- Supports partial and inferred classification through confidence.

### Rules

- A LedgerEvent may be linked to a Pool, Deposit, Strategy, StrategyExposure, GovernanceEvent, or none depending on context.
- A single transaction may produce multiple LedgerEvents.
- A single LedgerEvent may produce multiple AssetMovements.
- Inferred events such as `rebalance` must preserve links to the underlying raw swap/withdraw/deposit events.

---

## 10.13 AssetMovement

Represents token-level deltas caused by a LedgerEvent.

### Fields

- `assetMovementId`
- `ledgerEventId`
- `walletAddress`
- `chainId`
- `tokenAddress`
- `symbol`
- `amountRaw`
- `amountNormalized`
- `direction`
- `usdValueAtEvent`
- `pricePointId`
- `priceSource`
- `movementIndex`
- `metadataJson`
- `createdAt`

### Direction candidates

- `in`
- `out`
- `internal`
- `mint`
- `burn`
- `claim`
- `fee`
- `unknown`

### Purpose

AssetMovement allows exact decomposition of:

- what moved;
- how much moved;
- in which direction;
- what it was worth at the event time;
- which event caused it.

### Rules

- All financial analytics should derive from AssetMovement records.
- Token movements used in residual attribution must reference their source LedgerEvent.
- A single swap should have separate outbound and inbound AssetMovement records.
- Every valued movement should link to a PricePoint when possible.

---

## 10.14 PricePoint

Represents a historical or current price used for valuation.

### Fields

- `pricePointId`
- `tokenAddress`
- `symbol`
- `chainId`
- `timestamp`
- `priceUsd`
- `source`
- `resolution`
- `confidence`
- `metadataJson`
- `createdAt`

### Source candidates

- `alchemy_address_price`
- `alchemy_historical_price`
- `alchemy_symbol_fallback`
- `manual_missing_price`
- `unknown`

### Purpose

Supports:

- event-time valuation;
- current valuation;
- realized and unrealized PnL attribution;
- rewards valuation;
- capital in/out valuation;
- rebalance valuation.

### Rules

- Alchemy is the pricing source of truth.
- Address-based pricing is preferred.
- Symbol fallback must be marked lower confidence.
- If price is unavailable, store coverage/partial data rather than silently substituting another provider.

---

## 10.15 AttributionState

Tracks residual pool-attributed assets after withdraw/rebalance operations.

### Fields

- `attributionStateId`
- `walletAddress`
- `chainId`
- `poolId`
- `depositId`
- `strategyId`
- `strategyExposureId`
- `tokenAddress`
- `amountNormalized`
- `usdValueAtLastUpdate`
- `sourceLedgerEventId`
- `status`
- `openedAt`
- `closedAt`
- `closeReason`
- `confidence`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Status candidates

- `waiting_for_rebalance`
- `rebalanced_same_pool`
- `redeployed_same_pool`
- `transferred_to_other_pool`
- `liquidated_to_unrelated_asset`
- `transferred_to_external_wallet`
- `fully_spent`
- `still_waiting`

### Purpose

- Preserves pool-level continuity after withdrawal.
- Prevents pool charts from falsely dropping to zero during rebalance flows.
- Allows residual balances to remain attributed until actual asset movement resolves them.
- Supports multiple pools sharing the same token.

### Rules

- Attribution does not expire due to elapsed time.
- There is no expiration status.
- Attribution must never become negative.
- If a movement exceeds one attribution state, excess must be assigned through the source-priority waterfall.
- Pool attribution is per pool and per token, not global per token.

---

## 10.16 AttributionSourceLot

Tracks non-pool-residual token inventory that may later be consumed by swaps or transfers.

This entity is required to disambiguate swaps that exceed a pool’s residual balance.

### Fields

- `attributionSourceLotId`
- `walletAddress`
- `chainId`
- `tokenAddress`
- `amountNormalized`
- `usdValueAtAcquisition`
- `sourceType`
- `sourceLedgerEventId`
- `openedAt`
- `closedAt`
- `status`
- `confidence`
- `metadataJson`
- `createdAt`
- `updatedAt`

### Source type candidates

- `cash_in`
- `liquidation_derived_inventory`
- `reward_conversion_inventory`
- `unknown_wallet_inventory`

### Status candidates

- `available`
- `partially_consumed`
- `fully_consumed`
- `transferred_out`
- `reassigned`

### Purpose

- Represents wallet inventory not directly attributed to a pool residual.
- Supports the attribution waterfall when swap amounts exceed a candidate pool residual.
- Prevents over-attribution of large swaps to a single pool.
- Allows reward conversions, such as `AERO -> cbBTC`, to become liquidation-derived inventory rather than pool residual.

### Consumption priority

1. Specific pool residual attribution.
2. Matching-token `cash_in` source lots.
3. Matching-token `liquidation_derived_inventory` or `reward_conversion_inventory` source lots.
4. Other same-token pool residual attribution states pro rata.
5. Unknown wallet inventory only if no other source can explain the movement, marked low confidence.

---

## 10.17 RewardEvent

Represents a reward or claim event in a query-friendly form.

Rewards may also be represented as LedgerEvents, but RewardEvent provides a derived analytics surface.

### Fields

- `rewardEventId`
- `walletAddress`
- `poolId`
- `depositId`
- `strategyId`
- `strategyExposureId`
- `governanceEventId`
- `rewardType`
- `txHash`
- `blockNumber`
- `timestamp`
- `tokenAddress`
- `symbol`
- `amountNormalized`
- `usdValueAtClaim`
- `pricePointId`
- `sourceLedgerEventId`
- `source`
- `metadataJson`
- `createdAt`

### Reward type candidates

- `lp_fee`
- `gauge_reward`
- `strategy_reward`
- `mellow_reward`
- `voting_fee`
- `bribe`
- `rebase`
- `unknown_reward`

### Purpose

- Powers the Rewards section.
- Allows grouping by pool, deposit, strategy, token, governance source, and reward type.
- Prevents double counting across Pool, Strategy, Governance, and Rewards views.

### Rules

- Rewards should be valued at claim time.
- Governance rewards should be displayed by pool where supported.
- A reward may appear in multiple views but must only be counted once in totals.
- Reward source and scope must be explicit.

---

## 10.18 GovernanceEvent

Represents veAERO and governance-specific behavior.

### Fields

- `governanceEventId`
- `walletAddress`
- `chainId`
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
- `sourceLedgerEventId`
- `metadataJson`
- `createdAt`

### Event type candidates

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

### Purpose

- Powers Governance.
- Separates veAERO and voting behavior from deposits.
- Allows governance rewards to be grouped by pool where Aerodrome supports that association.

### Rules

- Governance events are not deposit events.
- Governance rewards may be linked to RewardEvent.
- Governance rewards should be displayed by pool when possible.
- Unsupported governance behavior should be surfaced through CoverageReport.

---

## 10.19 PerformanceSnapshot

Represents a computed performance state for a chosen analytical scope.

### Fields

- `performanceSnapshotId`
- `walletAddress`
- `chainId`
- `scopeType`
- `scopeId`
- `timestamp`
- `capitalInUsd`
- `capitalOutUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `rewardRealizedUsd`
- `assetPriceEffectUsd`
- `rebalanceRealizedUsd`
- `currentValueUsd`
- `estimatedAnnualizedReturnPct`
- `coverageStatus`
- `confidence`
- `metadataJson`
- `createdAt`

### Scope type candidates

- `portfolio`
- `pool`
- `deposit`
- `strategy`
- `strategy_exposure`
- `governance`

### Purpose

- Provides reusable metrics for dashboards and reports.
- Powers Pools, Deposits, Strategies, Rewards, Governance, and Overview.

### Rules

- Snapshot scope must be explicit.
- Strategy snapshots must not be merged into deposit snapshots.
- Pool snapshots may aggregate deposits, strategies, rewards, and residual attribution.
- All annualized return values must be labeled estimated.

---

## 10.20 PortfolioSnapshot

Represents current or historical overall portfolio state.

### Fields

- `portfolioSnapshotId`
- `walletAddress`
- `chainId`
- `timestamp`
- `totalValueUsd`
- `openDepositsValueUsd`
- `strategyExposureValueUsd`
- `idleAssetsValueUsd`
- `residualAttributedValueUsd`
- `governanceValueUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `capitalInUsd`
- `capitalOutUsd`
- `coverageStatus`
- `confidence`
- `metadataJson`
- `createdAt`

### Purpose

- Powers the Overview portfolio chart.
- Gives portfolio-level accounting across deposits, strategies, idle assets, residual balances, rewards, and governance.

### Rules

- Portfolio value should include open deposits, strategy exposure, idle assets, and residual attributed balances.
- Values must avoid double-counting strategy exposure inside both Strategy and Pool aggregates.
- Pool aggregation and portfolio aggregation must preserve source scopes.

---

## 10.21 CoverageReport

Captures completeness and confidence for a scope.

### Fields

- `coverageReportId`
- `analysisRunId`
- `walletAddress`
- `chainId`
- `scopeType`
- `scopeId`
- `coverageStatus`
- `missingDataTypes`
- `unsupportedTransactionsCount`
- `ambiguousTransactionsCount`
- `providerErrorsCount`
- `confidence`
- `notes`
- `createdAt`
- `updatedAt`

### Scope type candidates

- `portfolio`
- `pool`
- `deposit`
- `strategy`
- `strategy_exposure`
- `governance`
- `activity`
- `price`
- `provider`

### Coverage statuses

- `complete`
- `partial`
- `limited`
- `failed`
- `share_level`
- `unknown`

### Purpose

- Prevents false precision.
- Allows UI to show partial coverage.
- Makes Mellow/share-level accounting explicit.
- Supports diagnostics and analysis confidence.

---

## 10.22 DiscardedEvent

Represents detected events intentionally excluded from sensitive analytics.

### Fields

- `discardedEventId`
- `analysisRunId`
- `walletAddress`
- `chainId`
- `txHash`
- `reasonType`
- `reasonMessage`
- `rawClassification`
- `timestamp`
- `metadataJson`
- `createdAt`

### Reason type candidates

- `malicious`
- `unsupported`
- `ambiguous`
- `invalid`
- `spam`
- `irrelevant`

### Purpose

- Prevents spam or malicious events from corrupting analytics.
- Makes exclusions auditable.
- Supports the rule that The Cab should not require manual reconciliation as a core workflow.

---

## 10.23 Relationships

High-level relationships:

```txt
WalletContext
  -> AnalysisRun
  -> PortfolioSnapshot
  -> CoverageReport

Protocol
  -> ProtocolContract

Pool
  -> Deposit
  -> Strategy
  -> StrategyExposure
  -> AttributionState
  -> RewardEvent
  -> PerformanceSnapshot

Deposit
  -> LedgerEvent
  -> AssetMovement
  -> RewardEvent
  -> PerformanceSnapshot

Strategy
  -> StrategyExposure
  -> RewardEvent
  -> PerformanceSnapshot

StrategyExposure
  -> LedgerEvent
  -> AssetMovement
  -> RewardEvent
  -> PerformanceSnapshot

LedgerEvent
  -> AssetMovement
  -> RewardEvent
  -> GovernanceEvent
  -> AttributionState
  -> AttributionSourceLot

AssetMovement
  -> PricePoint

GovernanceEvent
  -> RewardEvent
  -> PerformanceSnapshot
```

Relational rules:

- One wallet can have many analysis runs.
- One pool can have many deposits.
- One pool can have many strategies.
- One strategy can have many wallet-level strategy exposures.
- One deposit can have many ledger events.
- One strategy exposure can have many ledger events.
- One ledger event can have many asset movements.
- One asset movement should link to a price point when valued.
- One pool/deposit/strategy/strategy exposure/governance scope can have many performance snapshots.
- One reward may be visible in multiple UI views but must be counted once.

---

## 10.25 Chain-aware identity rules

All address-based entities must be keyed by `chainId + address`.

Examples:

- `ProtocolContract`: `chainId + address`
- `Pool`: `chainId + poolAddress`
- `Deposit`: `chainId + walletAddress + deposit identity`
- `Strategy`: `chainId + wrapperAddress` or `chainId + strategyContractAddress`
- `StrategyExposure`: `chainId + walletAddress + strategyId`
- `LedgerEvent`: `chainId + txHash + logIndex + eventType`
- `AssetMovement`: `chainId + ledgerEventId + movementIndex`
- `PricePoint`: `chainId + tokenAddress + timestamp + source + resolution`
- `RewardEvent`: `chainId + txHash + logIndex/movementIndex + rewardType`
- `GovernanceEvent`: `chainId + txHash + logIndex/eventType`
- `AttributionState`: `chainId + walletAddress + poolId + tokenAddress + sourceLedgerEventId`
- `AttributionSourceLot`: `chainId + walletAddress + tokenAddress + sourceType + sourceLedgerEventId`

Address-only keys are forbidden for protocol entities.

Token ID-only keys are forbidden for NFTs. Use:

```txt
chainId + contractAddress + tokenId
```

Transaction hash-only keys are forbidden. Use:

```txt
chainId + txHash
```


## 10.24 Identity rules

### Pool identity

A Pool is identified by:

- chain ID;
- pool address;
- token pair;
- stable/volatile flag where applicable;
- factory/router-derived discovery.

### Deposit identity

A manual Aerodrome Deposit is identified by:

- wallet address;
- pool ID;
- token ID where available;
- open transaction;
- direct lifecycle evidence.

Rules:

- `mint` creates a deposit.
- `increaseLiquidity(existing tokenId)` updates the same deposit.
- `stake` links the deposit to a gauge.
- `unstake` updates the same deposit.
- `decreaseLiquidity`, `collect`, `withdraw`, and `burn` update the same deposit where identity is established.

### Strategy identity

A Strategy is identified by:

- strategy type;
- protocol;
- wrapper/vault/strategy contract;
- official metadata;
- underlying pool relationship where known.

### StrategyExposure identity

A StrategyExposure is identified by:

- wallet address;
- strategy ID;
- share token or share balance lifecycle;
- deposit/withdraw/share mint/share burn evidence.

### Reward identity

A RewardEvent is identified by:

- wallet address;
- transaction hash;
- log index or movement index;
- reward token;
- reward type;
- source scope.

### Attribution identity

An AttributionState is identified by:

- wallet address;
- pool ID;
- token address;
- source ledger event.

An AttributionSourceLot is identified by:

- wallet address;
- token address;
- source type;
- source ledger event.

---

## 10.25 Metric decomposition requirements

The model must support:

- capital entered;
- capital withdrawn;
- realized PnL;
- unrealized PnL;
- estimated annualized return;
- asset price movement effect;
- reward/claim gains;
- realized rebalance effects;
- residual attributed value;
- idle wallet asset value;
- strategy share-level accounting;
- pool-level aggregation;
- deposit-level lifecycle analytics;
- strategy-level lifecycle analytics;
- governance reward analytics;
- full activity explainability.

---

## 10.26 Naming rules

User-facing UI naming:

- Use `Pools` for market-level aggregation.
- Use `Deposits` for manual/user-owned deposit lifecycle analytics.
- Use `Strategies` for automated strategy analytics.
- Use `Activity` for transaction-level ledger.
- Avoid using `Positions` as the primary user-facing term.

Internal/backend naming:

- `PositionInstance` may remain as a legacy/internal implementation concept only if needed.
- New implementation should prefer `Deposit` for manual exposure lifecycle.
- If `PositionInstance` is retained, it must be explicitly mapped to `Deposit` in the product layer and must not be exposed as a menu label.

---

## 10.27 Summary

The domain model supports The Cab’s current product architecture:

```txt
Portfolio
  ├── Pools
  │   ├── Manual Deposits
  │   ├── Automated Strategies
  │   └── Residual Attribution
  ├── Rewards
  ├── Governance
  ├── Activity
  └── Coverage / Confidence
```

The key modeling requirement is that **Pools, Deposits, and Strategies remain distinct but connected**:

- Pools aggregate market exposure.
- Deposits track direct/manual user exposure.
- Strategies track automated strategy exposure.
- Rewards and governance can be viewed independently while remaining linkable to pools, deposits, strategies, and activity.
- Ledger events and asset movements remain the source of truth.

# 11. Metrics & Financial Semantics

## 11.1 Base valuation

All primary analytics should be USD/USDC-centric.

Rules:

- Use USD as display unit.
- Treat USDC as the practical stable reference.
- Store event-time USD valuations for historical accuracy.
- Store current USD valuations for open exposure.
- Never mix nominal token amount returns with USD returns without labeling clearly.

## 11.2 Capital entered

Capital entered is external value deployed into an Aerodrome/Mellow/governance scope.

Examples:

- Tokens deposited into a manual LP position.
- Tokens deposited into a Mellow strategy.
- AERO locked into veAERO.
- Idle assets explicitly allocated into a tracked Aerodrome operation.

Do not count internal movement twice.

## 11.3 Capital withdrawn

Capital withdrawn is value leaving a tracked scope.

Examples:

- Withdraw from LP position to wallet.
- Withdraw from Mellow.
- Transfer residual assets away.
- Swap into unrelated assets after exiting a pool.
- Unlock/exit governance exposure when applicable.

## 11.4 Residual pool capital

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

### Residual over-consumption rule

If a swap, transfer, or redeployment uses more of a token than the amount currently attributed to one pool, the system must not assign the full movement to that pool.

Instead, attribution is consumed in this order:

1. The candidate pool residual attribution, up to its available amount.
2. Matching-token cash-ins.
3. Matching-token liquidation-derived inventory.
4. Other same-token residual attribution states, split pro rata.
5. Unknown wallet inventory only as a low-confidence fallback.

Example:

- Pool `WETH/cbBTC` has `0.1 cbBTC` residual attribution.
- Wallet also has `0.04 cbBTC` from a previous AERO -> cbBTC reward conversion.
- User swaps `0.14 cbBTC` into WETH.
- The first `0.1 cbBTC` is attributed as a `WETH/cbBTC` rebalance.
- The remaining `0.04 cbBTC` is attributed to liquidation-derived inventory, not to the pool residual.


## 11.5 Realized PnL

Realized PnL should reflect value made or lost when capital is closed, withdrawn, swapped, claimed, or otherwise crystallized.

Examples:

- Fees collected.
- Rewards claimed.
- Gains/losses from rebalance swaps.
- Difference between capital entered and capital withdrawn for closed exposure.

## 11.6 Unrealized PnL

Unrealized PnL reflects current market value change of open exposure.

Examples:

- Open LP position value change.
- Mellow share value change.
- Idle residual pool assets still attributed to a pool.
- veAERO lock value where supported.

## 11.7 Asset price effect

Asset price effect isolates gains/losses caused by market movement of held assets.

This should be separated from:

- Claim rewards.
- LP fees.
- Rebalance gains/losses.
- Fresh capital deposits.
- Withdrawals.

## 11.8 Rewards return

Rewards return includes realized claimed value from:

- LP fees.
- Gauge rewards.
- Mellow rewards.
- Voting fees.
- Bribes.
- Rebases where applicable.

Rewards should be shown separately from total PnL and also included in total return when appropriate.

## 11.9 Estimated annualized return

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

# 12. Application Sections

## 12.1 Landing

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

## 12.2 Overview

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

## 12.3 Pools

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
- If a swap amount is greater than the pool's residual amount, assign only the covered amount to that pool.
- Allocate the excess through the source-priority waterfall: cash-ins, liquidation-derived inventory, then pro-rata other pool residuals.
- In Pool detail, display only the portion of a swap attributed to that pool; do not show the full swap as a pool rebalance when part of it came from other wallet inventory.
- If the pool received only a partial attribution from a larger swap, the Rebalance timeline should indicate `partial swap attribution` and show the allocated amount.


### Automated strategy exposure in Pools

Pool detail must show Mellow exposure as automated strategy exposure, not as manual deposits.

For each automated strategy associated with the pool, show:

- strategy name;
- protocol: `Mellow`;
- current estimated value;
- capital deposited;
- capital withdrawn;
- rewards claimed;
- share balance where available;
- coverage status: `full`, `share_level`, `partial`, or `unknown`;
- link to Strategy detail.

Pools answer:

```txt
What total exposure did this wallet have to this market?
```

Strategies answer:

```txt
How did this automated strategy perform and what happened inside its lifecycle?
```

A pool-level chart may include strategy exposure in total attributed exposure, but visual breakdown must preserve:

- manual deposits;
- automated strategies;
- residual attribution.


### Acceptance criteria

- Pools are unavailable until analysis is ready.
- Each pool is a stable analytical unit.
- Manual and Mellow strategies are separated.
- Rebalance detection preserves economic continuity.
- Residual assets are tracked per pool, not globally per token.
- Pool charts do not show misleading zero-value drops during rebalance sequences.
- Confidence/coverage is visible when inference is partial.

---

## 12.4 Deposits

### Purpose

Deposits shows the lifecycle of individual manual/user-owned Aerodrome deposits and direct exposure instances.

It allows the user to inspect each position from opening through changes, claims, unstaking, withdrawal, and closure.

### Availability

Deposits is locked until historical analysis is ready.

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

#### Automated strategy exposure

Identified by Mellow wrapper/staking/share exposure.

Lifecycle events:

- `mellow_deposit`
- `mellow_stake`
- `mellow_claim`
- `mellow_unstake`
- `mellow_withdraw`
- `mellow_close`

Mellow strategy exposure belongs primarily in `Strategies` as `StrategyExposure`. It must not be modeled as user-owned manual Aerodrome NFT exposure unless the wallet actually owns the relevant NFT.

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


### Mellow exclusion rule

Deposits is primarily for direct/manual Aerodrome exposure.

Mellow deposits and withdrawals belong to `Strategies` as `StrategyExposure` lifecycle events.

Do not create a manual `Deposit` from a Mellow deposit unless the wallet actually owns the underlying Aerodrome NFT.

If useful, Deposits may show a cross-link to automated strategy exposure, but the canonical analysis surface for Mellow is `Strategies`.


### Acceptance criteria

- Manual positions are tied to token ID when available.
- Increase liquidity updates the same position.
- Mellow positions are isolated as strategy exposure instances.
- Lifecycle timeline is chronological and explainable.
- Position performance can be traced back to ledger events and asset movements.
- Ambiguous lifecycle events are marked rather than hidden.

---


## 12.5 Strategies

### Purpose

Strategies shows automated strategy lifecycle and accounting.

The initial focus is Mellow automated Aerodrome strategies.

Strategies answers:

- Which automated strategies has the wallet used?
- Which underlying Aerodrome pools are associated with each strategy?
- How much capital was deposited into the strategy?
- How many shares or strategy units were received?
- What withdrawals, claims, or rewards occurred?
- What is the current value and estimated return?
- What internal strategy activity is visible?
- What is the confidence/coverage level of the strategy accounting?

### Availability

Strategies is locked until historical analysis is ready.

### Core concept

An automated strategy is not the same as a manual deposit.

A strategy may sit on top of an Aerodrome pool and contribute to that pool's aggregate exposure, but it has its own accounting model.

A strategy may involve:

- wrapper contracts;
- vault contracts;
- root vault contracts;
- StakingRewards contracts;
- share balances;
- managed liquidity behavior;
- strategy-specific reward flows;
- indirect underlying pool exposure;
- internal rebalances;
- fee/share dilution;
- partial visibility into underlying operations.

### Strategy detail layout

Strategy Detail should contain:

```txt
Strategy Detail
├── Header
│   ├── Strategy name
│   ├── Protocol: Mellow
│   ├── Underlying Aerodrome pool
│   ├── lpWrapper
│   ├── StakingRewards
│   ├── Coverage status: full / share_level / partial / unknown
│
├── User Exposure
│   ├── Deposited value
│   ├── Withdrawn value
│   ├── Current estimated value
│   ├── Share balance
│   ├── Shares received
│   ├── Shares redeemed
│
├── Rewards
│   ├── Claimed rewards
│   ├── Reward token
│   ├── USD value at claim
│   ├── Source: StakingRewards
│
├── Lifecycle Timeline
│   ├── strategy_deposit
│   ├── strategy_share_mint
│   ├── strategy_stake
│   ├── strategy_claim
│   ├── strategy_unstake
│   ├── strategy_withdraw
│   ├── strategy_share_burn
│
├── Internal Strategy Activity
│   ├── strategy_internal_rebalance, if detectable
│   ├── strategy_fee_dilution, if detectable
│
└── Coverage / Limitations
    ├── share-level only
    ├── missing TVL
    ├── missing share price
    ├── incomplete internal strategy events
```

### Strategy identity

Mellow strategy identity should be based on:

- official Mellow strategy metadata;
- strategy name;
- underlying Aerodrome pool;
- `lpWrapper`;
- `StakingRewards`;
- wrapper address;
- vault/root vault address where available;
- strategy contract address where available;
- share token or wrapper share behavior.

Do not identify Mellow strategy exposure as a manual Aerodrome NFT deposit unless the wallet actually owns the relevant NFT.

### Required views

#### Strategies list

Display:

- Strategy name.
- Protocol: Mellow / future strategy provider.
- Underlying pool or pools.
- Current value.
- Capital deposited.
- Capital withdrawn.
- Share balance.
- Rewards claimed.
- Realized PnL.
- Unrealized PnL.
- Estimated annualized return.
- Coverage/confidence.

Filters:

- Active.
- Closed.
- Mellow.
- Underlying pool.
- Positive/negative return.
- Coverage status.
- Partial/share-level coverage.

#### Strategy detail

##### Header

Display:

- Strategy label.
- Protocol.
- Underlying pool.
- `lpWrapper`.
- `StakingRewards`.
- Wrapper/vault/staking contract references.
- Share balance.
- Current value.
- Total return.
- Coverage badge.

##### User exposure panel

Display:

- deposited value;
- withdrawn value;
- current estimated value;
- shares received;
- shares redeemed;
- current share balance;
- entry transactions;
- exit transactions;
- share-level coverage status.

##### Strategy lifecycle timeline

Show chronological events:

- strategy deposit;
- share mint/receive;
- stake if applicable;
- claim;
- unstake if applicable;
- withdrawal;
- share burn/redeem;
- close.

Each event should show:

- timestamp;
- transaction hash;
- event type;
- token/share movements;
- USD value;
- confidence;
- link to block explorer.

##### Rewards panel

Show rewards linked to the strategy.

Fields:

- reward token;
- amount;
- USD value at claim;
- source contract, usually `StakingRewards`;
- associated pool where known;
- transaction hash.

##### Internal strategy activity

Show only when confidently detectable:

- `strategy_internal_rebalance`;
- `strategy_fee_dilution`;
- visible vault/subvault movement;
- visible strategy/operator calls.

Rules:

- Mellow internal rebalances should not be treated as manual user rebalances.
- Mellow internal rebalances affect Strategy analytics, not Deposits.
- Internal strategy activity should appear in Activity only if The Cab can tie the call/event to known Mellow strategy contracts with sufficient confidence.

##### Underlying pool relationship

Show:

- associated Aerodrome pool;
- how the strategy maps to that pool;
- whether the mapping comes from official Mellow metadata, contract events, or inference;
- whether the strategy contributes to the pool aggregate.

##### Strategy accounting coverage

Show a visible coverage model:

- `full`: deposits, withdrawals, shares, rewards, and underlying valuation are reconstructable.
- `share_level`: user deposits, withdrawals, shares, and rewards are reliable, but underlying strategy internals are not fully reconstructed.
- `partial`: some deposits, withdrawals, rewards, prices, mappings, or share values are missing.
- `unknown`: strategy was detected but cannot be reliably analyzed.

### Relationship with Pools

Strategies should contribute to pool-level aggregates when the underlying pool is known.

In `Pools`, strategies appear as automated exposure rows under the relevant pool.

In `Strategies`, the same exposure is analyzed independently using strategy-specific accounting.

This means:

- Pool pages answer: “What total exposure did I have to this market?”
- Strategy pages answer: “How did this automated strategy perform and what happened inside its lifecycle?”

### Acceptance criteria

- Strategies is a first-class menu section.
- Mellow exposure is not collapsed into manual Deposits.
- Each strategy links to its underlying pool where known.
- Each relevant pool links back to associated automated strategies.
- Share-level accounting is clearly labeled when full underlying accounting is not available.
- Strategy metrics expose coverage/confidence.
- Mellow internal rebalances do not appear as manual deposit rebalances.
- Strategy rewards can be shown in Rewards without double counting.

---

## 12.6 Rewards

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


### Mellow strategy rewards

Mellow rewards should be linked to:

- `strategyId`;
- `strategyExposureId`;
- `poolId`, when the underlying pool is known;
- `StakingRewards` contract;
- reward token;
- claim transaction.

Rewards should distinguish sources:

```txt
Rewards by source
├── Manual deposits
├── Mellow strategies
└── Governance
```

Mellow strategy rewards may appear in:

- Rewards section;
- Strategy detail;
- Pool detail aggregate when the underlying pool is known.

They must only be counted once in portfolio totals.


### Acceptance criteria

- Claims are shown chronologically.
- Rewards are valued at claim time.
- Rewards can be grouped by pool, strategy, token, and reward type.
- Reward APR/APY/annualized return is explicitly labeled as estimated.
- Governance fees and bribes are included but distinguishable from LP rewards.
- Rewards do not get double counted in both pool and governance summaries.

---

## 12.6 Governance

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

## 12.7 Activity

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
- Strategy deposit.
- Strategy withdraw.
- Strategy stake.
- Strategy unstake.
- Strategy claim.
- Strategy share mint.
- Strategy share burn.
- Strategy internal rebalance.
- Strategy fee/share dilution.
- Unsupported.
- Malicious/spam.
- Ambiguous.


### Strategy activity classification

Activity must distinguish Mellow strategy activity from manual deposit activity.

Supported strategy-specific classifications:

- `strategy_deposit`
- `strategy_withdraw`
- `strategy_stake`
- `strategy_unstake`
- `strategy_claim`
- `strategy_share_mint`
- `strategy_share_burn`
- `strategy_internal_rebalance`
- `strategy_fee_dilution`

Rules:

- Mellow internal rebalances should not be treated as manual user rebalances.
- Mellow internal rebalances affect Strategy analytics, not Deposits.
- Mellow internal rebalances should only appear in Activity if The Cab can tie the call/event to known Mellow strategy contracts with sufficient confidence.
- Mellow strategy events must link to Strategy and StrategyExposure where possible.
- Mellow returned tokens should only open residual attribution after they move to the user wallet.


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
- Source allocation breakdown when the transaction consumed more token amount than one pool residual could cover.
- Amount attributed to candidate pool residual.
- Amount attributed to cash-ins.
- Amount attributed to liquidation-derived inventory.
- Amount attributed pro rata to other residual pools.
- Whether the event is a full-pool rebalance or partial swap attribution.

### Acceptance criteria

- Every major metric can be traced back to activity rows.
- Activity shows enriched labels after analysis.
- Raw/unsupported events are not silently hidden.
- Swaps classified as rebalance include explanation and linked events.
- Activity rows can be filtered by type, pool, strategy, token, date range, and confidence.

---

## 12.8 Settings

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

# 13. Branding

The Cab must follow the approved brand specification.

## 13.1 Brand positioning

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

## 13.2 Core concept

The Cab is a **control tower for on-chain portfolios**.

The visual system should communicate:

- Oversight.
- Signal clarity.
- Navigation.
- Capital flow monitoring.
- Technical confidence.
- Operational awareness.

The UI should feel like a **premium control surface**, not a casual crypto dashboard.

## 13.3 Visual direction

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

## 13.4 Color palette

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

## 13.5 Typography

Use:

- Orbitron for logo, hero titles, main page titles, major dashboard section anchors.
- Inter for navigation, cards, body copy, labels, tables, controls.
- IBM Plex Mono for wallet snippets, tx hashes, timestamps, block numbers, diagnostic metadata.

## 13.6 Brand copy tone

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

# 14. Implementation Priorities

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
- TanStack Query provider and typed query hook pattern.
- Zustand store pattern for shared UI state.
- `.container.tsx` / `.component.tsx` separation for all product sections.

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

## Phase 4 — Deposits + Strategies + Rewards

Deliver:

- Deposit lifecycle model.
- Deposit list/detail.
- Strategy lifecycle model.
- Strategy list/detail.
- Mellow share-level accounting.
- Mellow internal strategy activity classification.
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

# 15. Acceptance Criteria Summary

- i18n is implemented with i18next/react-i18next.
- English is the default/base language and Spanish is the secondary supported language.
- Browser locale detection selects Spanish for `es*` locales and English for `en*` or unsupported locales.
- No user-facing product copy is hardcoded in components, containers, charts, sidebar labels, empty states, errors, or validation messages.
- English and Spanish translation resources share the same key structure.
- Numbers, dates, currency, percentages, and token amounts use locale-aware formatting helpers.

- Product v1 remains Base mainnet only, but the domain and persistence model are chain-aware from day one.
- Address-based protocol entities are keyed by `chainId + address`, never address alone.
- Provider clients, API routes, query keys, analysis jobs, and database unique constraints include or derive `chainId`.

The implementation is acceptable when:

- Disconnected users see a branded landing page and can connect wallet.
- Wallet connection uses WalletConnect + wagmi.
- MVP supports Base mainnet only.
- Connected users immediately see Overview without waiting for full historical analysis.
- Connected menu uses `Overview`, `Pools`, `Deposits`, `Strategies`, `Rewards`, `Governance`, `Activity`, and `Settings`.
- Strategies is a first-class section for automated strategy lifecycle/accounting.
- Mellow strategy exposure is shown in Pools as Automated Strategy exposure, not as manual Deposits.
- Strategy Detail displays user exposure, share balance, rewards, lifecycle timeline, internal strategy activity, and coverage limitations.
- Mellow internal rebalances are classified as strategy-level activity, not manual rebalances.
- Mellow rewards are linked to Strategy/StrategyExposure/StakingRewards and are not double counted.

- Historical analysis runs asynchronously through Trigger.dev and does not block the UI.
- Sidebar sections unlock based on analysis status.
- Moralis is used for wallet/portfolio/history data.
- Alchemy is used for pricing and historical pricing.
- CoinGecko or unapproved providers are not introduced.
- The app has a Tamagui-based internal Design System using The Cab brand tokens and Google Fonts.
- Lucide React is used only through DS icon wrappers.
- Recharts is used only through DS chart wrappers.
- TanStack Query is used for server state, API cache, polling, mutations, and stale data handling.
- Zustand is used only for lightweight shared client UI state.
- React local hooks are limited to ephemeral component-local state.
- Product sections follow `.container.tsx` / `.component.tsx` separation.
- `.container` files own state orchestration and pass props to `.component` files.
- `.component` files receive props only and do not call TanStack Query, Zustand, wagmi, fetch, or backend clients.
- Product screens do not import third-party UI libraries directly.
- Swap attribution handles over-consumption by decomposing swaps across residual balances, cash-ins, liquidation-derived inventory, and other residual pools.
- Pool charts and Activity rows show partial swap attribution when a transaction is larger than one pool's residual amount.
- Aerodrome discovery does not assume all activity passes through the Router.
- Protocol activity is discovered across Router, Pool, Gauge, Reward/Bribe/Fee, veAERO/Voter, and Mellow surfaces.
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

# 16. External Source References

Use official sources of truth where possible:

- Moralis Wallet API documentation for wallet balances, history, transfers, NFTs, and decoded activity.
- Alchemy Prices API documentation for current and historical token prices.
- Trigger.dev Next.js and Vercel integration documentation for background jobs.
- Aerodrome official contract/address documentation and verified router contract source for Router/Factory/AERO discovery.
- Mellow official Aerodrome CL strategy contract address documentation.

Do not maintain custom protocol address lists when official discovery or official documentation is available.
Do not add unapproved providers for pricing or wallet analytics.

---

# 17. Copilot Implementation Note

When implementing this spec, prioritize:

1. Chain-aware domain and provider boundaries despite Product v1 being Base-only.
2. Internationalization resources and no hardcoded product copy.
2. Fast connected Overview.
2. Clear async analysis status.
3. Correct DS boundaries and no direct third-party UI imports in product screens.
4. Correct state-management boundaries using TanStack Query, Zustand, local hooks, and wallet wrappers.
5. Strict `.container.tsx` / `.component.tsx` separation.
6. Ledger/event model correctness.
7. Residual attribution model.
8. Source-priority waterfall for swaps that exceed a pool's residual balance.
9. Pool-level continuity and rebalance attribution.
9. Strategy separation between manual and Mellow.
10. Readable, trusted dashboard UI.
11. Strict brand consistency.
12. No unapproved third-party provider drift.

If a metric cannot be computed confidently, show partial coverage instead of inventing precision.
