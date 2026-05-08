# Feature Specification: Historical Portfolio Dashboard

**Feature Branch**: `004-historical-portfolio-dashboard`  
**Created**: 2026-05-07  
**Status**: Draft  
**Input**: User description: "Create the next feature specification for The Cab."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Immediate Portfolio Overview (Priority: P1)

As a connected wallet user, I want to see a meaningful portfolio dashboard immediately after session load so I can understand my current economic state without waiting for deep background reconstruction.

**Why this priority**: This is the first product moment. If this is slow, empty, or unclear, the dashboard fails regardless of deeper analytics quality.

**Independent Test**: Create or reuse a wallet session, open the dashboard, and verify the user sees current portfolio metrics and a clear state (loading, partial, empty, or failure) within one flow.

**Acceptance Scenarios**:

1. **Given** a valid connected wallet session with accepted portfolio data, **When** the user opens the dashboard, **Then** the dashboard shows current total value, capital entered, capital withdrawn, realized PnL, unrealized PnL, and idle or residual balances.
2. **Given** a valid connected wallet session with no accepted historical result yet, **When** the user opens the dashboard, **Then** the dashboard shows a clear warm-up state and does not present missing data as final truth.
3. **Given** dashboard reads are temporarily unavailable, **When** the user opens the dashboard, **Then** the dashboard shows an explicit failure state with retry guidance.

---

### User Story 2 - Historical Portfolio Evolution (Priority: P2)

As a user, I want to see how my portfolio changed through time so I can understand trajectory and not only current balances.

**Why this priority**: Historical evolution is the core differentiation of The Cab versus wallet explorers and raw transaction lists.

**Independent Test**: Load a session with accepted historical data and verify that timeline views render total portfolio history and major event markers in chronological order.

**Acceptance Scenarios**:

1. **Given** accepted historical portfolio data, **When** the user opens the historical view, **Then** the user sees total portfolio value over time.
2. **Given** accepted historical portfolio data with claims, locks, votes, rebalances, and close or reopen activity, **When** the user inspects the timeline, **Then** event markers are visible and timestamped.
3. **Given** partial historical coverage, **When** the user views historical charts, **Then** the dashboard indicates partial state explicitly and keeps known points visible.

---

### User Story 3 - Pool and Strategy Drilldowns (Priority: P3)

As a user, I want to inspect pools and strategies while preserving reconciliation to portfolio totals so I can understand where value is deployed and how it moved.

**Why this priority**: Pool-first analysis with strategy separation is a constitutional product rule and necessary for trustworthy interpretation.

**Independent Test**: Open pool list, pool detail, and strategy detail views for one session and verify reconciliation with portfolio totals plus visible idle or residual balances.

**Acceptance Scenarios**:

1. **Given** accepted session data with multiple pools, **When** the user opens pool views, **Then** deployed capital by pool is shown as a historical series.
2. **Given** a pool with both manual and supported Mellow activity, **When** the user opens strategy detail, **Then** manual and Mellow strategies appear as separate analytical lines.
3. **Given** a rebalance sequence moving value from pool A to pool B, **When** the user inspects flow and timeline surfaces, **Then** cross-pool movement is visible without defaulting to false loss interpretation.

### Edge Cases

- What happens when the session exists but has no accepted reconstruction output yet?
- How does the dashboard behave when historical series has sparse points or partial coverage windows?
- How are idle or residual balances displayed when they cannot be confidently attributed to one pool?
- How is a rebalance displayed when pool A decreases and pool B increases in close time proximity?
- How does the dashboard reconcile when there are discarded or unsupported events in the same period?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a session-backed portfolio overview dashboard for one connected wallet on Base.
- **FR-002**: The dashboard MUST display current total portfolio value, capital entered, capital withdrawn, realized PnL, and unrealized PnL.
- **FR-003**: The dashboard MUST display idle and residual balances as part of portfolio truth.
- **FR-004**: The dashboard MUST display historical total portfolio value over time.
- **FR-005**: The dashboard MUST display historical deployed capital by pool over time.
- **FR-006**: The dashboard MUST provide pool list and pool detail views.
- **FR-007**: The dashboard MUST provide strategy detail views within each pool and keep manual and supported Mellow strategy lines separated.
- **FR-008**: The dashboard MUST provide an event timeline view with markers for claim, lock, vote, rebalance, and close or reopen actions when present.
- **FR-009**: The dashboard MUST provide explicit loading, partial, empty, and failure states for portfolio reads.
- **FR-010**: Dashboard outputs MUST consume canonical reconstructed and valued outputs and MUST NOT reinterpret raw chain activity directly.
- **FR-011**: The dashboard MUST preserve pool-first reconciliation so pool and strategy views can be traced back to portfolio-level totals.
- **FR-012**: The dashboard MUST represent cross-pool value migration in rebalance scenarios without labeling migration as realized loss by default.
- **FR-013**: The dashboard MUST keep discarded or unsupported activity reviewable and clearly separated from trusted metrics.
- **FR-014**: The dashboard MUST deliver a meaningful first view quickly after session load and then progressively enrich historical surfaces.

### Key Entities *(include if feature involves data)*

- **DashboardSessionView**: A session-bound read model defining current state, freshness, and display state (`loading`, `partial`, `empty`, `failure`, `ready`).
- **PortfolioOverviewSnapshot**: Current portfolio summary values including total value, capital in or out, realized and unrealized PnL, and idle or residual totals.
- **PortfolioHistoryPoint**: Time-indexed portfolio state point used in historical charting.
- **PoolCapitalSeries**: Time-indexed deployed capital series per pool.
- **PoolDashboardSummary**: Pool-level summary and reconciliation payload for list and detail views.
- **StrategyDashboardSummary**: Strategy-level summary inside a pool, explicitly separated by strategy type.
- **TimelineMarker**: Historical event marker for major economic actions.
- **RebalanceFlowLink**: Source-to-destination pool movement link used for explainability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In at least 95% of session loads with available accepted data, users see a meaningful dashboard first view within 10 seconds.
- **SC-002**: In 100% of dashboard reads, one of the explicit states (`loading`, `partial`, `empty`, `failure`, or `ready`) is shown; no silent blank state is allowed.
- **SC-003**: In dashboard sessions with historical data, at least 95% of rendered timeline markers map to valid underlying canonical events.
- **SC-004**: In validation scenarios containing pool rebalance migrations, at least 95% of reviewed cases show cross-pool movement without default false-loss interpretation.
- **SC-005**: In accepted sessions with multi-pool activity, portfolio-level totals reconcile with pool and strategy views in 100% of contract validation cases.
- **SC-006**: In accepted sessions with idle or residual balances, those balances are visible and included in displayed portfolio truth in 100% of contract validation cases.

## Assumptions

- The feature serves one connected wallet session on Base at a time.
- Canonical reconstruction, pricing, and accounting outputs continue to be the authoritative source for dashboard reads.
- This feature delivers product-facing dashboard behavior and read models, not deeper attribution algorithm expansion.
- Event markers are explainability anchors for timeline comprehension in this feature; full attribution decomposition remains a later feature.
- Multi-wallet aggregation, transaction execution, notification workflows, and export workflows remain out of scope for this feature.
