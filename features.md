# The Cab — Features

## Purpose

This document complements the roadmap by describing **The Cab's product features in practical, product-oriented terms**.

It is not a replacement for the roadmap.  
The roadmap explains **sequencing and implementation phases**.  
This document explains **what the product does**, **why each feature matters**, and how the latest architectural decisions affect the intended functionality.

---

## Product definition

**The Cab** is a wallet-connected analytics application for **Base** that reconstructs and explains the real economic performance of activity in **Aerodrome** and the relevant **Mellow** integration.

The Cab is **not** a trading terminal and **not** a raw transaction viewer.

Its purpose is to take wallet activity, reconstruct what actually happened economically, and show the user:

- how much capital is deployed
- where that capital is deployed
- how it changes over time
- how value moves between pools and strategies
- what remains idle in the wallet
- what came from rewards, swaps, rebalances, locks, and votes
- what the portfolio and each pool are worth over time

---

## Core product principle

A key clarification from product discovery is this:

**The Cab remains the reconstruction engine and source of semantic truth.**  
External APIs are used to obtain already indexed wallet activity and bootstrap data quickly, so the app does not need to scan Base from block 0 in the user-facing runtime path.

This changes the intended functionality in an important way:

- **Providers are discovery and bootstrap layers**
- **The Cab is the system that interprets, classifies, reconstructs, values, and explains**

That means the app should not be designed around a raw transaction list.  
It should be designed around **historical portfolio reconstruction**.

---

## What “portfolio” means in The Cab

In this product, “portfolio” is broader than wallet balances.

The portfolio includes:

1. **Capital deployed in Aerodrome/Mellow**
   - manual LP positions
   - Mellow strategy exposure
   - pool-specific capital over time

2. **Idle and residual balances**
   - tokens left after rebalances
   - undeployed leftovers
   - dust and partial balances that still belong to the wallet’s economic state

3. **Rewards and governance-related state**
   - AERO claims
   - locks / veAERO state
   - votes and governance-related actions

4. **Historical economic evolution**
   - total portfolio value over time
   - deployed capital by pool over time
   - value shifts between pools after rebalances
   - effects of claims, swaps, withdrawals, redeployments, and leftovers

A user should be able to rebalance positions, claim rewards, move capital from one pool to another, and still see the **true historical evolution** of both the portfolio and each pool.

---

## Product features

## 1. Connected wallet analysis

The Cab analyzes **one connected wallet at a time** on **Base**.

Main capabilities:
- connect wallet through browser-compatible wallet flow
- validate the chain context is Base
- create or reuse a session for that wallet
- load the wallet’s historical and current economic state

This is the entry point to the product.

---

## 2. Fast wallet bootstrap

When the user connects a wallet, the app should show something useful quickly.

This feature exists to avoid an unusable experience where the app tries to parse the entire blockchain from genesis before showing anything.

Expected behavior:
- fetch a fast wallet bootstrap snapshot
- load recent relevant activity
- show initial portfolio state as soon as possible
- continue deeper reconstruction through throttled or user-initiated refresh when needed

This is where indexed providers help.

Indexed providers are used for:
- wallet history discovery
- transfer and activity discovery
- balances and positions bootstrap
- reducing time-to-first-meaningful-view

They are **not** the final truth for Aerodrome semantics.

---

## 3. Indexed wallet activity discovery

The app must retrieve the wallet’s relevant activity history without scanning Base from block 0.

This discovery layer should be capable of finding:
- wallet transaction history
- token receives and sends
- Aerodrome-related interactions
- Mellow-related interactions
- governance-related interactions such as claims, locks, and votes

This layer is about **finding candidate activity quickly**.

It is not yet the accounting or interpretation layer.

---

## 4. Relevant transaction filtering

Not every wallet interaction matters for The Cab’s analytics.

The app must identify which transactions are relevant to the product model, including:
- Aerodrome position management
- Aerodrome staking / unstaking
- reward claims
- swaps associated with rebalances
- Mellow deposits and withdrawals
- external funding and external withdrawals
- locks and votes
- token receipts that affect economic position

The purpose is to reduce noise and isolate the events that matter for reconstruction.

---

## 5. Contract and protocol identification

The Cab should be able to classify contracts as intelligently as possible.

