# The Cab — Aerodrome & Mellow Protocol Mechanics Research v1.1

## Document role

This document is a **protocol mechanics research note** for The Cab.

It does **not** define the product UX, navigation model, domain model, or implementation architecture. Those are defined in the main product specification.

This document captures the protocol-level findings that materially affect The Cab’s analytics engine, especially around:

- Aerodrome concentrated-liquidity deposits;
- manual deposit identity;
- deposit lifecycle reconstruction;
- staking and reward behavior;
- Mellow automated strategies;
- pool-level aggregation;
- strategy separation;
- event interpretation risks;
- implementation warnings for classification.

The purpose is to preserve the technical reasoning behind the product model so future AI-assisted development does not drift back into incorrect assumptions.

---

## 1. Research status

### Confirmed / accepted product interpretation

The following findings are treated as accepted design inputs for The Cab:

- Manual Aerodrome concentrated-liquidity deposits should be identified primarily by NFT / `tokenId` where available.
- `mint()` creates a new manual deposit lifecycle.
- `increaseLiquidity(tokenId, ...)` adds capital to an existing deposit lifecycle.
- `IncreaseLiquidity` events alone are not sufficient to distinguish a new deposit from an increase to an existing deposit.
- Mellow exposure should not be modeled as a user-owned manual Aerodrome NFT deposit unless the wallet actually owns the relevant NFT.
- Mellow should be modeled as an automated strategy layer.
- Pool-level analytics should aggregate manual deposits and automated strategies while preserving their separation.
- Residual wallet assets outside active LP deposits must remain visible and counted in portfolio analytics.

### Needs further verification

The following areas need further protocol-specific research during implementation:

- Exact Mellow share valuation formula per strategy.
- Exact event set emitted by each Mellow Aerodrome strategy wrapper/vault/staking contract.
- Whether all Mellow strategy wrappers expose enough data for full accounting.
- Gauge-to-pool discovery rules for every relevant Aerodrome pool type.
- Reward/bribe/fee distributor event shapes and how consistently they map to pools.
- Edge cases where routed liquidity operations, direct pool interactions, and gauge operations happen in the same transaction.

---

## 2. Aerodrome concentrated-liquidity manual deposits

### 2.1 Position / deposit identity

For Aerodrome concentrated-liquidity positions, the primary identity of a manual LP position is the position NFT.

The practical rule for The Cab:

```txt
manual Aerodrome CL deposit identity = NFT tokenId where available
```

This means continuity is not determined by:

- same pool only;
- same token pair only;
- same price range only;
- same wallet only;
- same transaction pattern only.

Continuity is determined by whether the operation modifies the same existing NFT / `tokenId`.

### 2.2 `mint()` semantics

A `mint()` call creates a new NFT / new `tokenId`.

Product interpretation:

```txt
mint() => new Deposit
```

Analytics implication:

- A new manual deposit lifecycle starts.
- The deposit gets its own entry value.
- Future events must be linked to this deposit by token identity.
- Even if the user opens a new deposit in the same pool and same range, a new NFT means a new deposit.

### 2.3 `increaseLiquidity(tokenId, ...)` semantics

An `increaseLiquidity(tokenId, ...)` call adds liquidity to an existing NFT / `tokenId`.

Product interpretation:

```txt
increaseLiquidity(existing tokenId) => same Deposit continues
```

Analytics implication:

- Do not create a new Deposit.
- Increase capital entered for the existing deposit.
- Update the lifecycle timeline.
- Update deposit-level performance metrics.
- Preserve continuity for realized/unrealized PnL.

### 2.4 `decreaseLiquidity(...)` semantics

A `decreaseLiquidity(...)` call reduces the liquidity of an existing position.

Product interpretation:

```txt
decreaseLiquidity(existing tokenId) => Deposit partially reduced
```

Analytics implication:

- Record a deposit lifecycle event.
- Record token outputs as `AssetMovement`.
- If the position remains open, keep the Deposit active.
- If the reduction is part of a later swap/redeposit flow, residual attribution may need to be opened.

### 2.5 `collect(...)` semantics

A `collect(...)` call realizes fees or collectible balances from a position.

Product interpretation:

```txt
collect(tokenId) => fee/reward realization linked to Deposit
```

