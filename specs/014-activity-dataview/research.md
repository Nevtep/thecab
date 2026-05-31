# Research: Activity DataView

## Decision: Use A Single DB-Backed Activity Route For The DataView

**Decision**: Implement one DB-only Activity read API that returns analysis state, summary metrics, available filters, ledger rows, pagination, selected row detail, movement evidence, linked entities, rebalance explanation, and coverage/confidence notes from persisted analysis data.

**Rationale**: Activity is the transaction-level audit trail. All panels must reconcile against the same filter state and same chain/wallet scope. A single route avoids client-side drift and keeps request-time behavior inside normalized/read-model persistence.

**Alternatives considered**:
- Multiple panel-specific APIs: rejected because summaries, table rows, and selected detail can race and disagree under filters.
- Client-side aggregation of raw ledger rows: rejected because larger wallets need server-side filtering, pagination, and consistent coverage calculations.
- Provider calls on request: rejected by the constitution and product architecture.

## Decision: Activity Is Ledger-First, Not Entity-First

**Decision**: Activity rows are derived from normalized ledger events and asset movements. Links to Pool, Deposit, Strategy, Reward, and Governance are optional evidence-backed relationships, not required for a row to exist.

**Rationale**: Activity must show supported, unsupported, malicious, ambiguous, discarded, partial, unresolved, and unavailable rows. If the view only showed rows with resolved product entities, it would hide exactly the uncertainty users need to inspect.

**Alternatives considered**:
- Build Activity from Pool/Deposit/Strategy/Reward read models: rejected because unresolved and excluded rows would disappear.
- Build Activity directly from raw provider payloads in the UI: rejected because classification, localization, coverage, and pagination need stable server contracts.

## Decision: Keep Request-Time Activity APIs DB-Only

**Decision**: `/api/activity` reads persisted normalized rows, read-model projections, provider evidence references, and coverage metadata. It must not call Moralis, Alchemy, RPC, explorer APIs, or protocol contracts at request time.

**Rationale**: The product requires deep historical analysis to run in background jobs. Activity should remain fast, reproducible, and testable, even when provider availability changes.

**Alternatives considered**:
- Fetch missing transaction details on row selection: rejected because it would introduce hidden latency and non-reproducible detail state.
- Reclassify a row on demand: rejected because classification belongs to analysis/reanalysis, not UI interaction.

## Decision: Use Supplemental Explorer Evidence Only In Background Analysis

**Decision**: Chain explorer indexed evidence may be used by background analysis to fill gaps in decoded wallet history: transaction receipts, logs, internal transfers, contract interactions, source evidence references, and suspicious-activity signals. This evidence is persisted before normalization or attached to persisted evidence metadata.

**Rationale**: The user added explorer API credentials to local configuration to improve classification when the current engine lacks information. The correct place to use that evidence is the analysis pipeline, where results can be persisted, tested, and reconciled. The Activity UI then displays what evidence was used.

**Alternatives considered**:
- Use explorer APIs directly from `/api/activity`: rejected because request paths must remain DB-only.
- Replace Moralis with explorer APIs: rejected because provider ownership remains Moralis for wallet-centric discovery, with explorer evidence as supplemental.
- Ignore explorer evidence: rejected because classification quality is now the main product risk.

## Decision: Supplemental Evidence Cannot Invent Ownership

**Decision**: Explorer evidence may improve action labels, protocol surface detection, event decomposition, internal-transfer visibility, and suspicious-activity classification. It must not assign deposit, strategy, reward, governance, or pool ownership unless the evidence contains explicit identity or protocol semantics required by the product spec.

**Rationale**: The project's no-heuristics rule is stricter than "best effort." Better logs do not justify guessing ownership by pool/time proximity. Ambiguous rows must remain ambiguous, partial, unresolved, unsupported, malicious, discarded, or unavailable.

