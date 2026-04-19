# The Cab — Product Roadmap and Feature List

## Purpose

This roadmap describes the full product feature progression for **The Cab**, from foundational infrastructure through complete analytics coverage.

It is intentionally written in a Spec-Driven Development friendly format so it can later be broken down into:

- constitution
- feature specs
- plans
- tasks

---

## Product goal

Build a web app that reconstructs and explains the true economic performance of a connected wallet’s activity in **Aerodrome on Base**, including relevant **Mellow** participation, with analytics centered on:

- pool-level aggregation
- strategy-level separation
- deposit/position lifecycle tracking
- real capital-flow-aware performance
- USD-based valuation and attribution

---

# Phase 0 — Product foundation

## F-000. Product constitution
Define the core principles of the product:

- ledger-first truth
- pool-first analysis
- strategy isolation
- position lifecycle integrity
- deterministic classification
- USD-centric valuation
- analytics-only boundary
- scope discipline
- spec-driven delivery

## F-001. Domain glossary
Define shared terminology for:

- pool
- strategy
- manual position
- Mellow strategy
- position instance
- rebalance
- capital in/out
- realized/unrealized PnL
- idle assets
- performance attribution

## F-002. Canonical data model
Define the persistent and derived entities required for the app.

---

# Phase 1 — Technical platform setup

## F-003. Next.js application scaffold
Create the initial application shell, project structure, environment handling, and baseline architecture.

## F-004. Wallet connection
Support a single active wallet via WalletConnect.

## F-005. Network and chain validation
Ensure the app only analyzes the intended Base context and handles connection mismatches cleanly.

## F-006. User session shell
Create the baseline application session model for the connected wallet.

---

# Phase 2 — Raw data acquisition

## F-007. Wallet activity ingestion
Ingest relevant onchain activity for the connected wallet on Base.

## F-008. Aerodrome protocol interaction detection
Detect transactions related to Aerodrome concentrated liquidity, staking, rewards, swaps, and related actions.

## F-009. Mellow protocol interaction detection
Detect wrapper/staking/deposit/withdraw/reward activity related to the supported Mellow integration.

## F-010. Token metadata ingestion
Resolve token metadata needed for analytics and display.

## F-011. Historical indexing baseline
Create deterministic indexing state for replayable analysis.

---

# Phase 3 — Canonical ledger engine

## F-012. Canonical event normalization
Convert raw transactions and logs into normalized ledger events.

## F-013. Asset movement extraction
For each ledger event, derive token-level inflows/outflows.

## F-014. External capital flow classification
Detect external deposits and withdrawals at wallet level.

## F-015. Unsupported / malicious transaction handling
Mark suspicious, invalid, or unsupported transactions as discarded for sensitive metrics.

## F-016. Event confidence and traceability
Attach deterministic provenance to every normalized event.

---

# Phase 4 — Pool, strategy, and position modeling

## F-017. Pool identity modeling
Create the pool layer as the main analytical parent.

## F-018. Strategy modeling within pools
Support multiple strategies under the same pool, including:

- manual
- Mellow auto

## F-019. Manual position instance modeling
Track manual concentrated-liquidity deposits as finite lifecycle entities.

## F-020. Manual liquidity extension modeling
Treat `increaseLiquidity` as continuation of an existing manual position instance.

## F-021. Manual position reduction and closure modeling
Track partial and full decreases, collections, and closures.

## F-022. Mellow strategy exposure modeling
Model Mellow exposure as a separate strategy grouped under the same pool.

## F-023. Parallel strategy coexistence
Support manual and Mellow strategies running in parallel within the same pool.

## F-024. Position lifecycle state machine
Formalize states such as:

- open
- partially reduced
- closed
- archived

---

# Phase 5 — Pricing and valuation

## F-025. Historical price provider integration
Integrate external historical price sources for supported assets.

## F-026. Current price resolution
Resolve current prices for all relevant assets.

## F-027. USD/USDC valuation normalization
Standardize all key analytics to USD/USDC.

## F-028. Event-time valuation
Assign historical USD value to every asset movement.

## F-029. Current holdings valuation
Calculate present USD value of all open exposures and idle balances.

## F-030. Price fallback and confidence rules
Define how to handle missing, weak, or approximate pricing.

---

# Phase 6 — Portfolio accounting engine

## F-031. Capital entered calculation
Calculate total external capital contributed.

## F-032. Capital withdrawn calculation
Calculate total external capital removed.

## F-033. Realized PnL engine
Calculate gain/loss already crystallized.

## F-034. Unrealized PnL engine
Calculate gain/loss still embedded in open positions and held assets.

## F-035. Idle asset inclusion
Include undeployed token balances in current portfolio value.

## F-036. Pool-level accounting
Aggregate all relevant value and performance at pool level.

## F-037. Strategy-level accounting
Separate Mellow and manual strategy economics inside the same pool.

