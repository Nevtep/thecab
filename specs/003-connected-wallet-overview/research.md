# Research: Connected Wallet Overview

## Decision 1: Keep `/` As Landing And Add `/overview` As The Connected Entry Route

- **Decision**: Preserve the existing public landing route at `/` and implement the first connected dashboard at `/overview`, with the wallet connect flow redirecting there after successful connection on Base mainnet.
- **Rationale**: This matches the product requirement that disconnected users keep the landing experience while connected users enter the cockpit immediately. It also avoids mixing disconnected and connected rendering logic in a single route.
- **Alternatives considered**:
  - Replacing `/` with a stateful route that conditionally shows landing or Overview.
    - Rejected because it couples two different shells and complicates route protection and analytics state.
  - Adding a nested dashboard root before `/overview`.
    - Rejected because the product definition explicitly calls Overview the first connected dashboard and the current repo does not need an extra shell route to satisfy that.

## Decision 2: Add A Dedicated `src/server/overview` Aggregation Layer

- **Decision**: Implement Overview-specific server orchestration in a new `src/server/overview` module, with one path for recent view and one path for analyzed-history view.
- **Rationale**: Current route handlers are thin and should remain thin. A dedicated server module keeps route validation, provider orchestration, persistence, and source-selection logic reusable and testable without pushing provider code into routes or UI hooks.
- **Alternatives considered**:
  - Calling provider connectors directly inside `src/app/api/wallet/overview/route.ts`.
    - Rejected because it would make the route responsible for orchestration, persistence, and mapping, which does not scale beyond the current scaffold.
  - Performing Overview composition in the frontend query hook.
    - Rejected because it would force browser-side provider logic or leaky HTTP fan-out, violating provider-boundary and secret-handling rules.

## Decision 3: Use Moralis For Wallet Discovery And Alchemy For Valuation Only

- **Decision**: Use Moralis wallet token balances and wallet history as the recent-view discovery inputs, optionally use Moralis DeFi positions as hints, and use Alchemy current and historical pricing as the valuation layer for the Overview screen.
- **Rationale**: This aligns with the product and feasibility docs: Moralis is optimized for fast wallet-centric data and Alchemy is the canonical pricing source. It also fits the existing provider connectors already present in the repo.
- **Alternatives considered**:
  - Using Moralis USD values as canonical valuation.
    - Rejected because the product spec explicitly prohibits Moralis as the historical pricing source of truth.
  - Using Alchemy Transfers as the primary recent activity source.
    - Rejected because the product’s fast Overview path is meant to remain wallet-centric and lighter weight than protocol reconstruction.

## Decision 4: Derive `stale` As A Read-Model Status Rather Than Persisting It On Every Run

- **Decision**: Keep analysis run persistence focused on run lifecycle (`queued`, `running`, `ready`, `failed`) and derive `stale` at read time by comparing wallet freshness metadata against the one-week threshold.
- **Rationale**: `stale` is a freshness state for existing data, not a distinct run lifecycle. Deriving it avoids extra mutation logic on old runs and keeps the analysis status contract stable for both Overview and future feature consumers.
- **Alternatives considered**:
  - Persisting `stale` directly in `analysis_runs.status`.
    - Rejected because it overloads run lifecycle state with read-time freshness semantics and complicates history.
  - Ignoring stale at the API level and handling it only in the UI.
    - Rejected because stale needs to be part of the canonical machine state shared by the frontend and backend.

## Decision 5: Persist Recent Overview Artifacts Even Before Full Analysis Exists

- **Decision**: Persist `RawProviderRecord`, `PricePoint`, `CoverageReport`, and `PortfolioSnapshot` for successful recent Overview fetches, and use `PerformanceSnapshot` plus wallet freshness metadata for analyzed-history rendering and stale handling.
- **Rationale**: The feasibility document explicitly requires raw-first persistence and lists Overview persisted entities. Persisting recent-view artifacts improves traceability, supports future refresh heuristics, and prevents Overview from remaining a transient-only read path.
- **Alternatives considered**:
  - Keeping recent Overview fully ephemeral until analysis finishes.
    - Rejected because it undermines auditability and makes stale/refresh behavior harder to explain.
  - Writing only `PortfolioSnapshot` and skipping raw payloads.
    - Rejected because raw payloads are required for debugging and explainability per the architecture guidance.

## Decision 6: Reuse Existing Design System Shell And Add Only Overview-Specific Panels

- **Decision**: Reuse `ConnectedShell`, `CabSidebar`, `CabTopNav`, `CabDashboardGrid`, `CabMetricCard`, `CabRangeSelector`, `CabAnalysisCta`, `CabAnalysisStatusBadge`, and existing feedback/chart wrappers. Add only feature-level panels and tables that are specific to Overview.
- **Rationale**: The DS already covers shell and most dashboard primitives. Reusing them reduces scope, keeps branding consistent, and avoids drift from the DS implementation plan.
- **Alternatives considered**:
  - Creating a new Overview shell or bespoke metric components.
    - Rejected because it duplicates existing DS capability and weakens the brand/system boundary.
  - Forcing all Overview panels into the DS before the feature is built.
    - Rejected because the current need is feature delivery, not another DS expansion cycle.

## Decision 7: Localize Backend Error Codes In The Frontend, Not In Route Handlers

- **Decision**: Keep stable backend machine error codes in Overview and analysis endpoints, and let frontend containers/components translate them into localized user-facing messages.
- **Rationale**: This matches the constitution’s provider/API discipline and keeps server routes concise, testable, and locale-agnostic.
- **Alternatives considered**:
  - Returning fully localized strings from API handlers.
    - Rejected because it couples backend behavior to frontend locale state and complicates API reuse.
  - Returning raw provider errors to the frontend.
    - Rejected because it violates secret-handling and sanitization rules.