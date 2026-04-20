# Research: Pricing and Portfolio Accounting Engine

## Decision 1: Add dedicated `pricing` and `accounting` domains above the canonical ledger

- **Decision**: Implement a separate `pricing` domain for external price acquisition and normalized price-point storage, and a separate `accounting` domain for valued movements, current holdings valuation, inventory logic, and snapshot assembly.
- **Rationale**: The canonical ledger is already the authoritative source of normalized activity. Pricing and accounting are different responsibilities and should remain above it rather than leaking valuation logic into normalization services or ledger projection services.
- **Alternatives considered**:
  - Extend the existing ledger domain directly with pricing and accounting logic: rejected because it would blur source-of-truth normalization with downstream valuation.
  - Put price acquisition directly in route handlers: rejected because it would make contracts and testing brittle and non-reusable.

## Decision 2: Use a provider-agnostic external price source boundary with one initial HTTP adapter

- **Decision**: Introduce a `PriceProvider` interface and implement one initial HTTP adapter capable of both historical and current token pricing for the Base-supported assets already emitted by canonical ledger asset movements.
- **Rationale**: The feature needs concrete current and historical pricing, but the domain should not depend directly on any single vendor response shape. The provider interface keeps the plan concrete while preserving replacement flexibility.
- **Alternatives considered**:
  - Build pricing from onchain pools and swaps immediately: rejected because it adds attribution-style complexity and protocol-specific routing beyond the scope of the first accounting layer.
  - Hardcode token prices or rely on fixtures: rejected because it violates the analytics and pricing fidelity goals.

## Decision 3: Persist normalized price points in PostgreSQL and reuse them across reads

- **Decision**: Store normalized price points in PostgreSQL with token identity, quote currency, effective time, fetched time, source metadata, and confidence metadata. Historical and current prices share the same model.
- **Rationale**: Persisted price inputs are required for explainability, reproducibility, and acceptable performance. Using one normalized model avoids split logic between “historical” and “current” stores.
- **Alternatives considered**:
  - Fetch prices fresh on every accounting request: rejected because it is slower, less reproducible, and harder to audit.
  - Persist only final accounting outputs: rejected because traceability requires the underlying price inputs to remain inspectable.

## Decision 4: Value movements at ledger-record time, not raw-observation time

- **Decision**: Historical valuation uses the canonical ledger record timestamp as the event-time anchor. Price selection uses the nearest acceptable point at or before the event timestamp within a deterministic window; if no such point exists, the service may use a bounded fallback window with reduced confidence or mark the movement unpriced.
- **Rationale**: The canonical ledger record is the product’s trusted business event boundary. Using raw observation time would reintroduce a lower-level interpretation layer that the constitution says later analytics must not depend on.
- **Alternatives considered**:
  - Value from raw transaction timestamp or log timestamp independently of the ledger record: rejected because it bypasses the canonical event boundary.
  - Use any nearest historical price regardless of time distance: rejected because it hides material uncertainty.

## Decision 5: Normalize to USD with explicit alias and stable-value rules only

- **Decision**: Use normalized USD as the internal accounting denomination and present it as USD/USDC-normalized output. Direct token-to-USD prices are preferred. If unavailable, fall back only through explicit token alias rules such as wrapped-native aliases or approved USD-stable aliases. No arbitrary inferred cross-token route is allowed in this feature.
- **Rationale**: The feature needs explainable normalization, not a shadow routing engine. Explicit alias rules are deterministic and auditable; arbitrary cross-token routing is not.
- **Alternatives considered**:
  - Infer prices from DEX paths dynamically: rejected because it is effectively a pricing engine and attribution engine of its own.
  - Treat all stable-value assets as exactly $1 without qualification: rejected because pricing confidence and depeg risk must remain explicit.

## Decision 6: Publish partial totals instead of suppressing outputs or forcing zero values

