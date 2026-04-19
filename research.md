# The Cab — Product Discovery Context

## Purpose

This document summarizes the remaining context gathered during the current product discovery conversation for **The Cab**, excluding the protocol-mechanics deep dive that is captured separately in `aerodrome-mellow-research.md`.

It focuses on:

- product intent
- scope
- user goals
- analytical requirements
- architecture direction
- modeling decisions made so far

---

## 1. Product name and framing

The product name is:

**The Cab**

The name references the jargon of aerodrome control towers and evokes the idea of a control cabin / monitoring center.

That framing is especially appropriate because the product is not meant to execute transactions directly, but to act as a **control and analytics interface** for the user’s DeFi activity.

---

## 2. Product purpose

The Cab is a web application intended to help the user understand the **true economic performance** of their investments in **Aerodrome on Base**, including relevant **Mellow integration** activity.

The core problem is that manual inspection of wallet balances and transaction history is insufficient to understand whether the user actually made money or lost money across:

- liquidity deposits
- staking
- claims
- swaps to USDC
- rebalances
- out-of-range concentrated liquidity positions
- leftover wallet balances

The user wants a system that reconstructs those flows and shows real investment performance.

---

## 3. Target user

Initial target:

- primarily the user
- possibly a small group of advanced users later

This means:

- the product does not need mass-market simplification in the first version
- it can optimize for accuracy, power, traceability, and advanced interpretation

---

## 4. Scope

The initial product scope is strictly limited to:

- **Aerodrome on Base**
- its relevant **Mellow integration**

Not in initial scope:

- other chains
- other DEXes / DeFi protocols
- direct transaction execution from the app

Possible later scope:

- notifications such as out-of-range warnings or voting reminders

---

## 5. Wallet model

The product should:

- connect **one wallet at a time**
- use **WalletConnect**
- analyze the currently connected wallet as the active context

There is no current requirement for multi-wallet aggregation.

---

## 6. Platform direction

The Cab should be built first as a:

- **web app**
- likely using **Next.js**

This was chosen as the simplest and most practical direction for the first implementation.

---

## 7. Analytics-only boundary

The Cab is intended to be an **analytics product**, not an execution layer.

This means:

- positions are opened/closed elsewhere, such as in Aerodrome
- the app observes and interprets wallet activity
- the app may later send notifications
- the app does not submit strategy transactions as part of the MVP

---

## 8. Core user problem in detail

The user described the key difficulty as follows:

When providing concentrated liquidity in Aerodrome:

- a position may go out of range
- it stops earning in the intended way
- the user may unstake, withdraw, swap assets, rebalance, and reopen
- one side of the pair may dominate due to range drift and market movement
- there may be impermanent loss or realized loss during rebalance
- some balances may remain undeployed after reopening

Because of all those transitions, it becomes difficult to answer:

- did I actually make money?
- how much came from rewards?
- how much came from asset price movement?
- how much was lost or realized in rebalance?
- how much capital did I really put in and take out?

The Cab exists to answer those questions.

---

## 9. Required metrics

The user explicitly requested that the product surface these metrics:

### 9.1. Capital entered

How much capital was actually contributed into the investment system.

### 9.2. Capital withdrawn

How much capital was withdrawn externally.

Important requirement:

- external withdrawals should not be misclassified as economic losses

### 9.3. Realized PnL

How much gain/loss has already been crystallized.

### 9.4. Unrealized PnL

How much gain/loss remains embedded in open positions or still-held assets.

### 9.5. Estimated annualized return

An estimated annual yield/return percentage derived from deposited capital and realized gains.

### 9.6. Attribution by source

The user wants to separate:

- gains/losses from asset price movement
- gains from claims / rewards
- gains realized through swaps to USDC
- realized loss/effects during rebalance

### 9.7. Current total portfolio value

The app must show total current portfolio value including:

- deposited positions
- strategy balances
- idle token balances that remain in the wallet after rebalances or partial redeployments

---

## 10. Rules for external transfers

The user wants deposits to and withdrawals from the wallet to be tracked distinctly from strategy performance.

This means:

- incoming wallet transfers relevant to investment funding should be recognized as **external deposits / capital in**
- outgoing wallet transfers should be recognized as **external withdrawals / capital out**
- neither should distort pure strategy PnL

---

## 11. Rules for manual classification and bad transactions

The user does **not** want the system to require manual intervention for ambiguous transaction classification.

Instead:

- suspicious, malicious, invalid, or unsupported transactions should be marked accordingly
- such events should be discarded from sensitive analytics when necessary

This implies a product principle of:

- automatic deterministic classification
- no manual reconciliation requirement in the MVP

---

## 12. Key modeling evolution during discovery

At first, a “strategy thread” concept was considered.

The model evolved into a clearer structure:

### 12.1. Pool is the higher-level container

The pool is the main analytical parent.

### 12.2. Strategies live inside pools

A pool may contain multiple parallel strategies, such as:

- Mellow automatic strategy
- manual LP strategy

### 12.3. Deposit / position instances remain finite lifecycle entities

Each deposit or position still needs its own start, evolution, and end.

This structure better reflects how the user thinks about investment performance:

- “How did this pool do overall?”
- “How did Mellow do vs my manual positions?”
- “What happened in each deposit lifecycle?”

---

## 13. Specific product interpretation of Mellow

The user explicitly clarified that Mellow should be:

- treated as a **separate strategy**
- but still **grouped under the same pool**

Typical usage pattern described:

- a long-lived Mellow auto deposit remains active
- profits may be withdrawn from time to time
- meanwhile, a manual deposit in the same pool may be opened in parallel because the Mellow vault no longer accepts additional capital

This means the app must allow:

- same pool
- multiple strategies in parallel
- separate tracking
- combined aggregation

---

## 14. Product-level principles inferred so far

The following principles were effectively established during discussion:

1. **ledger-first truth**
2. **pool-first analysis**
3. **strategy isolation inside pools**
4. **position lifecycle integrity**
5. **automatic deterministic classification**
6. **no manual reconciliation requirement**
7. **USD-centric valuation**
8. **historical pricing fidelity**
9. **economic attribution clarity**
10. **portfolio completeness**
11. **single-wallet active context**
12. **analytics-only boundary**
13. **scope discipline**
14. **spec-driven delivery**

These are suitable candidates for a formal constitution document.

---

## 15. Architecture direction inferred so far

Even before formal spec writing, the product points clearly toward these layers:

### 15.1. Wallet connection layer

For connecting and identifying the wallet context.

### 15.2. Onchain ingestion layer

For pulling relevant Base activity and protocol interactions.

### 15.3. Normalization / ledger layer

For converting raw transactions/logs into canonical events.

### 15.4. Pricing layer

For historical and current asset valuation in USD/USDC.

### 15.5. Performance engine

For deriving:
- capital in
- capital out
- realized PnL
- unrealized PnL
- reward contribution
- asset price contribution
- rebalance contribution
- annualized return estimate

### 15.6. Reporting / dashboard layer

For showing portfolio, pool, strategy, and position-level views.

---

## 16. Product development direction

The app is intended to be developed using:

- **Spec-Driven Development**
- **SpecKit**
- constitution -> spec -> plan -> tasks -> implementation -> tests

This means product discovery should produce:

- a clear constitution
- a domain glossary
- a feature roadmap
- a first foundational spec

---

## 17. Suggested first foundational feature

The conversation converged on the idea that the first foundational feature should not be UI-heavy.

Instead, the most important initial feature is:

### Canonical Investment Ledger

A system capable of reconstructing from a connected wallet:

- pools
- strategies
- position instances
- capital flows
- rewards
- swaps
- current holdings

Without this, later dashboards would not be trustworthy.

---

## 18. Summary

The Cab is shaping up as a specialized analytics web app for advanced Aerodrome users on Base.

Its defining requirements are:

- real economic truth rather than superficial wallet balances
- pool-level aggregation
- manual vs Mellow separation inside pools
- finite deposit/position lifecycle tracking
- capital flow clarity
- performance attribution by source
- inclusion of idle assets in real portfolio value
- deterministic analytics driven by onchain data and historical prices