Analytics implication:

- Create `RewardEvent` or fee-related `LedgerEvent`.
- Value the collected assets at claim/collect time.
- Link the event to the Deposit and Pool.
- Avoid treating collect as fresh capital.

### 2.6 Burn behavior

A position NFT can eventually be burned when the position is effectively emptied and collectible balances are cleared.

Product interpretation:

```txt
burn(tokenId) => end-of-life cleanup signal
```

Analytics implication:

- Burn may confirm closure.
- Burn should not be the only signal used to detect exit.
- The deposit may be economically closed before burn if liquidity has been fully removed and assets withdrawn.
- Burn is not how normal deposit continuity should be tracked.

---

## 3. Aerodrome event semantics and classification risks

### 3.1 Useful concentrated-liquidity events

Relevant events include:

- `IncreaseLiquidity(tokenId, liquidity, amount0, amount1)`
- `DecreaseLiquidity(tokenId, liquidity, amount0, amount1)`
- `Collect(tokenId, recipient, amount0, amount1)`

These events are useful but must be interpreted with transaction context.

### 3.2 Critical caveat: `IncreaseLiquidity` is ambiguous

`IncreaseLiquidity` can be emitted when:

- a new position is created through `mint()`;
- liquidity is added to an existing position through `increaseLiquidity(tokenId, ...)`.

Therefore:

```txt
event-only classification is not enough
```

The Cab must distinguish new deposit creation from extension of an existing deposit using:

- transaction method semantics;
- decoded transaction input;
- resulting NFT / tokenId;
- known existing Deposit identity;
- call trace or provider-decoded transaction context where available.

### 3.3 Classification rule

For manual Aerodrome concentrated-liquidity deposits:

| Signal | The Cab interpretation | Entity affected |
|---|---|---|
| `mint()` | Opens new manual deposit | `Deposit` |
| `increaseLiquidity(existing tokenId)` | Adds capital to existing deposit | `Deposit` |
| `decreaseLiquidity(tokenId)` | Reduces existing deposit | `Deposit`, `LedgerEvent`, `AssetMovement` |
| `collect(tokenId)` | Realizes fees/rewards | `RewardEvent`, `LedgerEvent` |
| `burn(tokenId)` | Confirms end-of-life cleanup | `Deposit` |

### 3.4 Implementation warning

Do not classify an Aerodrome deposit lifecycle using event names alone.

Incorrect:

```txt
IncreaseLiquidity event => always increase existing Deposit
```

Correct:

```txt
mint() + IncreaseLiquidity event => new Deposit
increaseLiquidity(tokenId) + IncreaseLiquidity event => existing Deposit continues
```

---

## 4. Aerodrome protocol surfaces

The Cab must not assume that every Aerodrome-related action passes through the Router.

The Router is a primary discovery surface for:

- swaps;
- add liquidity;
- remove liquidity;
- routed pool discovery;
- `poolFor(...)` derivation;
- active factory discovery through `defaultFactory()`.

However, several important actions happen through other protocol surfaces.

### 4.1 Discovery surfaces by activity family

| Activity family | Primary discovery surfaces | Analytics implication |
|---|---|---|
| Swaps | Router, pool events, token transfers | Usually router-mediated, but must be confirmed with token movement. |
| Add liquidity / deposit LP | Router, pool events, position manager, LP/NFT events | May pass through Router, but must be tied to Deposit identity. |
| Remove liquidity / withdraw LP | Router, pool events, position manager, token transfers | May open residual attribution. |
| Stake LP | Gauge contracts, LP token transfers | Do not assume Router involvement. |
| Unstake LP | Gauge contracts, LP token transfers | Do not assume Router involvement. |
| Claim LP/gauge rewards | Gauge/reward contracts, token transfers | Link to RewardEvent. |
| veAERO lock/relock/increase | Voting escrow / veAERO contracts, AERO transfers | Governance surface, not Router surface. |
| Vote/reset/relay | Voter/governance contracts | Governance surface. |
| Claim voting fees/bribes/rebases | Bribe/fee/reward distributors, token transfers | Group by pool where possible. |
| Mellow deposit/withdraw | Mellow wrapper/vault/staking contracts, token transfers | StrategyExposure surface. |
| Mellow internals | Mellow strategy contracts and visible underlying Aerodrome events | Mark partial coverage when necessary. |

