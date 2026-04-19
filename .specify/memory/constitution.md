<!--
  Sync Impact Report
  ==================
  Version change: 1.1.0 → 1.1.1
  Bump rationale: PATCH - clarifies and operationalizes existing principles
    (deterministic classification, pool-first attribution edge cases,
    durable Mellow modeling language, and delivery-path flexibility)
    without adding/removing/redefining constitutional scope.
  Modified principles:
    - II. "Pool-First Analysis" (expanded with explicit residual/
      unallocated portfolio bucket guidance)
    - IV. "Position Lifecycle Integrity" (Mellow wording made more
      durable and less implementation-tactical)
    - V. "Deterministic Event Classification" (allows deterministic,
      explicit, versioned, test-covered heuristics)
    - XIV. "Spec-Driven Delivery Discipline" (strict for production
      path, allows clearly labeled non-production exploratory artifacts)
  Added sections: none
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ reviewed (no changes needed)
    - .specify/templates/spec-template.md ✅ reviewed (no changes needed)
    - .specify/templates/tasks-template.md ✅ reviewed (no changes needed)
    - .specify/templates/checklist-template.md ✅ reviewed (no changes needed)
  Follow-up TODOs: none
-->

# The Cab Constitution

## Core Principles

### I. Ledger-First Truth

All analytics MUST derive from a canonical ledger of normalized events
reconstructed deterministically from onchain data. The ledger is the
single source of truth for every reported metric. No dashboard value,
performance figure, or attribution claim may exist without a traceable
path back to one or more ledger events and their underlying asset
movements.

### II. Pool-First Analysis

Pools are the primary analytical grouping unit. Every strategy,
position, capital flow, reward, and valuation SHOULD be attributable
to a specific pool when attribution confidence is sufficient.
Pool-level aggregation MUST always be available alongside
strategy-level and position-level detail.

When exact pool attribution is not confidently derivable, assets MUST
still be represented through an explicit residual bucket (for example,
`unallocated`, `residual`, or portfolio-level holdings). This bucket
MUST include idle wallet assets, rebalance leftovers, and other
residual balances, and MUST remain included in total portfolio value.

### III. Strategy Isolation

Within a single pool, each distinct participation method MUST be
modeled as a separate strategy. Manual concentrated-liquidity
positions and Mellow automated strategies MUST never be merged in
detailed accounting, performance attribution, or lifecycle tracking.
Combined views are permitted only as explicit aggregations that
preserve the ability to decompose back to individual strategies.

### IV. Position Lifecycle Integrity

Every deposit or exposure instance MUST be tracked as a finite
lifecycle entity with an explicit beginning, evolution, and end.
For manual Aerodrome concentrated-liquidity positions, the position
NFT `tokenId` is the primary identity:
- A `mint()` call MUST create a new position entity.
- An `increaseLiquidity()` call on an existing `tokenId` MUST extend
  that position entity without creating a new one.
For Mellow exposure, the position instance MUST be modeled as a
strategy-specific lifecycle entity aligned to wrapper-level and
staking-level strategy semantics, not as if the user owned a manual
LP NFT per deposit.

### V. Deterministic Event Classification

Every onchain transaction and log relevant to the connected wallet
MUST be classified into a canonical event type using deterministic,
reproducible rules. Classification MUST rely on onchain call
semantics and contract interaction patterns as the primary basis.
Deterministic heuristics are permitted only when they are explicitly
defined, versioned, and covered by automated tests. Heuristics MUST
NOT introduce run-to-run variance: given the same inputs, the same
classification output MUST be produced. The `IncreaseLiquidity`
event, for example, MUST be disambiguated by whether the originating
call was `mint()` or `increaseLiquidity()`.

### VI. Automatic Classification and Source Immutability

The system MUST classify all transactions automatically without
requiring manual user intervention under normal operation.
Ambiguous, invalid, or unrecognizable events MUST be handled
automatically through the discarded-event mechanism defined in
Principle VII.

Raw onchain observations — transactions, logs, and decoded event
data — MUST be stored immutably once ingested. No process,
override, or correction may alter the source event records.

If manual reconciliation capabilities are introduced in the future,
they MUST be implemented as an auditable override layer above the
immutable source data. Overrides MUST record the original
classification, the replacement classification, a reason, and a
timestamp. The system MUST be able to revert to the automatic
classification at any time by removing the override. Analytics
MUST clearly distinguish between automatically classified events
and manually overridden events.

### VII. Explicit Handling of Untrusted Transactions

Transactions that are malicious, unsupported, ambiguous, or invalid
MUST be detected, labeled with a reason, and excluded from sensitive
analytics. These events MUST be stored in a `DiscardedEvent` record
with a `reasonType` and `reasonMessage`. The user MUST be able to
review discarded events, but such events MUST NOT distort capital
flow calculations, PnL figures, or attribution metrics.

### VIII. Historical Pricing Fidelity

