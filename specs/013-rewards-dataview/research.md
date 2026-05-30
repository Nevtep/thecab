# Research: Rewards DataView

## Decision: Use a Single DB-Backed Rewards Route for the DataView

**Decision**: Implement one DB-only Rewards read API that returns summary KPIs, filters, over-time series, source/pool/token distributions, table rows, selected reward detail, and unresolved/excluded context from persisted analysis data.

**Rationale**: The mockup is one cohesive DataView, and the user experience depends on all panels reconciling to the same filter state. A single route avoids client-side drift between independently fetched panels and keeps request-time behavior inside normalized/read-model persistence, as required by the product spec and constitution.

**Alternatives considered**:
- Multiple panel-specific APIs: rejected because the panels can race and disagree under filter changes.
- Client-side aggregation of raw reward rows: rejected because larger wallets need server-side filtering, pagination, and consistent coverage calculations.
- Provider calls on request: rejected by provider/API discipline; request paths must not perform reward reconstruction.

## Decision: Reward Ownership Remains Surface-Driven and Explicit

**Decision**: Keep `reward_events` plus reward resolution metadata as the source of truth. The Rewards feature reads owner status from explicit deposit identity, strategy exposure identity, governance classification, or unresolved/excluded states. It must not infer owner by pool address plus time proximity.

**Rationale**: The claim-surfaces research defines ownership by protocol surface: CL gauge and Slipstream fee claims resolve by `tokenId`, strategy wrapper claims resolve by wallet plus wrapper/strategy exposure, v2 pool fee claims resolve by wallet plus pool aggregate rules, and governance claims remain governance-owned rather than LP-owned. This preserves the no-heuristics rule and avoids contaminating Deposits or Strategies totals.

**Alternatives considered**:
- Assign unknown claims to the nearest pool/deposit in time: forbidden by AGENTS rules and claim-surfaces research.
- Let Pool be the owner for all pool-mapped rewards: rejected because Pool is an aggregation lens, not an ownership fallback.
- Hide unresolved rows: rejected because visible uncertainty is a product requirement.

## Decision: Represent Pool Contribution Separately From Ownership

**Decision**: Model each reward row with both owner status and pool contribution status. Pool totals aggregate resolved owner-scoped rewards and supported pool-mapped governance rewards once, while unresolved/excluded rows remain out of confident pool totals.

**Rationale**: Users need to see the flow from Deposits and Strategies to Rewards to Pools. That flow only stays explainable if owner and pool contribution are separate concepts. The selected reward rail must explain the linked pool, contribution status, and counting rule for each selected row.

**Alternatives considered**:
- Store only owner and infer pool contribution in UI: rejected because the UI should not own financial reconciliation logic.
- Store only pool and infer owner in the route: rejected because ownership requires protocol evidence and resolution basis.

## Decision: Keep Claim-Time Valuation as the Confident USD Basis

**Decision**: Reward USD totals use claim-time valuation when available. Missing valuation keeps token amount visible and degrades USD summaries, reward return, and affected distributions to partial or unavailable coverage.

**Rationale**: Product specs require reward value at claim time. Using current prices would misrepresent historical rewards and could make totals look complete when valuation coverage is actually missing.

**Alternatives considered**:
- Use current token price as fallback: rejected as misleading.
- Drop unpriced rewards from the table: rejected because ownership and token amounts may still be useful evidence.

## Decision: Estimated Reward Return Requires Historical Capital Coverage

**Decision**: The estimated reward return KPI and over-time line use historical invested capital when coverage is sufficient. If exact time-weighted capital is unavailable, the metric is labeled estimated, partial, or unavailable with a coverage reason.

**Rationale**: The product spec explicitly says rewards must not be calculated against current capital only. Existing pool/deposit/strategy read models can provide historical capital basis, but gaps in coverage must be surfaced.

**Alternatives considered**:
- Use current deployed value for all return calculations: rejected by product spec.
- Remove reward return until perfect capital coverage exists: rejected because an estimated metric is useful when clearly labeled.

## Decision: One Filter State Drives Every Panel

**Decision**: Rewards filters include search, date range, source category, token, pool, reward type, coverage, resolution status, selected reward, pagination, and rows-per-page. The same filter state drives KPIs, charts, distributions, table rows, and selected reward context.

**Rationale**: The mockup shows a single control band and active filter chips. Users should not need to understand panel-specific filter scopes. Incoming links from Pools, Deposits, and Strategies become visible removable chips.

**Alternatives considered**:
- Keep selected reward state separate from URL/filter state: partially rejected. Selection can be local for interaction speed, but deep links and incoming context should be representable in URL state where useful.
- Separate chart and table filters: rejected because it would undermine reconciliation.

## Decision: Selected Reward Rail Is the Explainability Surface

**Decision**: The selected reward rail is required. It includes summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity in the current filter context.

**Rationale**: The mockup turns the rail into the place where a user can audit a reward without leaving the DataView. This reduces table column pressure and makes unresolved or excluded cases understandable.

**Alternatives considered**:
- Use a modal for selected reward details: rejected as the primary desktop pattern because it interrupts comparison and table scanning.
- Put all details as table columns: rejected because dense evidence would become unreadable and less responsive.

## Decision: Use Existing Design System Primitives and Local CSS Module Composition

**Decision**: Compose the UI from existing connected shell, KPI/card, DataTable/table, chart, badge, coverage, icon, and typography primitives, with a Rewards workspace CSS module for the mockup-specific grid and panel layout.

**Rationale**: This matches Pools, Deposits, and Strategies feature patterns while preserving brand consistency. It avoids introducing a new visual system for one screen.

**Alternatives considered**:
- Build a one-off pixel-perfect static mockup: rejected because real data, i18n, and responsive behavior must drive the screen.
- Introduce a new dashboard library: rejected because existing DS and Recharts patterns are sufficient.

## Decision: Use Deterministic Regression for Reward Reconciliation

**Decision**: Add deterministic regression checks for reward ownership, pool contribution totals, claim-time valuation coverage, and unresolved/excluded behavior. Validate representative transactions from manual deposit claims, strategy wrapper claims, v2 pool fee claims, governance claims, ambiguous wrapper withdrawals, and spam-like airdrops.

**Rationale**: The highest risk is financial misclassification, not static rendering. Regression must prove that manual deposit rewards, strategy rewards, governance rewards, unresolved rows, and excluded rows reconcile across Rewards, Pools, Deposits, and Strategies.

**Alternatives considered**:
- Rely only on route tests: rejected because route tests cannot prove analysis materialization invariants.
- Add browser automation: rejected by constitution v1.1.0.

## Decision: Do Not Add Export or Full Governance Detail in This Feature

**Decision**: Rewards includes governance as a source category where existing analysis evidence supports it, but full Governance detail remains out of scope. CSV/export and manual reconciliation workflows remain out of scope.

**Rationale**: Product v1 explicitly excludes CSV/export and treats Governance as its own future surface. Rewards should include governance reward flows only enough to keep total reward accounting honest.

**Alternatives considered**:
- Build Governance detail inside Rewards: rejected because it would expand scope beyond the requested DataView and roadmap step.
- Add CSV export for audit: rejected by constitution data constraints.
