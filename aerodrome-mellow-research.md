# The Cab — Research on Aerodrome and Mellow Mechanics

## Purpose

This document summarizes the technical findings gathered during product discovery for **The Cab**, specifically around how **Aerodrome on Base** and its **Mellow integration** behave for concentrated liquidity positions, staking, rewards, and deposits.

The goal of this document is to capture the protocol behavior that materially affects the analytics model of the product.

---

## 1. Aerodrome concentrated liquidity positions

### 1.1. Position identity

For Aerodrome concentrated liquidity (Slipstream), the primary identity of a manual LP position is the **position NFT**.

The key practical rule is:

- a **new manual position** is opened through `mint(...)`
- an **addition of liquidity to an existing position** happens through `increaseLiquidity(tokenId, ...)`

This means that continuity is not determined by “same price” or even necessarily “same pool”; continuity is determined by whether the operation extends the same **existing position NFT** or creates a new one.

### 1.2. What `mint()` means

A `mint()` call creates a **new NFT / new `tokenId`**, therefore it opens a **new position entity**.

Implication for The Cab:

- every manual `mint()` is a new deposit instance with its own lifecycle
- even if the user reopens in the same pool and similar range, it should still be treated as a new position if a new NFT is minted

### 1.3. What `increaseLiquidity()` means

An `increaseLiquidity(tokenId, ...)` call adds more capital to an **existing position NFT** instead of creating a new one.

Implication for The Cab:

- this operation extends the same position lifecycle
- it does **not** create a new deposit entity

### 1.4. Burn behavior

A position NFT can eventually be burned, but only when the position is effectively emptied and collectible balances are cleared.

Implication:

- burn is an end-of-life cleanup signal
- it is not how position continuity should be tracked during normal operation

---

## 2. Aerodrome event semantics relevant for analytics

### 2.1. Useful events

The concentrated-liquidity position manager exposes events such as:

- `IncreaseLiquidity(tokenId, liquidity, amount0, amount1)`
- `DecreaseLiquidity(tokenId, liquidity, amount0, amount1)`
- `Collect(tokenId, recipient, amount0, amount1)`

### 2.2. Important caveat

`IncreaseLiquidity` is emitted both when:

- a new position is created via `mint()`
- liquidity is added to an existing position via `increaseLiquidity()`

Therefore:

- **event-only classification is not enough**
- The Cab must distinguish between **new position creation** and **extension of an existing position** using transaction context / method semantics / resulting token identity

### 2.3. Practical rule for The Cab

For manual concentrated-liquidity positions:

- `mint()` => **new `PositionInstance`**
- `increaseLiquidity(existing tokenId)` => **same `PositionInstance` continues**
- `decreaseLiquidity` => position reduction
- `collect` => reward/fee realization event

---

## 3. Manual deposits and pool-level interpretation

During discovery, a more practical product model emerged:

- the user wants to understand performance **by pool**
- but each deposit must still be tracked as its own entity with beginning and end
- swaps between cycles should be treated as **rebalance actions**
- leftover balances after rebalance/reopen must remain visible as assets in the wallet

This leads to the following interpretation:

### 3.1. Pool is the higher-level economic container

A pool, such as `WETH/USDC`, should act as an analytical parent entity.

At pool level, the app should be able to show:

- total capital assigned
- capital withdrawn
- realized and unrealized PnL
- total rewards
- current pool-related value
- asset exposure
- all strategies currently or historically active in that pool

### 3.2. Deposits are finite entities

Each manual deposit should be treated as a finite lifecycle entity:

- opens with a value
- generates rewards / fees
- closes with another value
- may be followed by a rebalance
- may result in a new deposit opening later

### 3.3. Rebalance creates realized effects

When a position is closed, assets are swapped, and a new deposit is opened:

- realized gain/loss may occur
- leftover balances may remain uninvested
- these leftovers must still count toward total portfolio value

---

## 4. Mellow integration behavior

### 4.1. Why Mellow cannot be modeled exactly like manual LP NFTs

