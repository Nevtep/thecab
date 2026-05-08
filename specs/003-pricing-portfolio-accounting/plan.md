# Implementation Plan: Pricing and Portfolio Accounting Engine

**Branch**: `003-prepare-feature-spec` | **Date**: 2026-04-19 | **Spec**: `/specs/003-pricing-portfolio-accounting/spec.md`
**Input**: Feature specification from `/specs/003-pricing-portfolio-accounting/spec.md`

## Summary

Build the first reusable valuation and accounting layer above The Cab's canonical ledger so one connected Base wallet can see current total portfolio value, capital entered, capital withdrawn, realized PnL, unrealized PnL, and pool or strategy economics in USD/USDC-normalized terms. The implementation will add a dedicated pricing domain, an accounting domain above the canonical ledger, persisted normalized price inputs, explicit valued-movement and current-holdings valuation services, and a versioned accounting read contract that preserves traceability to ledger records and price inputs while disclosing partial price coverage explicitly.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 22 LTS  
**Primary Dependencies**: Next.js 15 App Router, React 19, Zod, Drizzle ORM, PostgreSQL driver, existing wagmi and viem runtime, Alchemy pricing API adapter  
**Storage**: PostgreSQL 16 for canonical ledger outputs, normalized historical and current price points, and cached valuation inputs; no separate analytics store  
**Testing**: Vitest for unit, replay, contract, and integration tests; Playwright for browser validation of connected-wallet accounting states  
**Target Platform**: Next.js web application on the Node.js runtime for one connected wallet on Base  
**Project Type**: Full-stack web application with server-side pricing and accounting domains plus versioned read APIs  
**Performance Goals**: Generate an accounting snapshot for an accepted run with up to roughly 1,000 ledger records and 5,000 asset movements in under 2 seconds on warm price cache, and under 15 seconds when historical prices must be fetched and cached for the first time  
**Constraints**: Canonical ledger remains the only source of accounting truth, outputs must be USD/USDC-normalized, partial price coverage must be explicit, unsupported/unpriced portions must not silently distort totals, one wallet at a time on Base only, no transaction execution, no fabricated position precision  
**Scale/Scope**: Small initial user base, one connected wallet per session, Aerodrome manual activity plus supported Mellow only, supported-token coverage concentrated in the assets already emitted by canonical ledger asset movements and residual holdings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Gate Result (Pre-Research)**: PASS

- **Ledger-First Truth**: PASS. The plan consumes canonical ledger records, asset movements, residual holdings, and discarded activity as the only accounting inputs.
- **Pool-First Analysis**: PASS. Pool-level accounting remains the primary aggregation layer, with residual or idle balances kept explicitly at portfolio level when exact attribution is not confident.
- **Strategy Isolation**: PASS. Manual and supported Mellow strategy accounting remains separate under the same pool and is only combined through explicit aggregation.
- **Position Lifecycle Integrity**: PASS. Position-instance accounting is allowed only when canonical continuity is already reliable; otherwise the layer falls back to strategy or pool granularity rather than inventing exactness.
- **Historical Pricing Fidelity**: PASS. The plan introduces explicit historical and current price acquisition, normalized price points, timing rules, and confidence handling.
- **Economic Explainability**: PASS. Every accounting output is designed to retain trace references to ledger records and price inputs.
- **Performance Attribution Decomposition**: PASS. Capital in, capital out, realized PnL, unrealized PnL, and current value are first-class outputs in this feature.
- **Portfolio Completeness**: PASS. Idle and unallocated balances remain included in total current portfolio value.
- **Auditability, Reproducibility, and Testability**: PASS. Price inputs are normalized and persisted, accounting calculations are deterministic given the same ledger and price inputs, and the plan adds contract, integration, replay, and unit coverage.
- **Analytics-Only Boundary**: PASS. The feature adds valuation and accounting only; no execution capabilities are introduced.
- **Scope Constraints**: PASS. The plan remains single-wallet, Base-only, and limited to Aerodrome plus supported Mellow.

## Project Structure

### Documentation (this feature)

