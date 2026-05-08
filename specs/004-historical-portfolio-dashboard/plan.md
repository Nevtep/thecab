# Implementation Plan: Historical Portfolio Dashboard

**Branch**: `004-pricing-portfolio-accounting` | **Date**: 2026-05-07 | **Spec**: `specs/004-historical-portfolio-dashboard/spec.md`
**Input**: Feature specification from `specs/004-historical-portfolio-dashboard/spec.md`

## Summary

Deliver a product-facing historical portfolio dashboard that provides a fast first view and progressively enriches to accepted-run historical surfaces. The implementation composes canonical ledger, pricing, and accounting outputs through stable session-scoped API contracts, with explicit read states, pool-first reconciliation, strategy isolation, rebalance-flow explainability, and visible idle or residual balances.

## Technical Context

**Language/Version**: TypeScript (strict) on Next.js 15 App Router  
**Primary Dependencies**: Next.js, Zod contracts, Drizzle ORM, PostgreSQL, TanStack Query, Vitest, Playwright  
**Storage**: PostgreSQL for canonical and session-backed read state; no new mandatory persisted dashboard series tables in this phase  
**Testing**: Vitest unit/integration/contract, Playwright e2e, typecheck/build validation  
**Target Platform**: Web application (desktop and mobile browsers) backed by Next.js server runtime
**Project Type**: Full-stack web app with API routes and React UI  
**Performance Goals**: meaningful first dashboard view within 10 seconds in >=95% of loads with accepted data; explicit state coverage in 100% of reads  
**Constraints**: canonical-ledger-first read path; no raw-chain reinterpretation in dashboard APIs; deterministic accepted-run anchoring; explicit partial/empty/failure handling  
**Scale/Scope**: one connected wallet session on Base, portfolio + pool + strategy drilldowns, historical charting and explainability markers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

- **I. Ledger-First Truth**: PASS. Dashboard contracts consume accepted canonical outputs only.
- **II. Pool-First Analysis**: PASS. Plan includes pool timelines and explicit residual handling.
- **III. Strategy Isolation**: PASS. Manual and Mellow strategy lines remain separated.
- **VII. Untrusted Transactions**: PASS. Discarded or unsupported activity stays reviewable but excluded from trusted metrics.
- **IX. Economic Explainability**: PASS. Time-series points, markers, and flow links keep trace references.
- **X. Attribution Decomposition**: PASS. Rebalance movement is represented without default false-loss classification.
- **XI. Portfolio Completeness**: PASS. Idle and residual balances are part of portfolio truth.
- **XII. Determinism/Testability**: PASS. Session-scoped accepted-run read contracts and deterministic tests.
- **XV-XVIII Dashboard Principles**: PASS. Versioned contracts, temporal coherence, progressive delivery states, and operational progress surfaces are included.

No constitutional violations identified.

### Post-Design Gate Review (After Phase 1 Artifacts)

- `research.md` decisions preserve canonical boundaries and deterministic run anchoring.
- `data-model.md` includes explicit state semantics, reconciliation rules, and explainability entities.
- `contracts/dashboard-api.openapi.yaml` defines stable product API shapes for bootstrap, progress, time-series, rebalance flows, pool drilldowns, and timeline markers.
- `quickstart.md` validates progressive delivery, reconciliation, and state transparency.

Post-design constitutional status: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-historical-portfolio-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   └── analysis-sessions/
│       └── [sessionId]/
│           ├── accounting/
│           │   ├── bootstrap/route.ts
│           │   ├── time-series/route.ts
│           │   └── rebalance-flows/route.ts
│           ├── dashboard/
│           │   ├── pools/route.ts
│           │   ├── pools/[poolId]/route.ts
│           │   └── timeline/route.ts
│           └── reconstructions/[reconstructionRunId]/progress/route.ts

src/
├── domains/
│   ├── accounting/
│   │   ├── contracts/
│   │   └── services/
│   ├── ledger/
│   │   ├── repositories/
│   │   └── services/
│   └── wallet-session/
├── infrastructure/
│   └── db/
└── ui/
    └── wallet/

tests/
├── contract/
├── integration/
├── e2e/
└── unit/
```

**Structure Decision**: Keep the existing Next.js monorepo-style single web app layout and add dashboard read routes plus accounting read-model services inside current domain boundaries.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