Examples:
- ERC20 token contracts
- Aerodrome pools/pairs
- position manager / LP NFT contracts
- gauges
- voter contracts
- lock / veAERO-related contracts
- Mellow wrapper or staking contracts

This identification should be layered:
- known allowlists for protocol-critical contracts
- provider/explorer metadata where available
- interface probing
- factory relationship checks
- fallback to unknown/unsupported classification when certainty is insufficient

This feature supports autonomous parsing without pretending every unknown contract is understood.

---

## 6. Transaction hydration

Once relevant activity is discovered, The Cab should hydrate that activity with richer chain data.

Hydration includes:
- receipts
- logs
- traces when necessary
- contract reads
- token metadata
- pool metadata

This is where RPC becomes important:
- not for discovery from block 0
- but for **fine-grained protocol interpretation**

---

## 7. Canonical reconstruction engine

This remains the heart of The Cab.

From hydrated activity, the app reconstructs a canonical internal history of what actually happened.

Core outputs include:
- canonical ledger events
- asset movements
- pools
- strategies
- position instances
- residual / unallocated balances
- discarded or unsupported events

This feature transforms discovered activity into **economic facts**.

Examples:
- distinguishing a new position from added liquidity
- separating Mellow exposure from manual LP activity
- recognizing claim / unstake / withdraw / swap / reopen sequences
- tracking value that leaves one pool and enters another

---

## 8. Pool-first portfolio model

The Cab is not just a wallet tracker.  
It is a **pool-first economic model**.

That means:
- pools are major analytical containers
- strategies live inside pools
- positions are finite lifecycle entities inside strategies
- portfolio totals are built from those structures plus idle balances

This lets the app answer questions like:
- how much capital is in each pool?
- how did that change over time?
- how much moved from one pool to another?
- what is left undeployed?

---

## 9. Strategy separation inside a pool

A single pool may contain multiple parallel strategies.

For example:
- manual LP positions
- Mellow auto strategy

The Cab must keep these separate.

Why this matters:
- the user may have a long-lived Mellow strategy
- and also manual LP positions in the same pool
- those should not be merged into one indistinct number

The product must show:
- strategy-specific value
- strategy-specific performance
- pool-level aggregation that still reconciles correctly

---

## 10. Position lifecycle tracking

Manual Aerodrome positions must be tracked as real lifecycle entities.

The app needs to understand:
- when a position opens
- when liquidity is increased
- when it is reduced
- when it is closed
- when value is withdrawn
- when it is reopened in another form or another pool

This is essential because the user’s real experience is lifecycle-based, not transaction-list-based.

---

## 11. Historical portfolio reconstruction

This is one of the most important product features.

The Cab should reconstruct the portfolio **through time**, not just show current balances.

That means showing:
- total portfolio value over time
- deployed capital by pool over time
- changes caused by rebalances
- shifts of value between pools
- rewards entering the wallet
- leftovers remaining idle
- wallet-level and pool-level state after each meaningful operation

This is the feature that turns the app from a transaction parser into a true analytics product.

---

## 12. Historical pool capital tracking

A specific product requirement is tracking **how much capital is deposited in each pool over time**.

Example:
- pool A had 178
- after rebalance it has 172
- pool B had 58
- after redeploy it has 64
- some value moved from one pool to another
- some tokens remained outside both pools
- AERO rewards were claimed separately

The Cab must show that kind of evolution graphically and numerically.

This is more specific than total portfolio value and is one of the product’s defining features.

---

## 13. Rewards, claims, locks, and votes

The app must understand and expose Aerodrome-specific economic activity beyond simple deposits.

That includes:
- claims
- AERO received
- locks / veAERO-related actions
- vote-related actions
- their effect on wallet state and portfolio history

Even if not every governance metric is fully analyzed at first, these events must be discoverable and representable in the reconstructed portfolio history.

---

## 14. Pricing and valuation

Once the canonical history exists, The Cab assigns value.

This includes:
- historical event-time pricing
- current pricing
- normalization to USD/USDC
- valuation of open exposure
- valuation of idle and residual balances
- explicit handling of partial or missing price coverage

This layer exists to answer:
- what was this worth when it happened?
- what is it worth now?
- how much of the portfolio can be priced with confidence?

---

## 15. Portfolio accounting

With valuation in place, The Cab calculates:
- capital entered
- capital withdrawn
- realized PnL
- unrealized PnL
- total current portfolio value
- pool-level accounting
- strategy-level accounting
- position-level accounting where continuity is reliable

