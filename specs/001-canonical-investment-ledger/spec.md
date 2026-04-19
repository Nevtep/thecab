# Feature Specification: Canonical Investment Ledger

**Feature Branch**: `001-add-ledger-normalization`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "The first feature must establish the canonical investment ledger that The Cab will use as the source of truth for all future analytics."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconstruct Wallet Activity (Priority: P1)

An advanced Aerodrome user connects one Base wallet and receives a canonical investment ledger that translates relevant onchain activity into understandable investment records. The ledger shows what happened, when it happened, and how each normalized record maps back to the original transaction context.

**Why this priority**: Without a trustworthy canonical ledger, every later pricing, accounting, attribution, and reporting feature would rest on unreliable inputs.

**Independent Test**: Can be fully tested by analyzing a wallet with known Aerodrome and supported Mellow activity and verifying that the system produces a complete, deterministic set of normalized ledger records with source traceability.

**Acceptance Scenarios**:

1. **Given** a connected wallet with in-scope Base activity, **When** the system reconstructs its investment history, **Then** it creates normalized ledger records for each supported investment action and preserves a traceable link to the originating transaction context.
2. **Given** the same wallet activity and the same source inputs, **When** the system reconstructs the ledger multiple times, **Then** it produces the same normalized records and classifications each time.
3. **Given** a wallet with no in-scope activity, **When** reconstruction completes, **Then** the system returns an empty canonical ledger rather than inferred or fabricated records.

---

### User Story 2 - Understand Activity by Pool, Strategy, and Position Lifecycle (Priority: P2)

An advanced user reviews reconstructed investment activity in a structure that matches how they reason about their portfolio: pools at the top, separate strategies inside each pool, and finite position or exposure lifecycles beneath those strategies.

**Why this priority**: The product only becomes economically meaningful if it preserves pool context, keeps manual and Mellow activity distinct, and maintains lifecycle continuity for positions and exposures.

**Independent Test**: Can be fully tested by analyzing a wallet that used both manual Aerodrome positions and supported Mellow participation in the same pool and verifying that the results are grouped under one pool, separated into distinct strategies, and assigned to the correct lifecycle entities.

**Acceptance Scenarios**:

1. **Given** a wallet that used both manual and supported Mellow participation in the same pool, **When** the ledger is reconstructed, **Then** the system groups all related records under the same pool while keeping manual and Mellow records in separate strategies.
2. **Given** a manual concentrated-liquidity position opened through a mint action and later extended through a liquidity increase on the same position identity, **When** the ledger is reconstructed, **Then** the system records one position lifecycle that begins at mint and continues through the extension.
3. **Given** a new manual position opened in the same pool after a prior position was closed, **When** the ledger is reconstructed, **Then** the system creates a new position lifecycle rather than merging it into the earlier one.

---

### User Story 3 - Preserve Residual Holdings and Isolate Untrusted Activity (Priority: P3)

An advanced user can see that residual wallet balances, idle assets, and rebalance leftovers remain represented even when exact pool attribution is uncertain, while unsupported, malicious, ambiguous, or invalid activity is retained for review without contaminating sensitive analytics.

**Why this priority**: Users need portfolio completeness and trust. Hidden leftovers create false portfolio views, and untrusted activity must never distort future accounting.

**Independent Test**: Can be fully tested by analyzing a wallet with residual balances and one or more unsupported or suspicious transactions, then verifying that residual holdings remain visible and discarded activity is clearly labeled and excluded from sensitive downstream use.

**Acceptance Scenarios**:

1. **Given** wallet assets that remain after a rebalance or partial redeployment, **When** exact pool attribution is not confident, **Then** the system preserves those assets in a residual or unallocated holding bucket that remains part of the reconstructed portfolio state.
2. **Given** an in-scope transaction that cannot be safely classified for sensitive analytics, **When** reconstruction completes, **Then** the system stores it as a discarded event with a reason and keeps it out of sensitive normalized outputs.
3. **Given** a discarded or residual record, **When** a user inspects it, **Then** the system shows why it was handled that way and what source transaction context it came from.

### Edge Cases

