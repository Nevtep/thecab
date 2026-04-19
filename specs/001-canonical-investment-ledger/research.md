# Research: Canonical Investment Ledger

## Decision 1: Use wallet-scoped archive RPC ingestion with finalized checkpoints

- **Decision**: Implement ingestion with server-side viem clients against an archive-capable Base RPC, hydrate wallet-scoped candidate transactions with transaction, receipt, logs, and available call traces, and advance checkpoints only from safe or finalized blocks.
- **Rationale**: This preserves deterministic replay from authoritative chain evidence without depending on third-party interpreted indexes.
- **Alternatives considered**:
  - BaseScan-style APIs: rejected because they are optimized for browsing, not deterministic replay.
  - Subgraphs or generalized indexers as the source of truth: rejected because they add opaque interpretation and update on their own schedules.

## Decision 2: Persist immutable raw observations and append-only normalization runs in PostgreSQL

- **Decision**: Store raw observations and normalized ledger outputs in PostgreSQL as append-only records, keyed by reconstruction run, with JSON payload preservation for raw evidence and relational projections for trusted outputs.
- **Rationale**: Append-only storage preserves auditability, lets the product compare ruleset versions over time, and keeps future manual overrides as an additive layer rather than a mutation path.
- **Alternatives considered**:
  - Updating canonical rows in place: rejected because it destroys replay history and complicates drift diagnosis.
  - File-based persistence only: rejected because relational projections and queryable provenance are core requirements.

## Decision 3: Use deterministic domain-derived identifiers instead of opaque runtime-generated identifiers

- **Decision**: Derive stable identifiers from domain facts wherever possible: `analysisSessionId` from `chainId + walletAddress`, `poolId` from `chainId + venue + poolAddress`, `strategyId` from `poolId + strategyType + sourceContract`, `manualPositionInstanceId` from `strategyId + tokenId`, and reconstruction-scoped identifiers for ledger records, discarded activity, and residual holdings.
- **Rationale**: Deterministic identifiers simplify replay comparison, deduplication, and traceability across runs.
- **Alternatives considered**:
  - Random UUIDs everywhere: rejected because they make replay diffs noisy and break stable cross-run comparisons.
  - Database-only surrogate keys as public identifiers: rejected because later consumers need semantic stability.

## Decision 4: Classify Aerodrome manual activity from execution intent first, not event names first

- **Decision**: Treat decoded call semantics as the primary classifier for Aerodrome manual activity. `mint()` opens a new manual lifecycle and must be corroborated by a new NFT identity; `increaseLiquidity()` on an existing `tokenId` extends the existing lifecycle; raw `IncreaseLiquidity` logs are supporting evidence only.
- **Rationale**: The same low-level liquidity-increase event can appear in both new-position and extend-position flows, so event-only interpretation is not trustworthy.
- **Alternatives considered**:
  - Event-only classification: rejected because it cannot reliably distinguish `mint()` from `increaseLiquidity()`.
  - Amount- or tick-based heuristics: rejected because they are indirect and brittle.

## Decision 5: Maintain an explicit, versioned classifier and heuristics registry

- **Decision**: Version both the main classifier rules and any deterministic heuristics separately, store those versions with every reconstruction run and every trusted or discarded output, and require automated replay coverage for any heuristic branch.
- **Rationale**: The constitution allows deterministic heuristics only when they are explicit, versioned, and test-covered.
- **Alternatives considered**:
  - Embedding heuristics implicitly inside classifier code with no surfaced version: rejected because it obscures auditability.
  - Ad hoc manual exception lists: rejected because they are not reproducible and violate the automatic-classification principle.

## Decision 6: Model residual and unallocated balances as portfolio-level holdings, not as synthetic pools

- **Decision**: Represent residual, idle, and unallocated wallet-owned balances in a dedicated portfolio-level residual holding projection that can reference candidate pools when known, but does not force a pool assignment when confidence is below threshold.
- **Rationale**: This keeps total portfolio state complete without overstating attribution confidence or violating pool-first semantics for attributable activity.
- **Alternatives considered**:
  - Dropping unattributed balances from the ledger: rejected because it violates portfolio completeness.
  - Assigning all leftovers to the last-seen pool automatically: rejected because it invents false precision.

## Decision 7: Model supported Mellow exposure as wrapper and staking lifecycle state

- **Decision**: Treat supported Mellow activity as a distinct strategy under the related pool, with an exposure lifecycle that opens when wallet-owned wrapper or staking balance moves from zero to positive, extends while the position remains positive, and closes when it returns to zero.
- **Rationale**: This captures the user-facing economic exposure without pretending the wallet owns a fresh manual Aerodrome LP NFT for every Mellow deposit.
- **Alternatives considered**:
  - Modeling each Mellow deposit as a manual LP position: rejected because it misstates strategy semantics.
  - Collapsing Mellow into the manual strategy for the pool: rejected because it violates strategy isolation.

## Decision 8: Store discarded activity as first-class, reviewable records with stable reasons

- **Decision**: Persist unsupported, malicious, ambiguous, and invalid cases as dedicated discarded activity records that include reason type, reason code, reason message, source references, and ruleset versions.
- **Rationale**: The system must remain automatic while preventing unsafe activity from contaminating trusted ledger outputs.
- **Alternatives considered**:
  - Dropping bad inputs silently: rejected because it destroys explainability.
  - Blocking reconstruction until manual resolution: rejected because the MVP forbids manual reconciliation dependence.

## Decision 9: Validate reconstruction with replay-first tests built from real wallet fixtures

- **Decision**: Build a deterministic fixture corpus of raw observations and assert byte-stable canonical outputs, stable discarded reasons, deduplication correctness, ingest-order independence, and residual-holding visibility across replay runs.
- **Rationale**: The primary failure mode is silent classification drift, not just isolated function bugs.
- **Alternatives considered**:
  - Mock-only unit tests: rejected because they miss end-to-end drift risks.
  - UI-focused tests alone: rejected because the correctness boundary is the ledger, not the screen.

## Decision 10: Expose the canonical ledger through versioned read contracts

- **Decision**: Publish the latest accepted reconstruction through versioned Next.js API contracts that expose wallet-level ledger projections, pool and strategy breakdowns, individual ledger-record provenance, and discarded activity views.
- **Rationale**: Later UI and analytics features need stable semantic contracts, not direct access to storage tables or ORM models.
- **Alternatives considered**:
  - Exposing database models directly: rejected because it tightly couples consumers to persistence internals.
  - Returning screen-specific payloads only: rejected because later pricing and accounting modules need domain contracts, not presentation payloads.