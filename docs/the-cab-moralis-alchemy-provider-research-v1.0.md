# The Cab — Moralis & Alchemy Provider Research v1.0

## Document role

This research document defines how **Moralis** and **Alchemy** should be used in The Cab.

It complements:

- The Cab Product & Technical Specification
- The Cab Feature Feasibility & Implementation Architecture
- Connected Wallet Overview spec artifacts
- Future `004-wallet-asset-trust-filtering`

The goal is to prevent provider drift, especially around wallet history, token balances, asset trust / spam filtering, pricing, historical valuation, RPC/event reconstruction, DeFi positions, and protocol-specific analytics.

---

# 1. Executive summary

The Cab should use Moralis and Alchemy as **complementary providers**, not interchangeable sources.

```txt
Moralis
  -> wallet-centric discovery
  -> balances
  -> wallet history
  -> decoded transaction summaries
  -> token metadata and spam/trust signals
  -> DeFi position hints
  -> fast recent Overview

Alchemy
  -> canonical pricing layer
  -> current token prices
  -> historical token prices
  -> RPC access
  -> logs, receipts, eth_call
  -> transfer fallback
  -> contract/event reconstruction support
  -> NFT spam signals where needed
```

The implementation should not be:

```txt
Moralis response -> UI
Alchemy response -> UI
```

It should be:

```txt
Moralis + Alchemy + RPC + official protocol metadata
  -> RawProviderRecord
  -> normalized domain model
  -> PricePoint / PortfolioSnapshot / CoverageReport
  -> typed internal API
  -> UI view models
```

---

# 2. Provider responsibility boundary

## 2.1 Moralis responsibility

Moralis should be treated as the **fast wallet intelligence and discovery provider**.

Use Moralis for:

- current wallet token balances;
- wallet history;
- decoded transaction summaries;
- recent activity preview;
- candidate Aerodrome/Mellow transaction discovery;
- token metadata enrichment;
- spam / low-trust token flags where available;
- verified contract signals where available;
- DeFi position hints;
- NFT balances and NFT spam filtering if NFTs become part of the product surface.

Moralis should **not** be treated as:

- the canonical historical price source;
- the canonical source for protocol lifecycle semantics;
- a complete replacement for Aerodrome/Mellow event decoding;
- the final authority for deposit lifecycle, strategy accounting, residual attribution, governance reward mapping, or PnL.

## 2.2 Alchemy responsibility

Alchemy should be treated as the **pricing and RPC reconstruction provider**.

Use Alchemy for:

- current token prices;
- historical token prices;
- event-time valuation;
- transfer fallback and verification;
- RPC logs;
- transaction receipts;
- contract reads;
- block timestamps;
- ABI-based decoding support;
- NFT spam signals where NFT spam filtering is needed.

Alchemy should **not** be treated as:

- the canonical wallet-history source when Moralis wallet history is available and sufficient;
- a direct ERC-20 spam detector for all wallet assets;
- a complete protocol analytics provider for Aerodrome/Mellow without custom reconstruction.

---

# 3. Moralis research

## 3.1 What Moralis is good at

Moralis provides a wallet-oriented EVM Data API across many EVM chains. Its Wallet API is designed to fetch balances, transfers, DeFi positions, PnL, NFTs, and decoded wallet activity across chains.

For The Cab, Moralis shines when we need to answer:

```txt
What does this wallet currently hold?
What activity happened recently?
Which contracts did the wallet interact with?
Which token balances should be displayed immediately?
Which assets may be spam or low-confidence?
Which DeFi positions can be discovered quickly as hints?
```

## 3.2 Relevant Moralis APIs

### 3.2.1 Token Balances

Official purpose:

- Fetch ERC-20 and native token balances for a wallet.
- Returns token balances, USD prices, on-chain/off-chain metadata, logos, spam status, and filtering options.

Endpoint shape:

```http
GET https://deep-index.moralis.io/api/v2.2/wallets/{address}/tokens?chain={chain}
```

or multi-chain form depending on SDK/API version:

```http
GET https://api.moralis.com/v1/wallets/{address}/tokens?chains={chain}
```

Use in The Cab:

- Overview asset table;
- current wallet inventory;
- idle assets;
- default balance source for recent view;
- token trust classifier input;
- spam/low-confidence filtering input;
- current snapshot seed;
- sanity check after historical analysis.

Important returned fields/signals:

```txt
token_address
symbol
name
decimals
balance
balance_formatted
usd_price / usd_value where available
logo / thumbnail
possible_spam
verified_contract where available
```

The Cab should persist:

```txt
RawProviderRecord
PortfolioSnapshot
CoverageReport
TokenTrustClassification or enough provider metadata to recompute it
```

Coverage rules:

- If Moralis returns balance but Alchemy cannot price it, display the asset but mark valuation partial.
- If `possible_spam` is true, hide from default asset table and default portfolio totals.
- If metadata is incomplete, degrade trust status rather than dropping the asset silently.

### 3.2.2 Wallet History

Official purpose:

- Get complete decoded transaction history for a wallet.
- Transactions are parsed, decoded, categorized, and summarized into human-readable records.

Endpoint shape:

```http
GET https://deep-index.moralis.io/api/v2.2/wallets/{address}/history?chain={chain}
```

Use in The Cab:

- recent Activity preview;
- candidate activity discovery for background analysis;
- candidate Aerodrome/Mellow interactions;
- initial transaction cursor for historical analysis;
- provider-level decoded summaries before The Cab applies its own classification.

The Cab should persist:

```txt
RawProviderRecord
candidate LedgerEvent records only after internal classification
CoverageReport when decoded history is partial or ambiguous
```

Important rule:

Moralis decoded labels are useful, but they are **not final domain semantics**.

For example:

```txt
Moralis may show a swap or contract interaction.
The Cab must decide whether it is:
  - rebalance
  - liquidation
  - cash-in
  - cash-out
  - claim
  - strategy movement
  - unrelated swap
```

### 3.2.3 DeFi Positions

Official purpose:

- Return DeFi positions for a wallet across supported chains in a unified schema.
- Detailed protocol-specific positions can also be requested for supported protocols.

Endpoint shapes:

```http
GET https://api.moralis.com/v1/wallets/{walletAddress}/defi/positions
GET https://api.moralis.com/v1/wallets/{walletAddress}/defi/{protocol}/positions
```

Use in The Cab:

- recent Overview deployed-value approximation;
- hints for protocol activity;
- sanity check for open positions;
- discovery assist for protocols supported by Moralis;
- potential current exposure hints for manual deposits or strategies.

Do not use as:

- final source of deposit lifecycle;
- final source of Mellow strategy share accounting;
- final source of pool-level attribution;
- final source of realized/unrealized return.

Coverage rule:

If Moralis DeFi position data exists, mark it as:

```txt
source: recent_provider_data
coverage: recent / partial
```

unless it has been reconciled against The Cab’s normalized protocol model.

### 3.2.4 Token Metadata

Official purpose:

- Retrieve ERC-20 metadata such as name, symbol, decimals, logo, total supply, categories, spam status, and related off-chain enrichment.

Endpoint shape:

```http
GET https://deep-index.moralis.io/api/v2.2/erc20/metadata?chain={chain}&addresses[]={tokenAddress}
```

Use in The Cab:

- token display metadata;
- trust classifier;
- logo fallback;
- categories / known asset hints;
- spam status;
- verified contract signal where available.

Trust usage:

```txt
possible_spam -> possible_spam
verified_contract -> verified
missing metadata -> low_confidence or unknown
```

### 3.2.5 Verified Contracts

Official purpose:

- Provide trust signals based on trusted third-party verification sources, exposed directly in API responses.

Use in The Cab:

- raise trust confidence for known/verified ERC-20 assets;
- reduce false positives from generic low-metadata heuristics;
- support `verified` trust status;
- improve token search / token metadata interpretation.

Important caveat:

A verified contract signal improves confidence, but it should not automatically imply that an asset is economically relevant to The Cab’s analytics. It may still be unrelated to Aerodrome.

### 3.2.6 Spam Filtering

Official purpose:

- Provide spam filtering and spam status signals for tokens and NFTs.

Use in The Cab:

- hide spam assets by default;
- exclude spam assets from confident portfolio totals;
- surface hidden/suspicious asset counts;
- preserve raw records for auditability;
- expose reason codes such as `moralisPossibleSpam`.