Every asset movement MUST be valued in USD at the time of the event
using the best available historical price source. The pricing source,
resolution, and confidence level MUST be recorded alongside the
valuation. Current holdings MUST be valued at present prices. When
price data is missing or unreliable, the system MUST degrade
gracefully by marking the affected valuations with reduced confidence
rather than silently using a fallback.

### IX. Economic Explainability

Every metric displayed to the user MUST be explainable by drilling
down to the underlying events, asset movements, and pricing data
that produced it. No reported figure may be a black box. The system
MUST support navigation from any dashboard metric to its constituent
ledger events and asset movements.

### X. Performance Attribution Decomposition

The system MUST decompose investment performance into the following
independently reportable components:
- Capital deposited (external inflows)
- Capital withdrawn (external outflows)
- Realized PnL (crystallized gains and losses)
- Unrealized PnL (embedded in open positions and held assets)
- Asset price movement effects (appreciation or depreciation of
  underlying tokens)
- Rewards and claims income (staking rewards, fee collection,
  incentive claims)
- Realized swap and rebalance effects (gains or losses from closing,
  swapping, and reopening positions)

Capital deposits and withdrawals MUST NOT distort strategy-level
performance metrics.

### XI. Portfolio Completeness

Total portfolio value MUST include all relevant holdings of the
connected wallet: active LP positions, staked balances, uncollected
rewards, and idle or unallocated token balances remaining after
rebalances or partial redeployments. No asset that belongs to the
wallet and falls within the product scope may be omitted from the
portfolio total.

### XII. Auditability, Reproducibility, and Testability

The entire analytics pipeline — from raw onchain data through
normalization, pricing, and metric computation — MUST be
deterministic and reproducible. Given the same onchain state and
price data, reprocessing MUST produce identical results. Every
layer of the pipeline MUST be independently testable with
well-defined inputs and expected outputs.

### XIII. Analytics-Only Boundary

The Cab is strictly an analytics and reporting product. It MUST NOT
submit onchain transactions, manage private keys, or execute
strategy actions on behalf of the user. The application observes and
interprets; it does not act. Any future extension toward execution
capabilities MUST be treated as a constitutional amendment.

### XIV. Spec-Driven Delivery Discipline

Production-path product development (including any merge-intended
feature implementation) MUST follow the Spec-Driven Development
workflow: constitution → specification → plan → tasks →
implementation → testing. No merge-intended feature implementation
may begin without a ratified specification and approved plan.

Research artifacts, spikes, and exploratory prototypes MAY exist
outside this workflow only when they are clearly identified as
non-production and non-merge-intended. Such exploratory work MUST NOT
be used to bypass constitutional requirements for merged product work.

## Scope Constraints

The following scope constraints govern all specifications, plans,
and implementations under this constitution:

- **Protocol scope**: Aerodrome on Base and its relevant Mellow
  integration. No other chains, DEXes, or DeFi protocols are in
  scope unless a constitutional amendment expands it.
- **Wallet model**: Exactly one connected wallet is analyzed at a
  time, connected via WalletConnect. Multi-wallet aggregation is
  out of scope.
- **Reporting currency**: USD/USDC is the primary valuation base
  for all analytics.
- **Platform**: The product is a Next.js web application.
- **Target user**: Advanced DeFi users. The product optimizes for
  accuracy, power, traceability, and explainability over
  mass-market simplicity.

## Domain Model Constraints

The following structural rules govern the domain model and MUST be
respected by all specifications and implementations:

- A **Pool** is the top-level analytical container, grouping all
  strategies, positions, and capital flows for a given trading pair
  and venue.
- A **Strategy** represents a distinct participation method within a
  pool. At minimum, the system MUST support `manual` and
  `mellow_auto` strategy types.
- A **PositionInstance** represents a finite lifecycle deposit or
  exposure within a strategy.
- Manual position identity is determined by the Aerodrome NFT
  `tokenId`. `mint()` opens a new instance; `increaseLiquidity()`
  extends an existing one.
- Mellow exposure MUST be modeled as a distinct strategy under the
  same pool, not merged into the manual strategy.
- The hierarchy is: Portfolio → Pool → Strategy → PositionInstance →
  LedgerEvent → AssetMovement.

## Governance

This constitution is the supreme governing document for The Cab.
All specifications, plans, tasks, and implementations MUST comply
with its principles and constraints.

- **Precedence**: Where any other artifact conflicts with this
  constitution, the constitution prevails.
- **Amendment procedure**: Amendments MUST be documented with a
  version bump, a rationale, and an impact assessment. Amendments
  that remove or redefine existing principles require a MAJOR
  version increment. New principles or material expansions require
  a MINOR increment. Clarifications and non-semantic refinements
  require a PATCH increment.
- **Compliance review**: Every specification and plan MUST include
  a constitution compliance check before implementation begins.
- **Versioning**: This constitution follows semantic versioning
  (MAJOR.MINOR.PATCH).

**Version**: 1.1.1 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-18