**Alternatives considered**:
- Use explorer logs to infer nearest pool/position by time: forbidden by AGENTS rules and product specs.
- Assign all contract-interaction rows to the visible protocol surface: rejected because surface classification and economic ownership are separate decisions.

## Decision: Persist Evidence Source And Evidence Gap Metadata

**Decision**: Activity rows and selected detail must expose a compact evidence summary: source provider references, whether supplemental evidence was used, missing evidence reasons, classification basis, coverage state, and confidence.

**Rationale**: Users do not need raw JSON by default, but they do need to know why The Cab believes a row is a deposit, strategy action, reward, governance event, malicious airdrop, or unresolved event.

**Alternatives considered**:
- Show raw provider JSON in the UI: rejected because it is too noisy for product users.
- Hide evidence sources behind internal logs: rejected because Activity is the audit trail.

## Decision: Classifications Use A Product Taxonomy With Raw Reason Codes

**Decision**: Activity supports user-facing action classes from the product spec while preserving stable machine reason codes for coverage, exclusion, and classification evidence. UI labels are localized from the reason/action codes.

**Rationale**: The product needs readable labels such as "Strategy claim" and "Partial swap attribution," while tests and regression scripts need stable codes.

**Alternatives considered**:
- Display raw event types directly: rejected because users need product-language labels.
- Collapse all unknown states into "unsupported": rejected because ambiguous, malicious, discarded, partial, and unavailable have different consequences.

## Decision: Rebalance Explainability Lives In Activity Detail

**Decision**: Rebalance and partial swap attribution rows include a detail section that links related withdraw/decrease, residual state, swap, deposit/increase, pool effect, source allocation, and confidence when available.

**Rationale**: Pools should summarize rebalance effects, but Activity is where users inspect transaction-level attribution. This also helps debug residual attribution issues without overloading Pool detail.

**Alternatives considered**:
- Keep rebalance explanation only in Pools: rejected because transaction-level auditability would remain incomplete.
- Show full rebalance graph in every table row: rejected because it would make the ledger unreadable.

## Decision: One Filter State Drives Summary, Table, And Detail Context

**Decision**: Activity filter state includes search, date range, action type, protocol surface, pool, deposit, strategy, reward, governance, token, coverage, confidence, resolution status, selected event, sort, page, and page size. The same state drives summary metrics, available filter chips, table rows, and selected detail context.

**Rationale**: Activity must behave like Rewards/Pools/Strategies: filters are visible, shareable where useful, and never cause a full-page reload visual.

**Alternatives considered**:
- Separate summary filters from table filters: rejected because it would break reconciliation.
- Keep selected row entirely route-local without URL support: rejected for incoming deep links and debugging, though immediate row selection can still be optimistic/client-side.

## Decision: Use Existing Design System Patterns

**Decision**: Compose Activity from existing DS primitives: connected shell, `CabImpactMetricCard`, `CabKpiStrip`, `DataTable`, `DataTablePagination`, badges, token/tx identity components, key-value lists, empty/loading/error states, and local workspace CSS for layout only.

**Rationale**: Recent refactors established DS-first expectations. Activity should not introduce new table, KPI, pagination, or key-value systems.

**Alternatives considered**:
- Build a custom ledger UI from raw divs: rejected because it repeats drift already identified.
- Add new DS components immediately: deferred until a real shared need appears across Activity and other surfaces.

## Decision: Deterministic Regression Is Required For Classification Quality

**Decision**: Add deterministic Activity regression checks for good, ambiguous, unsupported, malicious/spam, and explorer-enriched transactions. Include the known phishing airdrop transaction from Rewards work and representative Mellow strategy transactions.

**Rationale**: The main product risk is engine classification. Unit route tests are not enough; regressions must prove rows materialize with correct classification, exclusions, links, coverage, and aggregate effects after analysis.

**Alternatives considered**:
- Rely on visual/product smoke: rejected because visual smoke cannot prove data correctness.
- Add browser automation: rejected by constitution v1.1.0.