Suggested behavior:

```txt
possible_spam = true
  -> trustStatus: possible_spam
  -> isHiddenByDefault: true
  -> exclude from default totals
  -> show only in hidden/suspicious assets UI
```

---

# 4. Alchemy research

## 4.1 What Alchemy is good at

Alchemy should be The Cab’s source for:

```txt
What is this token worth now?
What was this token worth at an event timestamp?
What happened in this transaction receipt?
What logs did this contract emit?
What did a contract read return at a given chain/block?
Can we verify a token transfer or protocol event independently?
```

Alchemy is particularly strong as a combined:

- Prices API provider;
- RPC provider;
- logs/receipts provider;
- transfer-history fallback;
- NFT spam signal provider.

## 4.2 Relevant Alchemy APIs

### 4.2.1 Current Token Prices By Address

Official purpose:

- Fetch current prices for multiple tokens using network and address pairs.

Endpoint shape:

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/by-address
```

Use in The Cab:

- canonical current token prices;
- Overview current portfolio valuation;
- current asset table values;
- current pool/deposit/strategy/residual valuation;
- pricing confidence for token trust;
- PortfolioSnapshot valuation.

Request concept:

```json
{
  "addresses": [
    {
      "network": "base-mainnet",
      "address": "0x..."
    }
  ]
}
```

Persist into:

```txt
PricePoint
```

Identity:

```txt
chainId + tokenAddress + timestamp + source + resolution
```

Coverage rules:

- Address-based pricing is high confidence.
- If Alchemy returns an error or no price, do not fabricate USD value.
- Missing price should produce `missingPrices` or equivalent coverage reason code.
- Missing price is not proof of spam; it is valuation uncertainty.

### 4.2.2 Historical Token Prices

Official purpose:

- Provide historical price data for a token over a time range.
- Token can be identified by symbol or network + contract address.

Endpoint shape:

```http
POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/historical
```

Use in The Cab:

- event-time valuation;
- deposit capital-in valuation;
- withdraw valuation;
- reward claim valuation;
- swap/rebalance valuation;
- historical portfolio chart;
- PerformanceSnapshot generation;
- realized/unrealized return calculations.

The Cab rule:

```txt
Prefer network + contract address.
Use symbol only as fallback with lower confidence.
```

Persist into:

```txt
PricePoint
```

Coverage rules:

- Missing historical price degrades event confidence.
- If a reward has no historical price, show token amount and mark USD value partial/unknown.
- Historical chart points should declare coverage status if prices are missing.

### 4.2.3 Asset Transfers

Official purpose:

- Retrieve asset transfers using the `alchemy_getAssetTransfers` RPC method.

Endpoint shape:

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: alchemy_getAssetTransfers
```

Use in The Cab:

- transfer fallback when Moralis history is incomplete;
- ERC-20 movement verification;
- NFT movement verification;
- token transfer discovery for ambiguous transactions;
- cross-checking asset movements during analysis.

Persist into:

```txt
RawProviderRecord
AssetMovement candidates
CoverageReport if conflicting with Moralis
```

Caveat:

Asset transfers are useful, but not enough for protocol semantics. The Cab still needs ABI/event decoding.

### 4.2.4 RPC Logs

Official purpose:

- Standard Ethereum JSON-RPC `eth_getLogs`.

