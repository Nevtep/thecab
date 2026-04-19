# Feature Specification: Pricing and Portfolio Accounting Engine

**Feature Branch**: `003-prepare-feature-spec`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "Create the next feature specification for The Cab. Feature name: Pricing and Portfolio Accounting Engine."

## Clarifications

### Session 2026-04-19

- Q: When some required assets are unpriced, should the system suppress totals, carry forward prices, or publish partial totals? → A: Publish totals for the priced portion only and explicitly disclose unpriced portions as partial coverage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See True Portfolio Economics (Priority: P1)

For one connected wallet on Base, the user can see current total portfolio value in USD, capital entered, capital withdrawn, realized PnL, and unrealized PnL derived from the canonical ledger plus trusted pricing inputs.

**Why this priority**: This is the first point where The Cab begins to deliver the core business value. Without valuation and capital-flow-aware accounting, the product still shows only normalized activity rather than economic truth.

**Independent Test**: Can be fully tested by taking a wallet with canonical ledger output and supported price coverage, generating portfolio accounting results, and verifying that total value, capital in, capital out, realized PnL, and unrealized PnL are produced in USD/USDC with idle balances included.

**Acceptance Scenarios**:

1. **Given** a wallet has canonical ledger records, residual holdings, and supported price coverage, **When** portfolio accounting is generated, **Then** the user sees current total portfolio value, capital entered, capital withdrawn, realized PnL, and unrealized PnL in USD/USDC.
2. **Given** the wallet received external funding, **When** accounting outputs are generated, **Then** the funded amount is counted as capital entered and not counted as profit.
3. **Given** the wallet withdrew value back to an external wallet destination, **When** accounting outputs are generated, **Then** the withdrawn amount is counted as capital withdrawn and not counted as loss.
4. **Given** the wallet holds both active strategy exposure and idle balances, **When** current portfolio value is shown, **Then** the total includes both active positions and idle or unallocated wallet balances.

---

### User Story 2 - Understand Value By Pool And Strategy (Priority: P2)

The user can understand how current value and profit or loss break down across pools and the distinct strategies inside each pool, while preserving The Cab's existing pool-first structure and manual-versus-Mellow separation.

**Why this priority**: Portfolio totals are necessary but insufficient. Users also need to understand where value and performance sit inside the portfolio so the outputs can support future pool and strategy views.

**Independent Test**: Can be fully tested by generating accounting outputs for a wallet with multiple pools and multiple strategies, then verifying that the totals reconcile from portfolio level down to pool and strategy level while keeping manual and supported Mellow activity separated.

**Acceptance Scenarios**:

1. **Given** a wallet has supported activity in multiple pools, **When** accounting results are shown, **Then** the user can see current value and profit or loss for each pool.
2. **Given** one pool contains both manual and supported Mellow strategies, **When** accounting results are shown, **Then** those strategies remain separated in detailed outputs while still rolling up into the same pool total.
3. **Given** canonical ledger continuity supports position-instance accounting, **When** detailed accounting is generated, **Then** the user can see position-instance outputs without losing pool-level and strategy-level aggregation.

---

### User Story 3 - Trust Pricing Quality And Explainability (Priority: P3)

The user can trust the accounting outputs because pricing behavior, fallback behavior, and confidence are explicit, and every major value can be traced back to canonical ledger records and price inputs.

**Why this priority**: Valuation is only useful if users can understand where it came from and when confidence is lower. This story makes the accounting layer explainable rather than opaque.

**Independent Test**: Can be fully tested by generating accounting outputs for supported assets, assets with indirect normalization paths, and assets with pricing gaps, then verifying that valuations, fallback behavior, confidence, and traceability are all explicit.

**Acceptance Scenarios**:

1. **Given** canonical ledger records require historical event-time valuation, **When** accounting outputs are generated, **Then** each valued movement uses an explicit event-time price or an explicit fallback path with disclosed confidence.
2. **Given** current valuation is shown for open holdings or idle balances, **When** the user inspects those values, **Then** the user can identify the current price basis used for the valuation.
3. **Given** pricing is unavailable or incomplete for part of the portfolio, **When** accounting outputs are generated, **Then** the system marks the affected outputs as partial or lower-confidence rather than silently treating missing pricing as zero.
4. **Given** a portfolio contains both priced and unpriced components, **When** portfolio totals are generated, **Then** the system publishes totals for the priced portion and explicitly discloses which portions are excluded from those totals due to missing pricing.

### Edge Cases

- A canonical ledger movement has no directly available event-time USD price, but a supported normalization path through USDC or another supported priced asset exists.
- A holding can be valued at event time but not at current time, or vice versa.
- An asset movement occurs near a pricing boundary where multiple reasonable timestamps could be used, and the valuation basis must stay consistent and explainable.
- External deposits and withdrawals occur close to strategy events, making it necessary to keep capital-flow classification separate from performance calculations.
- A position is fully closed but leaves residual dust or idle balances that still contribute to current portfolio value.
- Pool-level totals can be computed, but position-instance precision is not fully supportable from the canonical ledger for a particular lifecycle.
- A portfolio contains supported assets, unsupported assets, and discarded activity at the same time, and the output must clearly separate priced, unpriced, and excluded portions.
- A stable-value asset used for USD/USDC normalization deviates materially from its expected peg, and the system must not imply certainty that the price basis does not support.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use the canonical ledger as the source of truth for accounting inputs and MUST NOT reinterpret raw transactions directly for this feature.
- **FR-002**: The system MUST generate portfolio accounting outputs for one connected wallet on Base.
- **FR-003**: The system MUST express all primary accounting outputs in USD/USDC-normalized terms.
- **FR-004**: The system MUST support historical event-time valuation for canonical ledger asset movements that contribute to accounting outputs.
- **FR-005**: The system MUST support current valuation for open holdings, residual holdings, and idle wallet balances that remain part of present portfolio value.
- **FR-006**: The system MUST calculate current total portfolio value using both active in-strategy exposure and idle or unallocated balances.
- **FR-007**: The system MUST calculate capital entered for the wallet using classified external funding flows.
- **FR-008**: The system MUST calculate capital withdrawn for the wallet using classified external withdrawal flows.
- **FR-009**: The system MUST treat external deposits as capital entered rather than profit.
- **FR-010**: The system MUST treat external withdrawals as capital withdrawn rather than loss.
- **FR-011**: The system MUST calculate realized PnL using capital-flow-aware accounting that distinguishes realized performance from contributions and distributions.
- **FR-012**: The system MUST calculate unrealized PnL for open exposures and currently held value using current valuation inputs.
- **FR-013**: The system MUST produce accounting outputs at the total portfolio level.
- **FR-014**: The system MUST produce accounting outputs at the pool level.
- **FR-015**: The system MUST produce accounting outputs at the strategy level within each pool.
- **FR-016**: The system MUST preserve separation between manual and supported Mellow strategies inside the same pool while still allowing pool-level aggregation.
- **FR-017**: The system MUST produce position-instance accounting where the canonical ledger supports reliable position continuity, and MUST explicitly mark unsupported precision instead of fabricating exactness where it does not.
- **FR-018**: The system MUST include idle wallet balances in current portfolio valuation and in any higher-level totals that represent the wallet's current economic position.
- **FR-019**: The system MUST integrate historical pricing for supported assets needed to value event-time accounting movements.
- **FR-020**: The system MUST integrate current pricing for supported assets needed to value present holdings.
- **FR-021**: The system MUST apply explicit pricing fallback rules when a direct price is not available and a supported normalization path exists.
- **FR-022**: The system MUST explicitly mark pricing gaps, fallback usage, and valuation confidence for affected outputs.
- **FR-022a**: When price coverage is incomplete, the system MUST publish totals for the priced portion only and MUST explicitly disclose the unpriced portion as excluded or partial coverage.
- **FR-023**: The system MUST preserve explainability by making major accounting outputs traceable back to the underlying canonical ledger records and price inputs used to compute them.
- **FR-024**: The system MUST allow downstream consumers to reuse the accounting outputs for later portfolio, pool, and strategy views without requiring a second interpretation pass over raw chain activity.
- **FR-025**: The system MUST keep unsupported or excluded activity from distorting trusted accounting outputs while making any resulting exclusion explicit.
- **FR-026**: The system MUST avoid silently converting unpriced holdings or movements into zero-value performance when price coverage is missing.
- **FR-027**: The system MUST keep historical valuation logic and current valuation logic distinguishable so users can understand whether a number represents event-time economics or present-day value.
- **FR-028**: The system MUST support explainable reconciliation from total portfolio value down to its pool, strategy, position-instance, and idle-balance components where those components are available.