### 4.2 Router as anchor, not full index

The Router should be treated as:

```txt
primary discovery anchor != complete protocol index
```

The analysis pipeline must discover and classify activity across:

- Router;
- pools;
- position manager;
- gauges;
- reward contracts;
- bribe/fee distributors;
- AERO token;
- veAERO / voting escrow;
- voter / relay contracts;
- Mellow wrappers;
- Mellow vaults;
- Mellow strategy contracts.

### 4.3 Factory and pool discovery

The PoolFactory address should not be treated as a manually maintained permanent constant.

Preferred approach:

```ts
const factoryAddress = await router.defaultFactory();
```

The discovered factory should be stored as protocol metadata with:

- source: `router.defaultFactory()`;
- router address used;
- chain ID;
- block number;
- timestamp;
- confidence.

Pool addresses may then be derived through Router `poolFor(tokenA, tokenB, stable, factory)` behavior or equivalent offchain derivation.

---

## 5. Manual deposits and pool-level interpretation

### 5.1 Pool as higher-level economic container

A Pool is the higher-level market container.

At pool level, The Cab should show:

- total capital assigned;
- capital withdrawn;
- manual deposit exposure;
- automated strategy exposure;
- residual attributed value;
- realized and unrealized PnL;
- total rewards;
- current pool-related value;
- asset exposure;
- all active and historical strategies associated with the pool.

### 5.2 Deposits as finite lifecycle entities

Each manual deposit should be treated as a finite lifecycle entity:

- opens with an entry value;
- may receive additional capital;
- may be staked;
- may generate fees/rewards;
- may be partially reduced;
- may be unstaked;
- may be withdrawn;
- may close with a final value;
- may be followed by a rebalance or new deposit.

### 5.3 Pool aggregation with separation

A pool may include:

```txt
Pool
  ├── Manual Deposits
  ├── Automated Strategies
  └── Residual Attribution
```

The pool view should aggregate value while preserving source breakdown.

---

## 6. Rebalance and residual attribution implications

### 6.1 Why residual attribution exists

When a manual deposit is closed or reduced, the resulting tokens may remain in the wallet.

Those tokens may be:

- waiting for rebalance;
- partially swapped into the paired pool token;
- redeployed into the same pool;
- moved into another pool;
- liquidated into unrelated assets;
- transferred out of the wallet.

If those assets disappear from pool analytics immediately after withdrawal, The Cab will falsely show the user as having exited the pool economically even when they are still holding pool-related assets.

### 6.2 Residual attribution rule

After a withdrawal, withdrawn pool tokens should remain attributed to the pool until actual token movement resolves them.

Resolution examples:

| Movement | Interpretation |
|---|---|
| Swap token0 into token1 of same pool | Rebalance |
| Redeploy into same pool | Same-pool redeployment |
| Swap into unrelated token | Liquidation from pool |
| Transfer to external wallet | Cash out |
| Swap into token of another tracked pool | Possible transfer/reassignment |
| No movement | Still waiting |

### 6.3 Over-consumption rule

If the user swaps more of a token than the residual amount attributed to the candidate pool, The Cab must not force the entire swap into that pool.

Use the source-priority waterfall:

1. Candidate pool residual attribution.
2. Matching-token cash-ins.
3. Matching-token liquidation-derived or reward-conversion inventory.
4. Other same-token residual attribution states pro rata.
5. Unknown wallet inventory as low-confidence fallback.

Example:

```txt
Pool WETH/cbBTC residual = 0.1 cbBTC
User swaps 0.14 cbBTC -> WETH
```

Interpretation:

```txt
0.1 cbBTC  => WETH/cbBTC rebalance
0.04 cbBTC => allocated through waterfall
```

If the extra `0.04 cbBTC` came from prior AERO -> cbBTC reward conversion, it should be attributed to liquidation-derived inventory, not to the pool residual.

---

## 7. Mellow integration mechanics

### 7.1 Why Mellow is not a manual LP NFT deposit

Mellow’s Aerodrome integration introduces a managed strategy layer.

The observed high-level architecture includes:

- underlying Aerodrome pool;
- wrapper / vault layer;
- staking rewards contract;
- managed internal position system;
- user-facing deposits and withdrawals;
- share or strategy exposure accounting.

From the user perspective, a Mellow deposit should not be interpreted as the user opening a normal manual Aerodrome LP NFT position.

### 7.2 User-facing Mellow flows

Relevant flows may include:

- `depositAndStake(...)`;
- `unstakeAndWithdraw(...)`;
- wrapper-level `Deposit(...)` events;
- wrapper-level `Withdraw(...)` events;
- share mint/burn or balance changes;
- staking reward claims.

These signals are more appropriate for user-level Mellow accounting than trying to infer a manual LP NFT lifecycle.

### 7.3 Underlying Aerodrome behavior

Mellow may use Aerodrome concentrated-liquidity positions underneath.

However, the strategy may add liquidity to existing managed positions rather than minting one independent LP NFT per user deposit.

Implication:

```txt
Mellow user exposure != user-owned manual Aerodrome deposit
```

### 7.4 Best product interpretation

For The Cab:

```txt
Mellow => Strategy
User Mellow participation => StrategyExposure
Underlying market => Pool
```

A user may have, in the same pool:

- one or more manual deposits;
- one or more Mellow strategy exposures;
- residual attributed balances.

These should be:

- separated in Deposits and Strategies;
- aggregated in Pools;
- traceable in Activity;
- included correctly in Rewards and Portfolio.

### 7.5 Mellow coverage model

Mellow strategy accounting may have different coverage levels:

| Coverage | Meaning |
|---|---|
| `full` | Underlying and share accounting are sufficiently reconstructed. |
| `share_level` | User exposure is reliable at share/wrapper level, but underlying internals are partial. |
| `partial` | Some events, valuation, or mappings are missing. |
| `unknown` | Strategy detected but cannot be reliably analyzed. |

The UI must not pretend that Mellow has the same precision model as manual deposits unless evidence supports it.

---


---

## 8. Mellow ALM / Aerodrome CL strategy mechanics

This section extends the previous Mellow interpretation with protocol-specific research about how Mellow ALM vault systems, wrappers, staking rewards, fees, and rebalances work.

The key product conclusion remains:

```txt
Mellow strategy != manual Aerodrome deposit
```

For The Cab, Mellow must be modeled as:

```txt
Strategy
  -> StrategyExposure
  -> LedgerEvents
  -> AssetMovements
  -> RewardEvents
  -> CoverageReport
```

and associated with an Aerodrome Pool where the underlying pool relationship is known.

### 8.1 Official Aerodrome CL strategy metadata

Mellow’s official Aerodrome CL strategies page lists, per strategy:

- strategy name;
- width;
- underlying Aerodrome pool;
- `lpWrapper`;
- `StakingRewards`.

This confirms that The Cab should not discover Mellow strategies only from arbitrary wallet transactions. It should use official Mellow strategy metadata as a protocol source of truth and then match wallet interactions against listed wrappers/staking contracts.

The relevant metadata fields for The Cab are:

```txt
name
width
pool
lpWrapper
stakingRewards
```

Domain mapping:

| Mellow docs field | The Cab entity/field |
|---|---|
| Name | `Strategy.label` |
| width | `Strategy.metadataJson.width` |
| POOL | `Strategy.primaryPoolId` / `Strategy.metadataJson.underlyingPoolAddress` |
| lpWrapper | `Strategy.wrapperAddress` / `ProtocolContract.contractType = mellow_wrapper` |
| StakingRewards | `Strategy.stakingRewardsAddress` / `ProtocolContract.contractType = mellow_staking_rewards` |

Implementation rule:

- The Cab should sync the official Mellow Aerodrome CL strategy list into `ProtocolContract` and `Strategy`.
- Strategy records should include provenance:
  - `source = official_mellow_docs`
  - `sourceReference = Mellow Aerodrome CL strategies docs`
  - `confidence = high`
- Wallet interactions with those `lpWrapper` and `StakingRewards` contracts should be classified as Mellow strategy activity.

### 8.2 Mellow ALM core architecture

Mellow ALM is organized around vault systems.

The relevant high-level concepts for The Cab are:

- vault systems;
- vault factories;
- vault instances;
- vault registry NFTs;
- ERC20RootVault;
- subvaults;
- strategies;
- permissions;
- operators;
- validators.

Important research findings:

- The strategy is an arbitrary contract constrained by the vault system permissions.
- Vault systems can be created and managed by strategists/governance.
- A VaultRegistry stores information about open vaults.
- Each vault is assigned an NFT.
- The ERC20RootVault manages liquidity-provider deposits/withdrawals.
- The strategy is approved to rebalance tokens between vaults.

Product implication:

```txt
Mellow user exposure should be tracked at root-vault / wrapper / staking-rewards / share level first.
```

Underlying strategy internals are useful for advanced analytics, but should not be required to show basic user-level StrategyExposure.

### 8.3 Deposit mechanics in Mellow vaults

Mellow docs describe ERC20RootVault deposits as a multi-step process:

1. Fetch TVL estimates for each token.
2. Use deposited tokens in the same ratio as the TVL estimate.
3. Return excess token amounts that are not needed for the ratio.
4. Transfer tokens into ERC20RootVault.
5. Calculate deposit shares for each token relative to the TVL estimate.
6. Use the minimum share value to calculate minted LP token amount.
7. Mint LP tokens.

Important implications for The Cab:

- A Mellow deposit may involve multiple deposited tokens.
- Not all user-supplied token amounts necessarily become deployed capital; excess can be returned.
- The canonical user accounting unit is minted LP/share amount, not an Aerodrome NFT.
- The strategy may charge protocol/management/performance fees during deposit.
- Deposits can be disabled or restricted by allowlist / vault parameters.
- A successful deposit emits a `Deposit` event on the relevant vault/root/wrapper surface.

The Cab should classify a Mellow deposit using:

- user token transfers into wrapper/root vault;
- `Deposit` event;
- LP/share mint or balance increase;
- strategy metadata linking wrapper/staking contract to pool;
- transaction context;
- any returned token amounts.

Do not classify the full input token amount as capital entered if some of it was returned in the same transaction.

### 8.4 Withdrawal mechanics in Mellow vaults

Mellow docs describe ERC20RootVault withdrawals as a multi-step process:

1. Fetch lower TVL estimate for each token.
2. Use LP tokens to calculate each token amount pending withdrawal.
3. Pull tokens from subvaults as needed.
4. Burn LP tokens.
5. Transfer ERC20 tokens to the withdrawer.
6. Transfer leftovers to the first subvault.
7. Enforce withdrawal limits.

Important implications for The Cab:

- A Mellow withdrawal may return multiple tokens.
- Withdrawal outputs are based on share/LP token burn and TVL estimates.
- Withdrawal amounts may be subject to protocol governance limits.
- The strategy may pull from multiple subvaults to satisfy withdrawal.
- Withdraw emits a `Withdraw` event on the relevant vault/root/wrapper surface.
- A Mellow withdrawal is a reduction or closure of `StrategyExposure`, not a manual Deposit withdrawal.

The Cab should classify a Mellow withdrawal using:

- LP/share burn or balance decrease;
- `Withdraw` event;
- token transfers from wrapper/root vault to wallet;
- strategy metadata;
- resulting token balances.

Returned tokens may become:

- idle wallet assets;
- residual attributed assets if they map to the underlying pool;
- candidates for later rebalance/liquidation attribution.

### 8.5 Mellow fees

Mellow docs describe several fee types:

- management fees;
- protocol fees;
- performance fees.

Fees may be charged during deposits or withdrawals if enough time has elapsed since the latest fee charge.

The docs describe fee charging as minting new LP tokens for the protocol treasury.

Implications for The Cab:

- User share dilution may occur even without an explicit user claim.
- Strategy performance should not rely only on direct token transfers.
- Fee effects may be visible through LP/share supply changes and treasury mint events.
- If fee accounting is not reconstructable from available events, The Cab should mark strategy coverage as `share_level` or `partial`.

The Cab should avoid presenting exact fee-adjusted strategy PnL unless it can reconstruct:

- user share balance before/after;
- total LP supply;
- minted fee shares;
- share price / vault TVL;
- timing of fee charges.

### 8.6 Mellow rebalances