Endpoint shape:

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: eth_getLogs
```

Use in The Cab:

- Aerodrome pool events;
- position manager events;
- gauge events;
- voting escrow / voter events;
- bribe/fee/rebase events;
- Mellow wrapper events;
- StakingRewards events;
- ERC-20 and ERC-721 transfer logs.

Persist into:

```txt
RawProviderRecord
LedgerEvent
AssetMovement
RewardEvent
GovernanceEvent
CoverageReport
```

Important:

This is required for all high-confidence historical reconstruction.

### 4.2.5 Contract Reads

Official purpose:

- Standard Ethereum JSON-RPC `eth_call`.

Endpoint shape:

```http
POST https://{network}.g.alchemy.com/v2/{apiKey}
method: eth_call
```

Use in The Cab:

- Aerodrome Router `defaultFactory()`;
- Aerodrome Router `poolFor(...)`;
- gauge-to-pool mapping reads;
- token decimals/symbol fallback;
- Mellow wrapper/share balance reads;
- Mellow total supply / share supply reads;
- current strategy values where available;
- protocol metadata sync.

Persist into:

```txt
ProtocolContract
Pool
Strategy
StrategyExposure
CoverageReport
RawProviderRecord
```

### 4.2.6 NFT Spam Endpoints

Official purpose:

- `getSpamContracts` returns spam contracts marked by Alchemy.
- `isSpamContract` checks whether a specific NFT contract is marked as spam.
- Alchemy documents NFT spam functionality across several mainnet chains including Base.

Endpoint examples:

```http
GET https://{network}.g.alchemy.com/nft/v3/{apiKey}/getSpamContracts
GET https://{network}.g.alchemy.com/nft/v3/{apiKey}/isSpamContract?contractAddress={address}
```

Use in The Cab:

- only if NFTs become part of the wallet asset surface;
- possible future filter for position NFTs or unrelated NFTs;
- low-priority for Product v1 if Overview focuses on ERC-20 and DeFi positions.

Caveat:

Alchemy NFT spam endpoints are not a replacement for ERC-20 spam classification.

---

# 5. Where each provider shines

## 5.1 Moralis strengths

| Use case | Why Moralis |
|---|---|
| Fast wallet overview | Direct wallet balances and history |
| Current asset table | Token balances with metadata and spam signals |
| Recent activity preview | Decoded wallet history |
| Candidate protocol discovery | Wallet history shows contract interactions |
| DeFi exposure hints | Unified DeFi position endpoints |
| Token trust inputs | `possible_spam`, metadata, verified signals |
| UX enrichment | logos, names, symbols, categories |
| NFT wallet data | NFT ownership/metadata/spam filters |

## 5.2 Moralis weaknesses / limits

| Use case | Why not enough |
|---|---|
| Deposit lifecycle | Needs protocol-specific decoding |
| Mint vs increase liquidity distinction | Needs ABI/function/log context |
| Residual attribution | Requires custom balance and movement model |
| Mellow share accounting | Needs wrapper/staking contract reads/logs |
| Governance reward mapping | Needs voter/bribe/fee events |
| Historical valuation source of truth | Alchemy is the chosen pricing layer |
| Final PnL | Requires normalized domain model |

## 5.3 Alchemy strengths

| Use case | Why Alchemy |
|---|---|
| Current pricing | Prices API by address |
| Historical pricing | Prices API historical endpoint |
| Event-time valuation | Timestamp/block-based valuation |
| RPC logs | `eth_getLogs` at scale |
| Contract reads | `eth_call` for protocol metadata |
| Receipts and transfers | Verification and fallback |
| Protocol reconstruction | Raw chain access |
| NFT spam signals | NFT spam endpoints where needed |

## 5.4 Alchemy weaknesses / limits

| Use case | Why not enough |
|---|---|
| Complete wallet UX | Raw transfers/logs need app-level aggregation |
| Fast decoded wallet overview | Moralis wallet history is better for UX |
| ERC-20 spam classification | Pricing absence is not spam proof |
| DeFi position UX | Requires protocol-specific reconstruction |
| Human-readable activity labels | Needs custom classification |

---

# 6. Feature-by-feature provider usage

## 6.1 Landing

Provider usage:

```txt
None.
```

Implementation:

- Static UI.
- i18n resources.
- Brand assets.
- Wallet connection CTA.

## 6.2 Wallet connection

Provider usage:

```txt
WalletConnect + wagmi only.
```

Moralis:

```txt
Not used for connection.
```

Alchemy:

```txt
Not used for connection, except RPC may be used indirectly by wallet/wagmi config.
```

Implementation:

- Validate connected chain.
- Product v1: Base mainnet.
- Pass `walletAddress + chainId` to all connected feature queries.

## 6.3 Overview — Recent View

Provider usage:

```txt
Moralis primary for balances/history.
Alchemy primary for prices.
```

Moralis:

- wallet token balances;
- token metadata;
- spam/trust signals;
- wallet history;
- DeFi position hints where available.

Alchemy:

- current prices by address;
- historical prices for 24h/7d/30d chart where feasible;
- optional transfer fallback.

RPC:

- optional for current Overview;
- not required for first recent view.

Use in UI:

- Summary;
- top metrics;
- current asset table;
- current distribution;
- recent activity preview;
- analysis prompt;
- coverage badges.

Coverage:

```txt
Recent view = useful but provisional.
```

## 6.4 Token Trust / Asset Filtering

Provider usage:

```txt
Moralis primary trust signal.
Alchemy price confidence as valuation signal.
```

Moralis:

- `possible_spam`;
- token metadata;
- verified contract signal;
- logos/categories;
- NFT spam flags if relevant.

Alchemy:

- current price availability;
- historical price availability;
- NFT spam endpoints if NFTs are included.

RPC:

- optional for token metadata fallback;
- optional for known protocol asset confirmation.

Classifier inputs:

```txt
Moralis possible_spam
Moralis verified_contract
Moralis metadata completeness
Alchemy price availability
Known protocol asset list/discovery
Dust value
User visibility preference
```

Default behavior:

```txt
possible_spam / blocked -> hide by default
low_confidence dust -> hide by default
trusted / verified / known_protocol / priced -> show by default
```

Portfolio totals:

```txt
Exclude hidden spam/blocked assets from confident totals.
Do not fabricate USD values for missing-price assets.
```

## 6.5 Pools

Provider usage:

```txt
Moralis discovery only.
Alchemy/RPC required for reconstruction.
```

Moralis:

- candidate transactions;
- token transfers;
- current balances;
- DeFi hints.

Alchemy:

- current and historical prices;
- RPC logs;
- contract reads;
- transfers fallback.

RPC required:

- Router `defaultFactory()`;
- Router `poolFor(...)`;
- pool events;
- position manager events;
- gauge events;
- token transfer logs.

Implementation:

```txt
Moralis discovers candidate wallet activity.
Alchemy/RPC reconstructs lifecycle.
Alchemy prices value events.
```

## 6.6 Deposits

Provider usage:

```txt
Moralis candidate discovery.
Alchemy/RPC required for lifecycle.
```

Moralis:

- candidate mint/increase/decrease/collect/stake transactions;
- NFT transfers where present;
- wallet history.

Alchemy:

- historical prices;
- receipts/logs;
- position manager logs;
- transfer fallback.

RPC required:

- position manager event logs;
- NFT tokenId extraction;
- gauge stake/unstake events;
- function selector / calldata decode.

Implementation:

```txt
Moralis tells us where to look.
RPC tells us what actually happened.
Alchemy prices tell us what it was worth.
```

## 6.7 Strategies / Mellow

Provider usage:

```txt
Moralis discovery only.
Alchemy/RPC required.
Official Mellow metadata required.
```

Moralis:

- candidate wallet interactions;
- token transfers;
- decoded transaction history;
- current wallet balances.

Alchemy:

- historical prices;
- contract reads;
- wrapper/staking logs;
- share balance reads;
- transfer fallback.

RPC required:

- lpWrapper events;
- StakingRewards events;
- share token transfer logs;
- total supply / balance reads;
- reward claim events.

Official metadata:

- Mellow strategy contract list;
- lpWrapper;
- StakingRewards;
- underlying pool relationship.

Coverage:

```txt
Default to share-level when user exposure is reliable but internal strategy mechanics are only partially reconstructed.
```

## 6.8 Rewards

Provider usage:

```txt
Moralis discovery and candidate claims.
Alchemy pricing and logs for attribution.
```

Moralis:

- claim-like transactions;
- token transfers to wallet;
- decoded history.

Alchemy:

- historical prices at claim time;
- logs;
- transfer fallback.

RPC required:

- gauge reward events;
- fee collect events;
- Mellow StakingRewards claims;
- bribe/voting fee/rebase events.

Important:

```txt
Claim value is fixed at claim time.
Later swaps are separate events.
Avoid double-counting across Pools, Strategies, Governance, and Rewards.
```

## 6.9 Governance

Provider usage:

```txt
Moralis candidate discovery.
Alchemy/RPC required.
```

Moralis:

- AERO movements;
- candidate lock/vote/claim transactions;
- decoded wallet history.

Alchemy:

- historical prices;
- logs;
- contract reads.

RPC required:

- VotingEscrow / veAERO;
- Voter;
- bribe contracts;
- fee distributor contracts;
- managed rewards / relay contracts where applicable.

Implementation:

```txt
Moralis locates candidate txs.
RPC decodes governance semantics.
Alchemy prices governance rewards.
```

## 6.10 Activity

Provider usage:

```txt
Moralis raw/recent activity.
Alchemy/RPC enriched activity.
```

Moralis:

- recent decoded wallet history;
- raw activity preview;
- candidate events.

Alchemy:

- receipts;
- logs;
- transfers;
- historical prices;
- contract reads.

RPC required for:

- enriched classification;
- multi-event transactions;
- rebalance vs liquidation;
- strategy internal activity;
- governance mapping.

Display rule:

```txt
Before analysis:
  provisional labels from recent provider data.