## F-038. Position-instance accounting
Measure lifecycle economics of each manual position / Mellow exposure instance.

---

# Phase 7 — Attribution engine

## F-039. Reward attribution
Separate gains from rewards / claims.

## F-040. Asset price movement attribution
Separate gains/losses caused by underlying asset appreciation/depreciation.

## F-041. Swap realization attribution
Separate realized impact from swaps, especially swaps to USDC.

## F-042. Rebalance effect attribution
Track realized gain/loss caused by closing, swapping, and reopening around range management.

## F-043. Capital-flow-neutral performance view
Ensure deposits and withdrawals do not distort strategy performance.

## F-044. Estimated annualized return
Produce an estimated annualized return metric based on deposited capital and realized gains.

---

# Phase 8 — Range and operational intelligence

## F-045. Out-of-range position awareness
Detect or infer when manual concentrated-liquidity positions are out of range.

## F-046. Position productivity awareness
Estimate whether a position is currently productive vs idle.

## F-047. Rebalance sequence recognition
Recognize sequences of close -> swap -> reopen as rebalance flows.

## F-048. Residual balance awareness
Show balances left outside LP after rebalance/reopen.

## F-049. Pool operational state summary
Summarize active, inactive, and recently rebalanced states by pool.

---

# Phase 9 — Dashboard and reporting UX

## F-050. Portfolio overview dashboard
Top-level view of:

- total current value
- capital in/out
- realized and unrealized PnL
- current asset mix

## F-051. Pool list and pool detail views
Allow the user to inspect each tracked pool individually.

## F-052. Strategy detail views
Show manual vs Mellow strategy breakdowns inside each pool.

## F-053. Position lifecycle views
Show lifecycle detail for each deposit/position instance.

## F-054. Event timeline view
Provide an auditable event stream for the connected wallet.

## F-055. Asset balance views
Show current held balances, including idle token balances.

## F-056. Historical performance charting
Plot portfolio, pool, and strategy value through time.

## F-057. PnL breakdown charting
Visualize realized vs unrealized and source-attributed performance.

---

# Phase 10 — Auditability and explainability

## F-058. Drill-down from dashboard metric to events
Allow any major metric to be explained via underlying events.

## F-059. Pricing provenance visibility
Show what pricing source and valuation logic were used.

## F-060. Classification provenance visibility
Show how events were classified and why.

## F-061. Discarded-event review view
Let the user inspect transactions excluded from analytics.

---

# Phase 11 — Exports and utility features

## F-062. CSV export
Export normalized events and relevant computed data.

## F-063. JSON export
Export machine-readable analytics and/or ledger data.

## F-064. Snapshot export
Export summary portfolio/pool/strategy performance states.

---

# Phase 12 — Notifications and monitoring

## F-065. Out-of-range notifications
Warn when a manual position appears out of range.

## F-066. Voting / governance reminders
Support reminders for relevant Aerodrome governance activity if later desired.

## F-067. Strategy monitoring alerts
Notify on major state transitions such as closure, large withdrawals, or unusual inactivity.

---

# Phase 13 — Hardening and product maturity

## F-068. Reindexing and replay safety
Ensure ledger and analytics remain deterministic on reprocessing.

## F-069. Error handling and degraded-mode UX
Gracefully handle missing price data, unsupported transactions, or API issues.

## F-070. Performance optimization
Optimize indexing, valuation, storage, and dashboard responsiveness.

## F-071. Test coverage hardening
Expand tests across normalization, pricing, accounting, attribution, and UI.

## F-072. Production observability
Add operational logging, diagnostics, and failure monitoring.

---

# Suggested spec order

The full product is large. The most sensible spec order is:

1. **Canonical Investment Ledger**
   - ingestion
   - normalization
   - pool/strategy/position identification

2. **Pricing and Portfolio Accounting Engine**
   - historical valuation
   - capital flows
   - realized/unrealized PnL

3. **Pool and Strategy Dashboard**
   - top-level UX
   - drill-down structure

4. **Attribution Engine**
   - asset movement effect
   - rewards effect
   - swap/rebalance effect

5. **Operational Intelligence and Notifications**
   - out-of-range
   - reminders
   - alerts

---

# MVP cut recommendation

A practical MVP would include:

- wallet connection
- Aerodrome + Mellow activity ingestion
- canonical event normalization
- pool/strategy/position modeling
- historical pricing
- current valuation
- capital in/out
- realized/unrealized PnL
- idle asset inclusion
- portfolio overview
- pool detail
- strategy detail
- event timeline

And postpone for later:

- notifications
- advanced operational alerts
- heavy export surface
- broader protocol scope

---

# Summary

This roadmap is meant to support full-product planning while keeping a disciplined Spec-Driven Development sequence.

The Cab should be built from the inside out:

1. truth reconstruction first
2. accounting second
3. dashboards third
4. attribution fourth
5. alerts and polish later