- How the system behaves when one transaction contains multiple in-scope actions that span pool, strategy, and residual outcomes at the same time.
- How the system behaves when a manual liquidity increase and a new position creation emit similar low-level signals in different transactions.
- How the system behaves when supported Mellow wrapper activity affects the same pool that also contains manual concentrated-liquidity activity.
- How the system behaves when exact pool attribution is not confident for a remaining wallet balance after a close, withdrawal, or rebalance flow.
- How the system behaves when raw source observations are incomplete, duplicated, malformed, or internally inconsistent.
- How the system behaves when a wallet includes out-of-scope Base activity alongside valid Aerodrome or supported Mellow activity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST analyze exactly one connected wallet at a time as the active investment context for this feature.
- **FR-002**: The system MUST reconstruct activity only for Base transactions and logs that are relevant to Aerodrome manual concentrated-liquidity usage and the supported Mellow integration.
- **FR-003**: The system MUST preserve raw source observations immutably once they are ingested for reconstruction.
- **FR-004**: The system MUST normalize relevant in-scope activity into canonical ledger records that describe the user-facing investment event rather than only raw chain mechanics.
- **FR-005**: Every normalized ledger record MUST remain traceable back to the originating transaction context and any contributing raw observations.
- **FR-006**: The system MUST classify relevant activity using deterministic, reproducible rules so that the same inputs always produce the same normalized outputs.
- **FR-007**: The system MUST use only explicitly defined, versioned, and test-covered heuristics when deterministic classification cannot rely solely on direct call semantics.
- **FR-008**: The system MUST organize normalized ledger records by pool as the top-level analytical grouping.
- **FR-009**: The system MUST create separate strategies within a pool whenever participation methods materially differ, including separate manual and supported Mellow strategies under the same pool.
- **FR-010**: The system MUST identify manual concentrated-liquidity position lifecycles using the user-owned position identity, with mint opening a new lifecycle and liquidity increases on an existing identity extending that same lifecycle.
- **FR-011**: The system MUST create a new manual position lifecycle when a new position identity is opened, even if it occurs in the same pool and resembles a prior position economically.
- **FR-012**: The system MUST identify supported Mellow exposure using wrapper-level and staking-level strategy semantics rather than modeling each user deposit as a manual concentrated-liquidity position.
- **FR-013**: The system MUST preserve token-level asset movements for each normalized ledger record, including direction, asset identity, and event-level quantity.
- **FR-014**: The system MUST represent residual, idle, and unallocated wallet balances when exact pool attribution is not confident, and those balances MUST remain visible within the reconstructed portfolio state.
- **FR-015**: The system MUST retain normalized records that are not tied to a specific position lifecycle when they still belong to the wallet, pool, strategy, or residual state.
- **FR-016**: The system MUST detect unsupported, malicious, ambiguous, or invalid activity relevant to the connected wallet and store it as discarded activity with an explicit reason.
- **FR-017**: Discarded activity MUST remain reviewable and traceable, but it MUST NOT be treated as trusted input for sensitive downstream analytics.
- **FR-018**: The system MUST distinguish external wallet funding and external wallet withdrawals from internal investment flows when those actions are identifiable from in-scope activity.
- **FR-019**: The system MUST support reconstruction of multiple concurrent strategies in the same pool without merging their detailed accounting.
- **FR-020**: The system MUST produce canonical outputs that later pricing, accounting, attribution, and dashboard features can consume as the source of truth without requiring reinterpretation of raw transactions.

### Key Entities *(include if feature involves data)*

- **Wallet Analysis Context**: The single connected wallet and Base scope currently under analysis.
- **Raw Source Observation**: An immutable transaction, log, or decoded onchain observation captured for later normalization and traceability.
- **Canonical Ledger Record**: A normalized, user-meaningful investment event derived from one or more raw source observations.
- **Asset Movement**: A token-level inflow, outflow, or internal movement associated with a canonical ledger record.
- **Pool**: The top-level analytical container that groups all related activity for a trading pair and venue context.
- **Strategy**: A distinct participation method inside a pool, including manual activity and supported Mellow activity.
- **Position Lifecycle**: A finite manual position or supported Mellow exposure lifecycle with a clear beginning, evolution, and end.
- **Residual Holding Bucket**: A visible container for wallet-owned balances that remain in scope but cannot be confidently attributed to a single pool or strategy.
- **Discarded Activity Record**: A stored record of unsupported, malicious, ambiguous, or invalid activity that remains reviewable but untrusted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a representative validation set of in-scope wallets, 100% of supported Aerodrome manual and supported Mellow transactions are either normalized into canonical ledger records or explicitly stored as discarded activity with a reason.
- **SC-002**: Re-running reconstruction on the same wallet and source inputs produces no classification drift and no unexplained differences in canonical outputs.
- **SC-003**: For every normalized ledger record in the validation set, a reviewer can reach its originating transaction context in no more than two navigation steps from the record.
- **SC-004**: In the validation set, 100% of wallet-owned residual or unallocated in-scope balances that cannot be confidently assigned to a pool remain visible in reconstructed portfolio state rather than disappearing from view.
- **SC-005**: A domain reviewer can inspect the reconstructed output for a representative wallet and correctly distinguish pool grouping, strategy separation, and manual position continuity in at least 95% of sampled cases on first review.

## Assumptions

- The feature serves advanced DeFi users who value explainability and accuracy over simplified summaries.
- The initial supported Mellow scope is limited to the wrapper and staking behaviors already identified during product research.
- Wallet connection and Base network selection are available to the user before ledger reconstruction begins.
- Historical pricing, PnL calculations, annualized return calculations, and dashboard-heavy presentation are handled by later features and are not required to validate this ledger feature.
- The product may maintain residual or unallocated holdings as explicit in-scope records even when precise economic attribution is deferred.