After analysis:
  normalized LedgerEvents and AssetMovements.
```

## 6.11 Settings

Provider usage:

```txt
Mostly internal DB.
```

Moralis:

- optional provider diagnostics.

Alchemy:

- optional provider diagnostics.

Implementation:

- analysis status;
- freshness metadata;
- language preference if added;
- hidden asset preferences if token trust feature persists overrides;
- provider health display.

## 6.12 Background Analysis Job

Provider usage:

```txt
Moralis seed data.
Alchemy/RPC reconstruction.
Alchemy prices valuation.
Official protocol metadata for source of truth.
```

Flow:

```txt
1. Validate walletAddress + chainId
2. Create AnalysisRun
3. Fetch Moralis wallet history
4. Fetch Moralis token balances
5. Fetch Moralis DeFi positions as hints
6. Fetch Alchemy transfers if needed
7. Sync official Aerodrome/Mellow metadata
8. Read Aerodrome Router defaultFactory()
9. Fetch RPC logs for relevant contracts
10. Decode logs and transactions
11. Build LedgerEvents and AssetMovements
12. Enrich event values with Alchemy historical prices
13. Build Pools, Deposits, Strategies, Rewards, Governance
14. Build residual attribution states
15. Compute PortfolioSnapshot and PerformanceSnapshot
16. Write CoverageReports
17. Mark AnalysisRun ready/failed
```

---

# 7. Recommended internal provider modules

```txt
src/server/providers/moralis/
  moralisClient.ts
  getWalletTokens.ts
  getWalletHistory.ts
  getWalletDefiPositions.ts
  getWalletDefiProtocolPositions.ts
  getTokenMetadata.ts
  getNftBalances.ts
  normalizeMoralisErrors.ts