Mellow docs describe rebalances using vault mechanics:

- `pull` is used to rebalance tokens between vaults.
- `externalCall` can be used by the Strategy on behalf of the Vault to interact with external DEXes.
- Strategy actions are constrained by permissions and validators.

Implications for The Cab:

- Strategy-level rebalances may happen without direct wallet interaction.
- These rebalances are part of the automated strategy internals.
- They should not be classified as user manual rebalances.
- User-visible accounting should focus on share value, deposits, withdrawals, and rewards unless deeper strategy internals are reliably available.

The Cab should classify Mellow rebalances as:

```txt
strategy_internal_rebalance
```

only when the event/call can be tied to the strategy contracts.

These should affect `Strategy` analytics, not manual `Deposit` analytics.

### 8.7 StakingRewards and wrapper behavior

The official Aerodrome CL strategy list includes both:

- `lpWrapper`;
- `StakingRewards`.

This suggests two distinct surfaces for analytics:

#### lpWrapper

The wrapper is the likely user-facing or strategy-facing contract for deposit/withdraw/share behavior.

Track:

- deposits;
- withdrawals;
- share mint/burn;
- wrapper token transfers;
- token transfers in/out;
- relationship to underlying pool.

#### StakingRewards

The staking rewards contract is the likely surface for reward accounting.

Track:

- stake-like events where present;
- unstake-like events where present;
- reward claims;
- emitted reward events;
- token transfers to the wallet;
- reward token type;
- claim timestamp.

Implementation rule:

- A wallet interaction with `lpWrapper` should be considered candidate StrategyExposure lifecycle activity.
- A wallet interaction with `StakingRewards` should be considered candidate Strategy reward/staking activity.
- Both surfaces must map to the same `Strategy` record when they are paired in official Mellow metadata.

### 8.8 Mellow event and function watchlist

The exact ABI should be verified per deployed contract, but The Cab should look for these categories:

#### Deposit / entry

Potential signals:

- `deposit(...)`
- `depositAndStake(...)`
- `Deposit(...)`
- ERC20 transfer from wallet to wrapper/root vault
- LP/share token mint or transfer to wallet
- wrapper balance increase

Classification:

```txt
strategy_deposit
strategy_share_mint
```

Affected entities:

- `Strategy`
- `StrategyExposure`
- `LedgerEvent`
- `AssetMovement`

#### Withdraw / exit

Potential signals:

- `withdraw(...)`
- `unstakeAndWithdraw(...)`
- `Withdraw(...)`
- LP/share token burn or transfer from wallet
- ERC20 transfer from wrapper/root vault to wallet

Classification:

```txt
strategy_withdraw
strategy_share_burn
```

Affected entities:

- `StrategyExposure`
- `LedgerEvent`
- `AssetMovement`
- `AttributionState` where returned tokens remain pool-related

#### Stake / unstake

Potential signals:

- staking contract calls;
- staking balance changes;
- wrapper token transfer to/from StakingRewards;
- stake/withdraw events if emitted by StakingRewards.

Classification:

```txt
strategy_stake
strategy_unstake
```

Affected entities:

- `StrategyExposure`
- `LedgerEvent`

#### Reward claim

Potential signals:

- reward claim call;
- reward paid event;
- ERC20 transfer from StakingRewards to wallet;
- reward token transfer.

Classification:

```txt
strategy_claim
strategy_reward
```

Affected entities:

- `RewardEvent`
- `LedgerEvent`
- `AssetMovement`
- `PerformanceSnapshot`

#### Internal rebalance

Potential signals:

- `pull(...)`
- `externalCall(...)`
- strategy/operator calls;
- subvault token movement;
- DEX interaction by strategy/vault.

Classification:

```txt
strategy_internal_rebalance
```

Affected entities:

- `Strategy`
- `PerformanceSnapshot`
- possibly `CoverageReport`

Important:

- Internal Mellow rebalances should not be treated as manual user rebalances.
- They should not create manual Deposits.
- They should not open user residual attribution unless tokens actually move to the user wallet.

### 8.9 Mellow share-level accounting model

The safest product v1 accounting model is share-level accounting.

The Cab should track:

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

Minimum viable Mellow analytics:

```txt
capital entered
capital withdrawn
share balance
rewards claimed
current value estimate
coverage status
```

Preferred analytics if data is available:

```txt
share price over time
underlying token composition
fee dilution effect
strategy internal rebalance impact
realized/unrealized PnL
estimated annualized return
```

Coverage rules:

| Coverage status | Meaning |
|---|---|
| `full` | Deposits, withdrawals, shares, rewards, and value are reconstructable. |
| `share_level` | User shares and entry/exit are reliable, but underlying strategy internals are not. |
| `partial` | Some deposits, withdrawals, rewards, or values are missing. |
| `unknown` | Strategy detected but insufficient data to compute metrics. |

### 8.10 Mellow analytics rules for The Cab

The Cab should follow these rules:

1. Official Mellow strategy metadata defines known strategy surfaces.
2. `lpWrapper` and `StakingRewards` must map to the same Strategy.
3. A user deposit into Mellow creates or updates `StrategyExposure`.
4. A user withdrawal from Mellow reduces or closes `StrategyExposure`.
5. Strategy rewards create `RewardEvent` linked to Strategy and StrategyExposure.
6. Mellow internal rebalances are strategy-level behavior, not manual deposit behavior.
7. Mellow returned tokens may become residual pool attribution only after they reach the user wallet.
8. Mellow strategy value may contribute to Pool aggregates when the underlying pool is known.
9. Mellow should not create manual Deposit entities unless the wallet owns the manual Aerodrome NFT.
10. If accounting relies only on share balances, UI must show `share_level` coverage.

### 8.11 Mellow-specific open questions

Implementation should verify:

1. Exact ABI for each Aerodrome CL strategy `lpWrapper`.
2. Exact ABI for each paired `StakingRewards` contract.
3. Whether `depositAndStake(...)` exists on the wrapper, helper, or UI path for every Aerodrome CL strategy.
4. Whether `unstakeAndWithdraw(...)` exists on the wrapper, helper, or UI path for every Aerodrome CL strategy.
5. Which events expose minted/burned shares.
6. Which events expose reward token and reward amount.
7. Whether current share value can be computed from onchain `tvl()` plus total supply.
8. Whether Mellow exposes a reliable helper/API for strategy TVL and user positions.
9. Whether wrapper token balances are ERC20-compatible and sufficient for user share accounting.
10. How to map each `lpWrapper` back to the exact Aerodrome pool when relying only on onchain reads.
11. Whether management/protocol/performance fee share minting can be reliably separated from user share minting.
12. Whether strategy internal rebalance events should be shown in Activity or only summarized in Strategy detail.


## 9. Protocol finding to domain mapping

| Protocol finding | Domain entity | Notes |
|---|---|---|
| Wallet under analysis | `WalletContext` | One connected wallet at a time. |
| Background reconstruction run | `AnalysisRun` | Trigger.dev job. |
| Official/discovered contracts | `ProtocolContract` | Router, factory, pool, gauge, voter, Mellow wrappers. |
| Aerodrome pool | `Pool` | Market-level aggregate. |
| Manual LP NFT lifecycle | `Deposit` | User-facing manual exposure. |
| Mellow wrapper/vault strategy | `Strategy` | Automated strategy definition. |
| User participation in Mellow | `StrategyExposure` | User-level strategy lifecycle. |
| Onchain classified action | `LedgerEvent` | Canonical event timeline. |
| Token movement | `AssetMovement` | Accounting primitive. |
| Claimed fees/rewards | `RewardEvent` | Query-friendly reward surface. |
| veAERO/vote/relay actions | `GovernanceEvent` | Governance-specific surface. |
| Leftover pool token after withdraw | `AttributionState` | Residual pool attribution. |
| Cash-in or reward-conversion inventory | `AttributionSourceLot` | Waterfall source. |
| Event-time price | `PricePoint` | Alchemy price source. |
| Partial/incomplete data | `CoverageReport` | Confidence and limitations. |

---

## 10. Implementation warnings

### 9.1 Do not collapse Pools, Deposits, and Strategies

Incorrect:

```txt
Pool = Position = Strategy
```

Correct:

```txt
Pool
  ├── Deposits
  ├── Strategies
  └── Residual Attribution
```