```text
specs/003-pricing-portfolio-accounting/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── accounting-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   └── analysis-sessions/
│       └── [sessionId]/
│           └── accounting/
│               └── route.ts
└── ledger/
    └── page.tsx

src/
├── domains/
│   ├── pricing/
│   │   ├── contracts/
│   │   ├── model/
│   │   ├── providers/
│   │   ├── repositories/
│   │   └── services/
│   ├── accounting/
│   │   ├── contracts/
│   │   ├── model/
│   │   ├── repositories/
│   │   └── services/
│   ├── ledger/
│   │   ├── contracts/
│   │   ├── projections/
│   │   ├── repositories/
│   │   └── services/
│   └── residual-holdings/
│       ├── model/
│       └── services/
├── infrastructure/
│   ├── db/
│   └── serialization/
└── ui/
    └── wallet/

db/
└── migrations/

tests/
├── contract/
├── integration/
├── replay/
└── unit/
```

**Structure Decision**: Keep the single Next.js App Router application and extend the existing domain-centric layout. Add a dedicated `pricing` domain for provider acquisition, normalized price-point storage, and coverage decisions, and an `accounting` domain above the canonical ledger for valued movements, current holdings valuation, inventory or cost-basis handling, and reusable read contracts. Thin route handlers continue to live under `app/api`, and browser consumers keep reading versioned accounting outputs rather than touching persistence models directly.

## Phase 0 Research Outcomes

- Introduce a provider-agnostic `PriceProvider` boundary with one initial HTTP adapter capable of both historical and current token pricing for Base-supported assets; keep vendor specifics outside the accounting domain so the domain is not locked to one API surface.
- Persist normalized price points in PostgreSQL and treat event-time pricing and current pricing as the same canonical price-point model differentiated by `effectiveAt`, `fetchedAt`, `sourceKind`, and confidence metadata.
- Use direct token-to-USD pricing first, then explicit alias-based normalization for wrapped assets and approved stable-value assets, and stop at explicit partial coverage rather than routing through inferred onchain paths or forcing zero values.
- Value each ledger-driven asset movement at the ledger record timestamp using the nearest acceptable historical price point according to a deterministic timing window; if no acceptable point exists, mark the movement unpriced instead of guessing.
- Generate current holdings valuation separately from event-time valuation so current portfolio value remains distinguishable from historical accounting movements.
- Compute realized and unrealized PnL using deterministic weighted-average cost inventory by analytical scope, with external deposits and withdrawals tracked as capital flows in parallel so they do not distort performance outputs.
- Reuse the latest accepted reconstruction run as the accounting input boundary and compute accounting snapshots on read from persisted ledger outputs plus persisted or cached price points, rather than introducing a second background materialization pipeline in v1.

See `/specs/003-pricing-portfolio-accounting/research.md` for the complete decision log.

## Phase 1 Design Overview

### Architecture Flow

1. Resolve the latest accepted canonical ledger run for the active wallet analysis session.
2. Read canonical ledger records, asset movements, residual holdings, and discarded activity from the existing ledger repositories and projection services.
3. Derive the set of tokens and timestamps that require historical valuation for event-time accounting.
4. Load normalized historical price points from PostgreSQL; fetch and persist any missing points through the configured `PriceProvider` adapter.
5. Produce valued movements that attach event-time USD/USDC-normalized values, price references, and coverage metadata to canonical asset movements.
6. Read current holdings candidates from open strategy exposure, residual holdings, and idle wallet balances, then load or refresh current price points for those tokens.
7. Build current holdings valuations separately from valued movements so present value, historical flow valuation, and coverage status remain distinguishable.
8. Run accounting calculations by portfolio, pool, strategy, and position scope using deterministic weighted-average cost inventory and capital-flow-aware rules, and fold discarded or excluded activity into explicit exclusion summaries rather than trusted value totals.
9. Return a versioned accounting read model that exposes totals, breakdowns, idle balances, coverage summaries, and trace references to ledger records and price inputs.

### Design Decisions