### Key Entities *(include if feature involves data)*

- **Price Input**: A trusted pricing fact for an asset at a specific effective time or current reference point, including the valuation basis and confidence level used for accounting.
- **Valued Movement**: A canonical ledger movement enriched with event-time valuation information, normalization basis, and traceability to the originating ledger record.
- **Portfolio Accounting Snapshot**: The top-level accounting output for one wallet, including current total value, capital entered, capital withdrawn, realized PnL, unrealized PnL, and any pricing-confidence summary.
- **Pool Accounting Summary**: The accounting output for one pool, including current value and profit or loss totals that roll into the portfolio view.
- **Strategy Accounting Summary**: The accounting output for one strategy within a pool, preserving separation between manual and supported Mellow activity while remaining aggregatable.
- **Position Accounting Summary**: The most granular accounting output available when the canonical ledger can reliably maintain continuity for a position instance.
- **Idle Balance Valuation**: The current-value accounting output for wallet balances that are not presently allocated to active strategy exposure but still belong to the portfolio.
- **Capital Flow Classification**: The explicit classification of external deposits and withdrawals used to separate wallet funding movements from strategy performance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In representative supported-wallet validation scenarios, at least 95% of generated accounting snapshots provide current total portfolio value, capital entered, capital withdrawn, realized PnL, and unrealized PnL without requiring manual spreadsheet adjustment.
- **SC-002**: In controlled review scenarios containing known external deposits and withdrawals, 100% of reviewed outputs classify those flows as capital movement rather than profit or loss.
- **SC-003**: In representative supported portfolios, at least 95% of canonical ledger movements that are expected to affect accounting are either explicitly valued or explicitly marked as unpriced or excluded.
- **SC-004**: In stakeholder review, 95% of users can identify current total portfolio value, capital in, capital out, realized PnL, unrealized PnL, and current pool-level value within 1 minute of viewing the outputs.
- **SC-005**: In representative portfolios containing both manual and supported Mellow activity within the same pool, 100% of reviewed outputs preserve strategy separation while reconciling correctly to the pool total.
- **SC-006**: In representative reconciliation checks, 100% of reviewed total portfolio values reconcile to the sum of active valued exposure, idle valued balances, and any explicitly disclosed excluded or unpriced portions.
- **SC-007**: In representative partial-coverage scenarios, 100% of reviewed outputs clearly indicate that published totals exclude unpriced components rather than implying full portfolio coverage.

## Assumptions

- The canonical ledger already provides sufficiently reliable classification for pools, strategies, residual holdings, external transfers, and discarded activity to support an accounting layer built on top of it.
- The initial release is limited to one wallet at a time on Base and to the existing Aerodrome plus supported Mellow protocol scope.
- USD and USDC serve as the reporting denomination for this feature, with any important confidence or normalization caveats disclosed in the output rather than hidden.
- Some assets or moments may have incomplete price coverage, so explicit partial-confidence outcomes are preferable to silent omission or forced zero valuation.
- This feature establishes reusable accounting outputs and business rules first; richer dashboards, historical charting, and deeper attribution analysis are intentionally deferred.