src/server/providers/alchemy/
  alchemyClient.ts
  getCurrentTokenPrices.ts
  getHistoricalTokenPrices.ts
  getAssetTransfers.ts
  getLogs.ts
  getTransactionReceipt.ts
  contractRead.ts
  getBlockTimestamp.ts
  getSpamContracts.ts
  isSpamContract.ts
  normalizeAlchemyErrors.ts

src/server/providers/shared/
  provider.types.ts
  providerErrors.ts
  rateLimit.ts
```

Rules:

- Provider modules return provider-normalized server objects.
- Feature APIs never expose raw provider payloads.
- Browser code never imports provider modules.
- Every function accepts `chainId`.
- Every provider error is normalized before returning to routes.

---

# 8. Suggested normalized provider types

## 8.1 Moralis wallet token

```ts
export type MoralisWalletTokenBalance = {
  chainId: number;
  tokenAddress: string | null;
  symbol: string;
  name: string | null;
  decimals: number | null;
  balanceRaw: string;
  balanceFormatted: string;
  moralisUsdPrice: number | null;
  moralisUsdValue: number | null;
  logoUrl: string | null;
  possibleSpam: boolean | null;
  verifiedContract: boolean | null;
  rawProviderRecordId: string;
};
```

## 8.2 Alchemy token price

```ts
export type AlchemyTokenPrice = {
  chainId: number;
  tokenAddress: string;
  network: string;
  priceUsd: number | null;
  priceSource: "alchemy";
  confidence: "high" | "unknown";
  errorCode?: string;
  fetchedAt: string;
};
```

## 8.3 Token trust classification

```ts
export type TokenTrustStatus =
  | "trusted"
  | "verified"
  | "known_protocol"
  | "priced"
  | "low_confidence"
  | "possible_spam"
  | "blocked"
  | "unknown";