- **Decision**: When price coverage is incomplete, publish totals for the priced portion only and explicitly disclose excluded or unpriced portions at movement, holding, scope, and portfolio levels.
- **Rationale**: This matches the clarified specification, preserves usability, and prevents the false certainty of zero valuation or silent omission.
- **Alternatives considered**:
  - Suppress totals entirely when any portion is unpriced: rejected because it makes the feature less useful than necessary.
  - Treat unpriced assets as zero: rejected because it silently distorts trusted outputs.
  - Carry forward stale prices indefinitely: rejected because it overstates confidence.

## Decision 7: Separate event-time valuation from current holdings valuation

- **Decision**: Build one service for valued ledger movements at event time and a separate service for current holdings valuation over open exposure, residual holdings, and idle wallet balances.
- **Rationale**: Historical flow valuation and present-day valuation solve different business questions and must stay distinguishable in both outputs and tests.
- **Alternatives considered**:
  - Use one valuation pass for both historical and current outputs: rejected because it would blur timing semantics and increase ambiguity.

## Decision 8: Use deterministic weighted-average cost inventory per analytical scope

- **Decision**: Use weighted-average cost inventory by scope (`portfolio`, `pool`, `strategy`, and reliable `position`) to compute realized and unrealized PnL. Deposits create basis and capital-in. Dispositions reduce inventory and may realize gains or losses relative to carrying basis. Fees and rewards are recognized as realized PnL at their event-time value.
- **Rationale**: Weighted-average cost is deterministic, simpler than FIFO for LP-style flows, and precise enough for the first reusable accounting layer.
- **Alternatives considered**:
  - FIFO or lot-exact tax accounting: rejected because it adds complexity beyond the current product goal.
  - Net-PnL-only outputs with no realized/unrealized split: rejected because the feature explicitly requires both.

## Decision 9: Track capital flows alongside inventory so withdrawals do not distort performance

- **Decision**: External deposits and external withdrawals are always tracked as capital flows in parallel with inventory changes. Withdrawals may crystallize embedded gains or losses through disposal accounting, but the withdrawn amount itself remains capital out rather than profit.
- **Rationale**: This is the only way to satisfy both the accounting identity and the product rule that external funding flows must not be confused with performance.
- **Alternatives considered**:
  - Treat withdrawals only as capital out with no realized effect: rejected because it breaks realized/unrealized reconciliation once appreciated or depreciated assets leave scope.
  - Treat all withdrawals as realized PnL: rejected because it incorrectly classifies principal return as performance.

## Decision 10: Generate accounting snapshots on read from accepted ledger data plus persisted price points

- **Decision**: Do not persist standalone accounting snapshots in v1. Build the accounting snapshot on read from the latest accepted ledger run, persisted historical price points, and fresh or cached current price points, and return an `asOf` timestamp plus trace references in the contract.
- **Rationale**: Current value is time-sensitive, and snapshot-on-read avoids introducing a second background materialization system before the core accounting model is proven.
- **Alternatives considered**:
  - Persist every accounting snapshot: rejected because it adds operational complexity and snapshot invalidation problems for current prices.
  - Compute directly from the provider without storing price inputs: rejected because it harms explainability and reproducibility.

## Decision 11: Expose a versioned accounting read contract from the wallet session boundary

- **Decision**: Add `GET /api/analysis-sessions/{sessionId}/accounting` as the versioned application contract for pricing and accounting outputs, returning portfolio totals, pool or strategy or position breakdowns, idle balances, coverage summaries, and trace references.
- **Rationale**: The connected-wallet flow already uses the wallet session as the stable boundary for accepted ledger outputs, so accounting should extend that same session-backed read model.
- **Alternatives considered**:
  - Publish accounting only as an internal server service with no explicit contract: rejected because downstream dashboards need a stable read surface.
  - Add many narrowly scoped accounting endpoints immediately: rejected because the first slice should establish one reusable hierarchical contract.