This feature gives the user economically meaningful totals instead of just raw activity.

---

## 16. Attribution engine

After accounting, the app should explain **why** the numbers changed.

This includes separating:
- rewards / claims
- price movement of assets
- swap realization
- rebalance effects
- capital-flow-neutral performance

This is the layer that explains:
- did I actually lose money?
- did value just move from one pool to another?
- how much came from rewards?
- how much was realized through rebalancing?

---

## 17. Graph-ready time series

The product should produce time series suitable for charts.

At minimum:
- total portfolio value over time
- deployed capital by pool over time
- strategy-level value over time
- major event markers such as claims, rebalances, locks, votes, and position closures

This is not just a UI detail.  
It is an output of the reconstruction model itself.

---

## 18. Idle and residual balance awareness

The app must not “lose” capital that is sitting outside active LP positions.

That includes:
- leftover tokens after rebalances
- partially undeployed funds
- rewards not yet redeployed
- dust and other residual balances

These must remain visible and must still contribute to portfolio truth.

---

## 19. Explainability and traceability

Users must be able to trust the numbers.

That means major outputs should remain explainable via:
- underlying canonical events
- price inputs
- pool/strategy/position relationships
- trace references to the wallet activity that caused the state

The app should support drill-downs and provenance, not just final totals.

---

## 20. Discarded and unsupported activity review

Not everything will be confidently understood.

The Cab should:
- mark unsupported or suspicious activity explicitly
- exclude it from trusted analytics when appropriate
- still allow it to be reviewed

This supports trust without forcing fake certainty.

---

## 21. Dashboard and reporting layer

After the core reconstruction/accounting layers are solid, The Cab can provide richer views:
- portfolio overview
- pool detail
- strategy detail
- position lifecycle detail
- event timeline
- historical charts
- PnL breakdown views

These views should consume the reconstructed and valued data, not invent their own logic.

---

## 22. Operational intelligence

Later features include:
- out-of-range awareness
- position productivity status
- recognition of rebalance sequences
- pool operational summaries
- alerts and notifications

These should be built on the existing semantic and accounting layers.

---

## Functional architecture impact of recent decisions

The latest architectural clarification affects the product in a major way:

### The Cab should not depend on raw chain scanning for production discovery
The app’s intended behavior is:
- use indexed providers to find wallet activity quickly
- use RPC only to hydrate already discovered relevant transactions
- keep The Cab’s own reconstruction engine as the semantic authority

### The product is not built around a tx list
A transaction list may exist as a debug or audit surface, but it is **not the product center**.

The center is:
- historical portfolio state
- capital deployed by pool
- strategy evolution
- rewards and governance-related flows
- accounting and explainability

### Immediate usability matters
After wallet connection, the app should provide:
- a meaningful initial snapshot quickly
- then increasingly complete reconstruction and enrichment
- without forcing the user to wait for a full chain scan

---

## MVP-oriented feature set

A practical MVP of The Cab should include:

- wallet connection on Base
- indexed wallet activity discovery
- protocol-aware candidate filtering
- canonical reconstruction for Aerodrome + relevant Mellow activity
- pool and strategy modeling
- historical pricing and current valuation
- capital in / capital out
- realized / unrealized PnL
- idle balance inclusion
- total portfolio value
- deployed capital by pool
- graph-ready portfolio and pool history
- claims / locks / votes / positions represented in the timeline
- basic explainability and discarded-activity review

---

## Features intentionally not central to the MVP

These can exist later, but they are not the heart of the product:

- generic raw transaction explorer UX
- broad multi-chain support
- direct transaction execution
- heavy export surface
- advanced notifications before reconstruction and accounting are solid

---

## Summary

The Cab is a **historical portfolio reconstruction and analytics engine** for Aerodrome and relevant Mellow activity on Base.

Its distinguishing features are:

- wallet-connected, pool-first analysis
- indexed discovery plus protocol-aware reconstruction
- strategy separation inside pools
- position lifecycle tracking
- historical deployed-capital tracking by pool
- full portfolio value history
- rewards, claims, locks, votes, and residual-balance awareness
- pricing, accounting, attribution, and explainability built on top of the same canonical history

This document should be read together with the roadmap:

- the **roadmap** explains implementation order
- this **features** document explains the desired product behavior and product meaning