export type TokenTrustReasonCode =
  | "moralisPossibleSpam"
  | "moralisVerifiedContract"
  | "alchemyMissingPrice"
  | "missingLogo"
  | "missingMetadata"
  | "suspiciousSymbol"
  | "zeroOrDustValue"
  | "unrecognizedContract"
  | "knownAerodromeToken"
  | "knownProtocolContract"
  | "hasReliablePrice"
  | "userHidden"
  | "userAllowed";

export type TokenTrustClassification = {
  trustStatus: TokenTrustStatus;
  trustReasonCodes: TokenTrustReasonCode[];
  isHiddenByDefault: boolean;
};
```

---

# 9. Provider selection matrix by feature

| Feature | Moralis | Alchemy Prices | Alchemy RPC / Logs | Official Protocol Metadata | DB normalized model |
|---|---|---|---|---|---|
| Landing | No | No | No | No | No |
| Wallet Connection | No | No | Optional RPC indirectly | No | WalletContext |
| Overview Recent | Primary | Primary | Optional | Optional for known assets | PortfolioSnapshot, CoverageReport |
| Token Trust | Primary | Valuation confidence | Optional | Known protocol assets | TokenTrustClassification |
| Pools | Discovery | Valuation | Required | Required | Pool, PerformanceSnapshot |
| Deposits | Discovery | Valuation | Required | Required | Deposit, LedgerEvent |
| Strategies | Discovery | Valuation | Required | Required | Strategy, StrategyExposure |
| Rewards | Discovery | Valuation | Required | Required | RewardEvent |
| Governance | Discovery | Valuation | Required | Required | GovernanceEvent |
| Activity Recent | Primary | Optional | Optional | Optional | Provisional Activity |
| Activity Enriched | Discovery | Valuation | Required | Required | LedgerEvent, AssetMovement |
| Settings | Diagnostics optional | Diagnostics optional | Diagnostics optional | No | WalletContext, preferences |
| Background Analysis | Seed/candidates | Valuation | Required | Required | Full domain model |

---

# 10. Provider-specific risks

## 10.1 Moralis risks

| Risk | Mitigation |
|---|---|
| Decoded wallet history is too generic | Treat as candidate data, not final classification |
| DeFi positions incomplete for Aerodrome/Mellow | Use as hints only |
| Moralis USD values conflict with Alchemy | Use Alchemy as valuation source of truth |
| Spam signals may have false positives/negatives | Expose as confidence, not guarantee |
| Multi-chain endpoint shape may differ by API version | Wrap in internal provider modules |
| Provider returns many spam/dust tokens | TokenTrustClassifier and hidden assets UI |

## 10.2 Alchemy risks

| Risk | Mitigation |
|---|---|
| Missing price for long-tail token | Null value + coverage degradation |
| Historical price gaps | PricePoint confidence + CoverageReport |
| RPC logs require careful range batching | Background job batching and checkpoints |
| Rate limits on logs/price calls | Queue, cache, persist PricePoint |
| NFT spam endpoints are not ERC-20 spam solution | Use only for NFTs |
| Symbol price fallback can be ambiguous | Prefer address-based prices |

---

# 11. Implementation recommendations

1. Use Moralis first for user-facing speed.
2. Use Alchemy/RPC for correctness.
3. Persist raw data before normalization.
4. Keep pricing single-sourced through Alchemy Prices API.
5. Build an internal `TokenTrustClassifier`.
6. Keep UI coverage-aware.
7. Keep all provider access server-side.
8. Keep all identities and provider calls chain-scoped.

---

# 12. Concrete feature implementation recipes

## 12.1 Overview recent API recipe

```txt
GET /api/wallet/overview?walletAddress=...&chainId=8453&range=7d

