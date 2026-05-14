# Contract: Overview Source Selection

## Purpose

Define which backend source owns each Overview block in recent versus analyzed modes.

**Current Stage Scope**: The active implementation stage uses only the Recent View column below. The analyzed-history column is retained as deferred follow-up documentation so later work can reuse the same source-boundary decisions without changing this contract format.

## Source Matrix

| Overview Block | Recent View Source | Deferred Analyzed History Source |
|---|---|---|
| Summary | Wallet + chain context + current fetch metadata | Wallet context + persisted freshness metadata |
| Analysis status | `analysis_runs` + wallet freshness read model | `analysis_runs` + wallet freshness read model |
| Coverage | Recent provider coverage report | Persisted analyzed coverage report |
| Net/deployed/idle metrics | Moralis balances + Alchemy current prices | Persisted `PortfolioSnapshot` + `PerformanceSnapshot` |
| Period delta | Recent chart computation if sufficient | `PerformanceSnapshot` |
| Estimated realized rewards | Nullable, only if recent path can support it safely | Normalized analyzed data |
| Chart | Recent provider-derived series + Alchemy historical pricing | Persisted `PerformanceSnapshot`/historical snapshots |
| Distribution | Recent approximation from balances/positions | Normalized analyzed snapshots |
| Asset table | Moralis balances + Alchemy current prices | Current balances plus analyzed classifications where available |
| Activity preview | Moralis history + provisional labels | Normalized activity/ledger output |

## Rules

1. Frontend code must consume only internal HTTP contracts, never provider contracts directly.
2. Moralis never becomes the canonical historical pricing source.
3. Alchemy never becomes the canonical wallet-history source.
4. The current stage must use only recent-view sources plus explicit fallback semantics; it must not claim analyzed-history ownership for any block.
5. A deferred analyzed-history stage should prefer persisted normalized data when available.
6. Automatic refresh while stale analyzed data remains visible is deferred follow-up scope.
7. If any block is incomplete, the response must expose coverage/fallback semantics rather than silently mixing sources.
8. Every persisted or response-level identity must remain chain-scoped.