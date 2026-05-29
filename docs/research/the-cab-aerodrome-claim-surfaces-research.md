# The Cab — Aerodrome Claim & Fee Surfaces Research v1.0

## Document role

Companion to `the-cab-protocol-mechanics-research-aerodrome-mellow.md`. This note documents the **specific on-chain surfaces** through which an Aerodrome user receives value (emissions, fees, voting rewards) and how each surface maps to ownership in The Cab's domain model (`deposit` / `strategy` / `pool`).

This document exists because the reward attribution pipeline was previously biased toward treating every reward-shaped transaction as a manual-deposit gauge claim, which produced systematic miscategorization for strategy wrapper claims, pool fee claims, mixed `withdraw()` transactions, governance-related calls, and phishing airdrops.

Source for all on-chain semantics: [github.com/aerodrome-finance](https://github.com/aerodrome-finance) (`contracts` and `slipstream` repos).

---

## 1. Aerodrome product surfaces in scope

Aerodrome has two liquidity products:

- **v2 AMM** (`contracts/Pool.sol`) — stable/volatile pairs with fungible ERC20 LP tokens.
- **Slipstream / CL** (`slipstream/contracts/CLPool.sol`) — concentrated-liquidity positions held as ERC721 NFTs via `NonfungiblePositionManager`.

Both products participate in the same emission/voting flywheel (`Voter`, `Gauge`, `FeesVotingReward`, `VotingEscrow` / `veAERO`), but value reaches the LP through **different functions** depending on the product and the kind of value.

---

## 2. Surface taxonomy

The five economically distinct surfaces we must classify are:

| Surface | What it pays | Who can call | Per-what | Function |
|---|---|---|---|---|
| `manual_deposit_gauge_claim` | AERO emissions on a staked CL NFT | NFT owner | per `tokenId` | `CLGauge.getReward(uint256 tokenId)` |
| `pool_fee_claim` v2 | swap fees in pool tokens | any LP (`msg.sender`) | per `(wallet, pool)` LP balance | `Pool.claimFees()` |
| `pool_fee_claim` Slipstream | swap fees in pool tokens | NFT owner / approved | per `tokenId` | `NonfungiblePositionManager.collect(...)` |
| `strategy_wrapper_reward_claim` | emissions/fees passed through a wrapper | wrapper share holder | per wrapper / per `(wallet, wrapper)` | wrapper-specific (e.g. `LpWrapper.getRewards(address)`) |
| `governance_voter_claim` | bribes + fees attached to a vote | veNFT owner | per veNFT `tokenId` | `Voter.claimFees(...)` / `Voter.claimBribes(...)` / `FeesVotingReward.getReward(tokenId, tokens)` |

Anything that does not match a known surface and is not user-position-owned (e.g. phishing airdrops, unmapped reward contracts) is **not** a claim at all and must be excluded from the economic pipeline.

---

## 3. Surface details

### 3.1 `Pool.claimFees()` (v2 AMM)

Source: [`contracts/Pool.sol`](https://github.com/aerodrome-finance/contracts/blob/main/contracts/Pool.sol).

Relevant behavior:

- Callable by **any address**, no access control.
- Internally calls `_updateFor(msg.sender)`. Fees are tracked per-LP-address via `supplyIndex0[address]` / `supplyIndex1[address]`, indexed against the pool-global `index0` / `index1` accumulators.
- The amount paid is `claimable0[msg.sender]` + `claimable1[msg.sender]`, then cleared to 0.
- Funds are transferred to `msg.sender` via `PoolFees.claimFeesFor(sender, claimed0, claimed1)`.

**Ownership conclusion for The Cab:**
- Owner is the wallet, scoped by `(wallet, pool)` aggregate of v2 LP token balance.
- The pool is the **fee source**, not the owner.
- Map to our hierarchy:
  - if exactly 1 active `deposit` (or `strategy`) holds v2 LP for that pool at tx time → attribute to it (`feeAttributionBasis = "wallet_pool_single_holder"`).
  - if multiple → attribute to the canonical (e.g. oldest still-open) holder AND record `feeAttributionBasis = "wallet_pool_aggregate"` in metadata; do not invent a per-deposit split.
  - if zero (claim after full exit) → `unresolved` with reason `feeClaimNoActivePosition`.

### 3.2 `NonfungiblePositionManager.collect(...)` (Slipstream / CL)

Source: [`slipstream/contracts/periphery/NonfungiblePositionManager.sol`](https://github.com/aerodrome-finance/slipstream).

Relevant behavior:

- Callable by NFT owner or approved operator.
- Pays out accumulated `tokensOwed0` / `tokensOwed1` for the specific `tokenId`.
- Funds go to the `recipient` parameter (typically the caller).

**Ownership conclusion for The Cab:**
- Owner is the manual deposit identified by `tokenId`.
- Map to our hierarchy:
  - resolve via `tokenId` exactly like manual gauge claims.
  - `rewardType = "fee_claim"`, `deposit_or_strategy_id` = the deposit's id.

### 3.3 `CLGauge.getReward(uint256 tokenId)` and `getReward(address account)`

Source: [`slipstream/contracts/gauge/CLGauge.sol`](https://github.com/aerodrome-finance/slipstream) and [`contracts/gauges/Gauge.sol`](https://github.com/aerodrome-finance/contracts/blob/main/contracts/gauges/Gauge.sol).

Two distinct selectors live under similar names:

- `getReward(uint256 tokenId)` — Slipstream CL gauge; claims AERO emissions for the staked NFT identified by `tokenId`.
- `getReward(address account)` — v2 gauge; claims AERO emissions for the LP staking position of `account` (per-LP-address, like `claimFees`).

**Ownership conclusion for The Cab:**
- `getReward(uint256)` → `manual_deposit_gauge_claim`, resolve via `tokenId`.
- `getReward(address)` on a known v2 gauge mapped to a pool → resolve via `(wallet, pool)` like `Pool.claimFees`. `rewardType = "reward_claim"`.
- `getReward(address)` on an **unmapped** contract → do **not** assume governance, do **not** force into manual-deposit path. Mark `unresolved` with reason `unknownRewardSurface` and surface the contract address for protocol registry curation.

### 3.4 Wrapper surfaces (Mellow `LpWrapper` and similar)

Source: third-party wrapper contracts (e.g. Mellow `LpWrapper`).

Relevant behavior:

- A wrapper holds the Aerodrome NFT / LP token on behalf of its share holders.
- Users interact with the wrapper, not Aerodrome directly.
- Typical selectors observed:
  - `getRewards(address account)` — pure reward claim; only the reward token(s) flow in. Map to `strategy_wrapper_reward_claim`.
  - `withdraw(uint256 sharesIn, uint256 amount0Min, uint256 amount1Min, address to, uint256 deadline)` — burns wrapper shares and returns principal tokens; may also forward accumulated rewards in the same tx.

**Ownership conclusion for The Cab:**
- `getRewards(address)` on a historical wrapper of the wallet → `strategy_wrapper_reward_claim`, resolve via `(wallet, wrapper)`.
- `withdraw(...)` on a wrapper → **decompose** the tx:
  - principal token outflows from wrapper to wallet → `strategy_close` (or `strategy_withdraw_partial` if shares > 0 after).
  - reward token inflow, only if it can be **deterministically isolated** from the principal tokens → `reward_claim`.
  - if reward isolation is not deterministic → emit only the principal/close component; do **not** create a reward component. Preferred to under-attribute than to inflate.

### 3.5 `Voter.claimFees(...)`, `Voter.claimBribes(...)`, `FeesVotingReward.getReward(...)`

Source: [`contracts/Voter.sol`](https://github.com/aerodrome-finance/contracts/blob/main/contracts/Voter.sol) and [`contracts/rewards/`](https://github.com/aerodrome-finance/contracts/tree/main/contracts/rewards).

Relevant behavior:

- `Voter.claimFees(address[] _fees, address[][] _tokens, uint256 _tokenId)` — batch claim of fees per veNFT `_tokenId`, NOT per LP position.
- `Voter.claimBribes(...)` — same shape, for bribes.
- `FeesVotingReward.getReward(uint256 tokenId, address[] tokens)` — under the hood claim for a veNFT.

**Ownership conclusion for The Cab:**
- Not a deposit/strategy reward. It is governance flow tied to `veAERO`.
- For now, classify as `governance_voter_claim` and **exclude from rewards/fees totals** at the deposit/strategy level. If/when the product models `veAERO` positions, this surface will gain a first-class owner. Until then, do not attribute to an LP deposit or strategy.

### 3.6 `Gauge._claimFees()` (internal sweep)

Internal helper that sweeps accumulated pool fees from `Pool` into `FeesVotingReward`. Not user-callable directly and not a user-owned cash flow. Must not be classified as a user fee claim.

---

## 4. Phishing / spam exclusion

Phishing airdrops appear in provider history as ERC20 inflows from unknown contracts, often with spoofed token metadata and `methodLabel = airdrop` or provider `category = airdrop`. They are **not** reward surfaces and must be excluded **before** any reward candidate is generated.

Signals (deterministic):
- ledger classification `airdrop`, OR
- inflow asset marked `possibleSpam = true` or `verifiedContract = false` by the provider, AND no touched contract is mapped to a known The Cab protocol surface (Aerodrome `Pool` / `Gauge` / `NonfungiblePositionManager`, known wrappers, etc.).

Policy:
- Raw provider record and ledger event are retained for audit.
- The ledger event is tagged `economicExclusionReason = "airdrop_spam"`.
- No reward candidate is emitted for excluded events.
- No `reward_event` or `fee_event` row is written.

This must run **at ledger classification time**, not after reward resolution, so spam never deforms upstream decisions.

---

## 5. Transaction decomposition

A single transaction can produce more than one economically distinct event. Examples:

- `LpWrapper.withdraw(...)` may produce `strategy_close` + `reward_claim`.
- `multicall([decreaseLiquidity, collect, burn])` on Slipstream NPM may produce `deposit_close` + `fee_claim`.
- A Slipstream `multicall([collect, decreaseLiquidity])` partial close may produce `fee_claim` + `strategy_withdraw_partial` (or `deposit_partial_withdraw`).

The pipeline therefore must support `1 tx → N economic components`. Each component is the unit of ownership attribution and persistence, not the transaction itself.

---

## 6. Mapping summary

| `SurfaceKind` | `EconomicComponentKind` | `rewardType` in `reward_events` | Owner |
|---|---|---|---|
| `manual_deposit_gauge_claim` | `reward_claim` | `reward_claim` | deposit by `tokenId` |
| `pool_fee_claim` (Slipstream `collect`) | `fee_claim` | `fee_claim` | deposit by `tokenId` |
| `pool_fee_claim` (v2 `Pool.claimFees`) | `fee_claim` | `fee_claim` | deposit/strategy by `(wallet, pool)` with `feeAttributionBasis` |
| `strategy_wrapper_reward_claim` | `reward_claim` | `reward_claim` | strategy by `(wallet, wrapper)` |
| `strategy_wrapper_withdraw` | `strategy_close` + optional `reward_claim` | (no row for close; `reward_claim` only if separable) | strategy by `(wallet, wrapper)` |
| `governance_voter_claim` | (excluded) | (no row) | none — out of scope |
| `gauge_reward_unknown_surface` | (unresolved) | `reward_claim` with `resolution_status = "unresolved"` | none until surface mapped |
| `airdrop_spam` | `excluded_airdrop` | (no row) | none — excluded early |

---

## 7. Implementation guardrails

These guardrails restate the no-heuristics rule from the repo copilot instructions in the specific context of this pipeline:

1. Never infer ownership for `Pool.claimFees()` by matching pool + time-window; always resolve via the deterministic `(wallet, pool)` rule above.
2. Never treat `getReward(address)` on an unmapped contract as either governance or as a manual deposit claim; mark `unknownRewardSurface`.
3. Never split a v2 `Pool.claimFees()` payout across multiple deposits in the same pool unless the protocol exposes a per-deposit accounting (it does not).
4. Never include `Voter.claimFees` / `Voter.claimBribes` in deposit or strategy reward totals.
5. Never create a `reward_claim` component for a wrapper `withdraw(...)` unless the reward token inflow is deterministically separable from principal token outflows.
6. Spam exclusion must run before reward candidate generation, not after reward resolution.