1. Validate walletAddress and chainId.
2. Fetch Moralis token balances.
3. Fetch Moralis wallet history.
4. Extract token addresses.
5. Fetch Alchemy current prices by address.
6. Classify token trust.
7. Build visible and hidden asset rows.
8. Build current metrics.
9. Build distribution from visible priced assets.
10. Build recent activity preview from Moralis history.
11. Persist RawProviderRecord, PricePoint, PortfolioSnapshot, CoverageReport.
12. Return typed OverviewResponse with block provenance.
```

## 12.2 Token trust recipe

```txt
Input:
  Moralis token balance + metadata
  Alchemy price result
  known protocol asset lookup
  user preference if available

Output:
  trustStatus
  trustReasonCodes
  isHiddenByDefault

Rules:
  possible_spam -> possible_spam, hidden
  known_protocol -> known_protocol, visible
  verified_contract -> verified, visible
  priced -> priced, visible
  missing price + dust + missing metadata -> low_confidence, hidden
  unknown -> unknown, visible or grouped by policy
```

## 12.3 Historical analysis recipe

```txt
1. Moralis wallet history seeds candidate tx hashes.
2. Alchemy fetches receipts/logs for candidate txs.
3. Alchemy/RPC fetches protocol logs over relevant ranges.
4. Contract reads sync protocol metadata.
5. Events are decoded with ABI registry.
6. Asset movements are built from transfers/logs.
7. Alchemy historical prices value each movement.
8. Domain builders create normalized entities.
9. Coverage reports record missing/ambiguous cases.
```

---

# 13. Final guidance for AI coding agents

When implementing any feature:

1. Do not call Moralis or Alchemy from the browser.
2. Do not import provider modules into `.component.tsx` or `.container.tsx`.
3. Use internal typed API routes and TanStack Query hooks.
4. Include `chainId` in every provider call, DB identity, API request, and query key.
5. Use Moralis for wallet discovery and recent UX.
6. Use Alchemy for pricing and RPC-backed reconstruction.
7. Do not introduce CoinGecko or another pricing provider.
8. Do not treat Moralis DeFi positions as final lifecycle analytics.
9. Do not treat Alchemy missing price as spam proof.
10. Persist raw provider records before domain normalization.
11. Return coverage and provenance metadata to the UI.
12. Localize all user-facing provider/coverage/trust states.

---

# 14. References

## Moralis official documentation

- Moralis EVM Data API overview: https://docs.moralis.com/data-api/evm/overview
- Moralis Wallet API overview: https://docs.moralis.com/data-api/evm/wallet/overview
- Moralis Token Balances: https://docs.moralis.com/data-api/evm/wallet/token-balances
- Moralis Wallet History: https://docs.moralis.com/data-api/evm/wallet/wallet-history
- Moralis Wallet DeFi Positions: https://docs.moralis.com/data-api/evm/defi/wallet-positions
- Moralis Detailed DeFi Positions: https://docs.moralis.com/data-api/evm/defi/wallet-positions-detailed
- Moralis Token Metadata: https://docs.moralis.com/data-api/evm/token/metadata/token-metadata
- Moralis Verified Contracts: https://docs.moralis.com/data-api/data-features/safety-and-trust/verified-contracts
- Moralis Spam Filtering: https://docs.moralis.com/data-api/resources/spam-filtering

## Alchemy official documentation

- Alchemy Prices API quickstart: https://www.alchemy.com/docs/reference/prices-api-quickstart
- Alchemy Token Prices By Address: https://www.alchemy.com/docs/data/prices-api/prices-api-endpoints/prices-api-endpoints/get-token-prices-by-address
- Alchemy Historical Token Prices: https://www.alchemy.com/docs/data/prices-api/prices-api-endpoints/prices-api-endpoints/get-historical-token-prices
- Alchemy Token Prices By Symbol: https://www.alchemy.com/docs/data/prices-api/prices-api-endpoints/prices-api-endpoints/get-token-prices-by-symbol
- Alchemy NFT Spam Contracts: https://www.alchemy.com/docs/reference/nft-api-endpoints/nft-api-endpoints/nft-spam-endpoints/get-spam-contracts-v-3
- Alchemy NFT Is Spam Contract: https://www.alchemy.com/docs/reference/nft-api-endpoints/nft-api-endpoints/nft-spam-endpoints/is-spam-contract-v-3
- Alchemy NFT spam classification overview: https://www.alchemy.com/support/how-are-nfts-classified-as-spam-and-why