- **Pricing provider architecture**: Keep the accounting domain behind a `PriceProvider` interface. Use Alchemy as the pricing provider for both historical and current Base token coverage, while domain services continue to depend only on normalized price-point contracts.
- **Provider policy for related domains**: Wallet recovery discovery uses Moralis as primary with BaseScan fallback. Pricing uses Alchemy only. Any generic or ambiguous provider definition must be treated as `NEEDS CLARIFICATION` before implementation.
- **Historical vs current storage**: Store both historical and current prices in the same `PricePoint` persistence model, with current quotes keyed by freshness window and `fetchedAt`. This avoids a parallel quote subsystem while still preserving reproducibility.
- **Valuation timing rules**: Event-time valuation keys off the canonical ledger record timestamp, not raw observation timestamps, using deterministic nearest-valid price selection and explicit confidence downgrades when a fallback window is used.
- **Fallback routing**: Allow only explicit, versioned normalization fallbacks such as wrapped-asset aliases or approved stablecoin normalization. Do not infer synthetic cross-token routes through arbitrary DEX paths in this feature.
- **Priced vs unpriced modeling**: Model coverage explicitly at movement, holding, scope, and portfolio levels. Publish totals for priced portions only and disclose excluded unpriced portions in the output contract.
- **Accounting snapshot generation**: Generate snapshots on read from latest accepted ledger data plus persisted price points rather than persisting every accounting snapshot. This keeps current values fresh and avoids premature materialization complexity.
- **Reconciliation model**: Reconciliation runs bottom-up from valued movements and current holdings into position, strategy, pool, idle-balance, and portfolio summaries. Totals must reconcile to priced components plus separately disclosed excluded portions.
- **Discarded-activity treatment**: Discarded activity remains outside trusted accounting totals but must still feed exclusion and coverage summaries with explicit reason codes so unsupported flows are visible without distorting value, capital-flow, or PnL outputs.
- **Position-instance precision**: Position-level accounting is emitted as `exact` only when the canonical ledger can link every movement contributing to that lifecycle to one stable `positionInstanceId`, preserve event ordering without ambiguity, and account for the current residual inventory for that lifecycle without unresolved overlap across sibling positions. If any contributing movement is unassigned, ambiguously reassigned, or only attributable at broader scope, the output must roll up to the nearest trustworthy strategy or pool summary and emit `precisionStatus = rolled_up` instead of fabricating exact position economics.

### Implementation Slices For Task Generation

1. Add pricing domain models, provider interfaces, repositories, and normalized price-point persistence.
2. Implement historical price acquisition, alias normalization, timing rules, and valuation coverage decisions for canonical asset movements.
3. Implement current holdings valuation for open exposure, residual holdings, and idle wallet balances.
4. Build weighted-average cost inventory and accounting calculation services for portfolio, pool, strategy, and reliable position scopes.
5. Expose a versioned accounting API contract and integrate it into the connected-wallet ledger flow without drifting into dashboard-heavy UI work.
6. Add deterministic unit, replay, contract, integration, and browser validation for total value, capital flows, PnL, idle balance inclusion, partial coverage, explainability, and exclusion handling for discarded activity.

## Post-Design Constitution Check

**Gate Result (Post-Design)**: PASS

- **Ledger-First Truth** remains intact because the accounting layer consumes canonical ledger outputs only and never reinterprets raw chain data.
- **Historical Pricing Fidelity** is operationalized through persisted normalized price points, explicit timing rules, and explicit confidence metadata.
- **Economic Explainability** remains intact because the design requires trace references from accounting outputs back to ledger records and price inputs.
- **Performance Attribution Decomposition** is preserved by making capital entered, capital withdrawn, realized PnL, unrealized PnL, and current value separate first-class outputs.
- **Portfolio Completeness** remains intact because idle and unallocated balances are included in total portfolio value rather than omitted or forced into synthetic pools.
- **Strategy Isolation** and **Pool-First Analysis** remain intact because detailed accounting preserves manual versus Mellow separation while allowing explicit pool aggregation.
- **Auditability and Reproducibility** remain intact because historical prices are normalized and stored, and accounting remains deterministic for a given accepted run and price set.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
