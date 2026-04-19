# Implementation Plan: Canonical Investment Ledger

**Branch**: `001-add-ledger-normalization` | **Date**: 2026-04-18 | **Spec**: `/specs/001-canonical-investment-ledger/spec.md`
**Input**: Feature specification from `/specs/001-canonical-investment-ledger/spec.md`

**Note**: This plan defines the first production-path implementation slice for The Cab. It establishes the canonical ledger and intentionally stops short of pricing, PnL, attribution, or dashboard-heavy delivery.

## Summary

Build a Next.js and TypeScript ledger reconstruction system that analyzes one WalletConnect-connected Base wallet at a time, ingests immutable raw onchain evidence for Aerodrome manual concentrated-liquidity activity and the supported Mellow integration, and normalizes that evidence into deterministic canonical ledger records. The implementation will persist raw observations and normalization runs separately, model pool, strategy, position, residual, and discarded states explicitly, and expose versioned application contracts so later pricing, accounting, attribution, and UI features can consume the ledger without reinterpreting raw transactions.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS  
**Primary Dependencies**: Next.js 15 App Router, React 19, viem, wagmi, WalletConnect, Zod, Drizzle ORM, PostgreSQL driver  
**Storage**: PostgreSQL 16 with append-only raw-observation tables, append-only normalization-run tables, and read projections/views for the latest accepted ledger  
**Testing**: Vitest for unit and replay tests, Playwright for end-to-end verification, schema contract tests for API responses  
**Target Platform**: Next.js web application running on the Node.js runtime with a PostgreSQL database and archive-capable Base RPC access  
**Project Type**: Full-stack web application with server-side ingestion, normalization, and read APIs  
**Performance Goals**: Reconstruct a typical wallet with up to 1,000 candidate in-scope transactions in under 30 seconds on a warm provider; support full deterministic replay of up to 10,000 raw observations in under 2 minutes during local or CI validation  
**Constraints**: One wallet at a time, Base only, Aerodrome plus supported Mellow only, analytics-only boundary, immutable raw evidence, deterministic classification, versioned heuristics, finalized-block checkpointing, no downstream feature may need to reinterpret raw transactions  
**Scale/Scope**: Small initial user base, wallet-scoped replay workloads, tens of thousands of source observations per wallet, two initial strategy families (`manual`, `mellow_auto`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Gate Result (Pre-Research)**: PASS

- **Ledger-First Truth**: PASS. The plan uses canonical ledger records derived from immutable raw observations, with asset movements and provenance preserved.
- **Pool-First Analysis**: PASS. Attributable activity is modeled under pools, with portfolio-level residual handling only where attribution confidence is insufficient.
- **Strategy Isolation**: PASS. Manual and supported Mellow participation are modeled as distinct strategies under the same pool and are never merged in detailed records.
- **Position Lifecycle Integrity**: PASS. Manual lifecycles are keyed by Aerodrome `tokenId`; supported Mellow exposure is modeled as wrapper/staking-driven lifecycle state rather than manual NFT ownership.
- **Deterministic Event Classification**: PASS. Classification is driven by decoded call semantics first, with explicit, versioned, test-covered heuristics only for defined edge cases.
- **Automatic Classification and Source Immutability**: PASS. Raw observations are append-only, and any future override path is explicitly deferred to a later auditable layer.
- **Explicit Handling of Untrusted Transactions**: PASS. Unsupported, malicious, ambiguous, and invalid activity is stored as discarded activity with reason metadata and excluded from trusted ledger projections.
- **Portfolio Completeness**: PASS. Residual and unallocated wallet-owned balances remain visible at portfolio level when exact pool attribution is not confident.
- **Auditability, Reproducibility, and Testability**: PASS. Normalization runs are versioned and replayable against immutable evidence with deterministic test fixtures.
- **Analytics-Only Boundary**: PASS. The plan includes read-only contracts and no transaction execution paths.
- **Scope Constraints**: PASS. The implementation remains limited to Base, one wallet at a time, Aerodrome manual CL, and supported Mellow integration.
- **Spec-Driven Delivery Discipline**: PASS. This plan is derived directly from the ratified feature spec and constitution.

## Project Structure

### Documentation (this feature)

```text
specs/001-canonical-investment-ledger/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ledger-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   └── analysis-sessions/
│       ├── route.ts
│       └── [sessionId]/
│           ├── reconstructions/
│           │   └── route.ts
│           ├── ledger/
│           │   ├── route.ts
│           │   └── events/
│           │       └── [ledgerRecordId]/route.ts
│           └── discarded-activity/
│               └── route.ts
├── ledger/
│   └── page.tsx
└── layout.tsx

src/
├── domains/
│   ├── wallet-session/
│   │   ├── model/
│   │   ├── services/
│   │   └── contracts/
│   ├── ledger/
│   │   ├── model/
│   │   ├── classifiers/
│   │   ├── heuristics/
│   │   ├── projections/
│   │   ├── repositories/
│   │   └── services/
│   ├── protocols/
│   │   ├── aerodrome/
│   │   └── mellow/
│   └── residual-holdings/
│       ├── model/
│       └── services/
├── infrastructure/
│   ├── chain/
│   ├── db/
│   ├── observability/
│   └── serialization/
├── lib/
└── ui/

db/
├── migrations/
└── seeds/

tests/
├── contract/
├── fixtures/
│   ├── wallets/
│   └── raw-observations/
├── integration/
├── replay/
└── unit/
```

**Structure Decision**: Use a single Next.js App Router application with domain-centric modules under `src/` and thin route handlers under `app/api/`. Ingestion, normalization, persistence, and projection logic stay server-side; UI consumers read versioned projections instead of touching storage models directly.

## Phase 0 Research Outcomes

- Use viem-based server-side ingestion against an archive-capable Base RPC, with optional trace-capable fallback access, instead of third-party interpreted indexers.
- Persist immutable raw observations and append-only normalization results in PostgreSQL, and treat the latest accepted reconstruction as a projection rather than an in-place mutable truth table.
- Classify Aerodrome manual activity from decoded call intent and token identity first, using low-level events only as corroborating evidence.
- Model residual holdings as explicit portfolio-level records rather than forcing them into a synthetic pool.
- Expose the canonical ledger through versioned application contracts that include provenance and ruleset metadata.

See `/specs/001-canonical-investment-ledger/research.md` for the complete decision log.

## Phase 1 Design Overview

### Architecture Flow

1. Create or resume a wallet analysis session for one connected wallet on Base.
2. Discover candidate in-scope transactions from wallet transfers and allowlisted Aerodrome and supported Mellow contracts.
3. Hydrate each candidate with immutable raw observations: block header, transaction, receipt, logs, and available call traces.
4. Run protocol detection and semantic classification using versioned classifier and heuristic rule sets.
5. Materialize canonical ledger records, asset movements, discarded activity, and residual-holding projections for a specific reconstruction run.
6. Publish the latest accepted run through stable read contracts for later UI and analytics consumers.

### Design Decisions

- **Chain access**: Wallet-scoped replay over Base RPC keeps source-of-truth control inside the product and avoids opaque external normalization.
- **Persistence**: Append-only raw evidence and append-only reconstruction outputs preserve auditability, replayability, and future override safety.
- **Identity handling**: Pools, strategies, position lifecycles, ledger records, residual holdings, and discarded activity all receive deterministic domain-derived identifiers.
- **Residual handling**: Residual and unallocated balances are projected at portfolio level with candidate attribution references when confidence is below the threshold for pool assignment.
- **Discarded workflow**: Unsupported or unsafe inputs are stored with reason code, reason message, source references, and ruleset version, then excluded from trusted ledger projections.
- **Mellow modeling**: Supported Mellow activity is grouped under the same pool as matching manual participation but modeled as a distinct wrapper/staking-driven strategy with its own exposure lifecycle rules.
- **Future compatibility**: The canonical ledger contract includes `contractVersion`, `classifierVersion`, `heuristicsVersion`, and source block range so pricing and accounting layers can depend on stable semantics.

### Implementation Slices For Task Generation

1. Bootstrap Next.js, TypeScript, database, and environment foundations for Base RPC and WalletConnect.
2. Implement wallet analysis session creation and reconstruction-run orchestration.
3. Build immutable raw observation ingestion and finalized checkpointing.
4. Implement Aerodrome manual detection and classification with `mint()` versus `increaseLiquidity()` disambiguation.
5. Implement supported Mellow detection and wrapper/staking-based exposure modeling.
6. Build canonical ledger materialization: pools, strategies, positions, asset movements, residual holdings, and discarded activity.
7. Expose versioned read APIs and add deterministic replay, contract, and end-to-end validation.

## Post-Design Constitution Check

**Gate Result (Post-Design)**: PASS

- The design preserves ledger-first truth through immutable evidence and append-only normalized outputs.
- Pool-first analysis and strategy isolation remain intact because residual holdings are not used to blur attributable pool data.
- Manual lifecycle integrity is preserved through `tokenId` identity; supported Mellow remains wrapper/staking-driven and separate from manual LP NFT semantics.
- Deterministic classification is operationalized through versioned classifier and heuristic rule sets plus replay tests.
- Discarded activity handling, analytics-only boundaries, single-wallet scope, and traceability are explicit in both the data model and the API contracts.

## Complexity Tracking

No constitution violations or exceptional complexity justifications are required at plan time.