### 9.2 Do not model Mellow as manual deposit by default

Incorrect:

```txt
Mellow deposit => manual Aerodrome NFT deposit
```

Correct:

```txt
Mellow deposit => StrategyExposure
```

### 9.3 Do not classify by event names only

Incorrect:

```txt
IncreaseLiquidity event => always existing deposit increase
```

Correct:

```txt
mint() + IncreaseLiquidity => new Deposit
increaseLiquidity(tokenId) + IncreaseLiquidity => same Deposit continues
```

### 9.4 Do not assume Router covers all actions

Incorrect:

```txt
No Router interaction => no Aerodrome activity
```

Correct:

```txt
Aerodrome activity may occur through Router, pools, gauges, rewards, bribes, veAERO, voter, and Mellow contracts.
```

### 9.5 Do not let residual balances disappear

Incorrect:

```txt
withdraw => pool value goes to zero
```

Correct:

```txt
withdraw => active deposit may close, but residual tokens remain attributed until resolved by movement
```

---

## 11. Open research questions

The following research should be completed during implementation:

1. What exact events should be consumed for each Mellow Aerodrome strategy wrapper?
2. How should each Mellow strategy’s shares be valued historically?
3. Which Mellow contracts expose reliable share balance and share price data?
4. How should Mellow rewards be separated from underlying Aerodrome rewards?
5. What is the best source for Gauge-to-Pool mapping?
6. What is the best source for Bribe/Fee distributor-to-Pool mapping?
7. Which Aerodrome governance events are required to allocate voting rewards by pool?
8. Which transactions require call traces rather than event logs only?
9. How should partial history be handled when a deposit or strategy began before the one-year analysis window?
10. Which provider returns enough decoded transaction context to distinguish `mint()` from `increaseLiquidity()` reliably?

---

## 12. Relationship to the main spec

This document is an appendix to the main The Cab product specification.

The main spec defines:

- product behavior;
- navigation;
- sections;
- domain model;
- technical architecture;
- state management;
- design system;
- background analysis flow.

This research document defines:

- why the protocol mechanics require that model;
- what onchain semantics must be respected;
- which event/method distinctions matter;
- where classification can go wrong;
- which questions remain open.

If there is a conflict between this document and the main product specification:

1. Prefer the main product specification for product behavior and architecture.
2. Use this research document to identify protocol assumptions that may need verification.
3. Update both documents when a protocol finding changes the product model.

---


## 13. Research references

Primary sources used for the Mellow extension:

- Mellow ALM Core architecture documentation:
  - `https://docs.mellow.finance/mellow-alm/overview/architecture`
- Mellow ALM Contracts specs:
  - `https://docs.mellow.finance/mellow-alm/overview/contracts-specs`
- Mellow Aerodrome CL strategies contract addresses:
  - `https://docs.mellow.finance/mellow-alm/overview/mellow-contracts-addresses/aerodrome-cl-strategies`

Reference findings:

- Mellow docs describe vault systems, vault factories, vault instances, strategy permissions, VaultRegistry NFTs, ERC20RootVault deposits/withdrawals, withdrawal limits, fees, and rebalances.
- The Aerodrome CL strategies page lists strategy names, widths, underlying pools, `lpWrapper` contracts, and `StakingRewards` contracts.
- The contracts specs state that ERC20RootVault `deposit` emits a `Deposit` event and `withdraw` emits a `Withdraw` event.


## 14. Summary

The research supports these implementation rules:

1. Manual Aerodrome CL deposits are tracked by NFT / `tokenId` where available.
2. `mint()` creates a new Deposit.
3. `increaseLiquidity(tokenId)` extends an existing Deposit.
4. `IncreaseLiquidity` events are ambiguous without transaction context.
5. Mellow user exposure should be modeled as StrategyExposure, not as manual Deposit.
6. Mellow strategies may contribute to Pool aggregates while retaining separate accounting.
7. Router is a discovery anchor, not the entire protocol surface.
8. Pool-level analytics must aggregate Deposits, Strategies, and Residual Attribution.
9. Residual assets must remain visible and attributed until actual movement resolves them.
10. All analytics should remain explainable through LedgerEvents, AssetMovements, PricePoints, and CoverageReports.