Mellow’s Aerodrome concentrated-liquidity integration introduces a **wrapper / managed strategy layer**.

The relevant high-level architecture observed during research is:

- a pool
- an `lpWrapper`
- a `StakingRewards` contract
- a managed internal position system behind the wrapper

This suggests that, from the user perspective, deposits into Mellow are not best represented as “the user’s own independent LP NFT position per deposit”, even though Mellow may use Aerodrome concentrated-liquidity positions underneath.

### 4.2. User-facing Mellow deposit behavior

The wrapper exposes flows such as:

- `depositAndStake(...)`
- `unstakeAndWithdraw(...)`

and emits wrapper-level events such as:

- `Deposit(...)`
- `Withdraw(...)`

This is valuable because it gives The Cab a cleaner, user-facing signal for Mellow activity.

### 4.3. Under the hood

Research indicated that Mellow’s deposit module can add underlying liquidity by calling `increaseLiquidity(...)` on an existing managed Aerodrome position, instead of minting a fresh LP NFT for each user deposit.

Implication:

- the user’s Mellow exposure should not be modeled as “one manual NFT position per deposit”
- it should be modeled as exposure to a **separate strategy layer** under the same pool

### 4.4. Best product interpretation for Mellow

For The Cab:

- Mellow should be tracked as a **separate strategy**
- but still **grouped under the corresponding pool**
- a user may have, in the same pool:
  - a long-lived Mellow auto strategy
  - one or more manual positions
- these must remain separate in strategy-level performance
- but aggregatable at pool level

This matches the user’s real usage pattern:

- Mellow vault remains open for long periods
- gains may be withdrawn periodically
- manual deposits may exist in parallel because the vault no longer accepts more capital

---

## 5. Confirmed modeling decisions derived from research

### 5.1. Manual Aerodrome position identity

Manual Aerodrome CL positions should be identified primarily by **NFT `tokenId`**.

### 5.2. Manual continuity rule

A manual position continues only when the onchain data shows an `increaseLiquidity` on the same existing `tokenId`.

### 5.3. Manual new deposit rule

Every `mint()` creates a new deposit entity / new position instance.

### 5.4. Mellow strategy rule

Mellow should be represented as a **distinct strategy under the same pool**, rather than as ordinary user-owned manual LP NFT deposits.

### 5.5. Pool-level aggregation rule

The higher-level analytical view should be **pool-centric**, while preserving strategy separation.

---

## 6. Product implications for The Cab

These findings materially shape the architecture of the app.

### 6.1. The app is not just a wallet tracker

It needs to reconstruct:

- position lifecycles
- capital flows
- rewards realization
- rebalance transitions
- leftover idle assets
- strategy separation inside the same pool

### 6.2. The app must support parallel strategies in one pool

Example:

- Pool: `WETH/USDC`
- Strategy A: Mellow auto
- Strategy B: manual LP position(s)

The Cab must:

- show each separately
- show their combined effect at pool level

### 6.3. Portfolio completeness matters

A rebalance may leave residual balances outside active LP positions.
Those assets must still be included in the portfolio total and must not disappear from the analytics model.

---

## 7. Working interpretation for analytics design

The most practical structure for The Cab is:

- **Portfolio**
  - **Pool**
    - **Strategy**
      - **Position / Deposit Instance**
        - **Events / Asset Movements**

Where:

- pool is the top analytical grouping
- strategy separates manual vs Mellow
- position/deposit instance captures finite lifecycle economics
- events drive actual accounting

---

## 8. Summary

The research supports the following product logic:

1. Manual Aerodrome CL deposits are best tracked as position instances keyed by NFT identity.
2. `mint()` and `increaseLiquidity()` must be distinguished using onchain call semantics, not just by generic liquidity-increase events.
3. Mellow deposits should not be modeled as ordinary manual LP positions, but as a separate strategy layer.
4. A pool can contain multiple parallel strategies, including Mellow auto and manual positions.
5. Pool-level analytics should coexist with strategy-level and position-level attribution.
6. Residual wallet assets outside LP positions must still count toward the real portfolio value.

