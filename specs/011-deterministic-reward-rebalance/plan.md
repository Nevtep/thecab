# Implementation Plan: Deterministic Reward & Rebalance Refactor

**Branch**: `[011-deterministic-reward-rebalance]` | **Date**: 2026-05-28 | **Spec**: [specs/011-deterministic-reward-rebalance/spec.md](spec.md)
**Input**: Feature specification from `/specs/011-deterministic-reward-rebalance/spec.md`

## Summary

Refactor the analysis engine so Aerodrome manual reward ownership and same-pool rebalance or redeploy outcomes are derived only from deterministic identity and residual-flow evidence. The implementation centers on three slices: `phase-rewards` stops resolving manual rewards from pool or time heuristics and instead emits structured reward resolution results with explicit proof fields, `canonicalInference` becomes the canonical residual-flow engine for rebalance and redeploy outcomes across transactions with attributable-portion semantics rather than majority-share thresholds, and finalize-side pool or deposit materializers consume only resolved reward ownership plus canonical `inferred_actions` through a shared deterministic rebuild order. Additional strategy research resolves the owner tree question for automated rewards: Mellow strategy rewards belong to `Strategy + StrategyExposure + Pool`. Strategy processing must now also resolve the Aerodrome dashboard-facing strategy position reference from `LpSugar.positions(limit, offset, walletAddress).id` for the matching wrapper when that mapping is deterministic and wallet-scoped, but that external reference is additive to `StrategyExposure` ownership rather than a replacement for it. Pool reward aggregation must be repaired to sum resolved reward ownership from the pool's deposits and strategies directly rather than inheriting broken deposit-only rollups, and deposit read models must remain manual-only reward surfaces.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js web app (`apps/web`), React 19, Drizzle ORM, PostgreSQL, Trigger.dev v4, viem, Moralis wallet APIs, Alchemy Prices + RPC  
**Storage**: PostgreSQL normalized analysis tables plus wallet-scoped Pools and Deposits read models  
**Testing**: Node test runner via `pnpm --filter web test:unit`, targeted analysis task tests, analysis materializer tests, `pnpm --filter web lint`, `pnpm --filter web typecheck`  
**Target Platform**: Next.js browser app backed by server-side analysis workers on Base mainnet (`chainId = 8453`)  
**Project Type**: Web application monorepo with background analysis pipeline  
**Performance Goals**: No request-path regression for existing Pools or Deposits surfaces; deterministic outputs must remain invariant under timestamp shifts when asset-flow evidence is unchanged; rebuilds stay within the existing 365-day one-wallet analysis envelope and bounded slice concurrency  
**Constraints**: No pool/time/current-position heuristics; unresolved is preferred to false attribution; request/response paths remain DB-backed only; no product-UX expansion beyond corrected values and coverage explanations; strategy identity must not be forced into a manual NFT tokenId model without protocol proof; deterministic automated strategy position references must come from verified sources such as `LpSugar.positions(...).id` rather than wrapper `positionId()` guesses; strategy rewards must resolve through `StrategyExposure` even when the external strategy position reference is unresolved; pool reward totals must aggregate directly from resolved deposit and strategy rewards instead of depending on deposit-only projections; deposit reward totals must remain manual-only; same-pool continuity must preserve attributable portions even when residual funding is not the majority share; pool timeline rebalance or redeploy rows must come only from canonical `inferred_actions` rather than local read-model fallbacks  
**Scale/Scope**: One wallet and one chain per analysis run, up to one year of history, overlapping manual deposits and Mellow strategy exposures in the same pool, downstream rebuilds for normalized entities plus pool/deposit read models

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Brand consistency gate**: PASS. No new feature surface is introduced; the refactor only corrects analytics semantics and coverage messaging. Any user-facing ambiguity notes remain technical, precise, and audit-friendly.
- **Localization gate**: PASS. Existing Pools, Deposits, and Rewards surfaces may need updated coverage or ambiguity labels, but no hardcoded copy is required. Any new coverage reason labels remain in i18n namespaces already established for `coverage`, `rewards`, `pools`, and `deposits`.
- **Chain-awareness gate**: PASS. Manual deposits remain NFT-identified by `(chainId, positionManagerAddress, tokenId)` and strategy exposures remain identified by `(chainId, strategyId, walletAddress, wrapperAddress)`. Reward ownership, inferred actions, rebuilds, and read-model projections stay chain-scoped.
- **Provider/API gate**: PASS. Moralis remains wallet-history and decoded-hint input only; Alchemy Prices remains the pricing source of truth; RPC/log/contract reads remain the canonical protocol-evidence layer. No new provider is introduced and no request-path analysis is added.
- **Explainability gate**: PASS. Raw provider payloads remain persisted first; `reward_events`, `inferred_actions`, `attribution_states`, `attribution_source_lots`, and read-model coverage fields remain derivable and debuggable. Unresolved strategy or manual reward ownership is preserved explicitly rather than collapsed into guessed totals.

No constitutional violations require special justification.

## Project Structure

### Documentation (this feature)

```text
specs/011-deterministic-reward-rebalance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rebalance-read-models.md
│   └── reward-resolution.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   └── server/
│       ├── analysis/
│       │   ├── canonicalInference.ts             # UPDATE — canonical residual-flow outcomes
│       │   ├── sourceOfFundsWaterfall.ts         # UPDATE — allocation semantics and tests if needed
│       │   ├── computeSnapshots.ts               # UPDATE — consume corrected reward ownership / inferred actions
│       │   ├── deposit-read-models.ts            # UPDATE — consume deterministic rewards and inferred actions
│       │   ├── pool-read-models.ts               # UPDATE — consume deterministic rewards and inferred actions
│       │   ├── enginePersistence.ts              # UPDATE — persist new reward-resolution linkage fields
│       │   ├── coverage.ts                       # UPDATE — propagate unresolved coverage reasons
│       │   └── canonicalInference.test.ts        # NEW/UPDATE — residual-flow classification coverage
│       ├── db/
│       │   ├── schema.ts                         # UPDATE — reward linkage / proof persistence as needed
│       │   └── migrations/                       # NEW migration if schema additions are required
│       ├── scripts/
│       │   ├── db-purge.ts                       # UPDATE — purge any new wallet-scoped artifacts
│       │   └── rebuild-*.ts                      # NEW/UPDATE — deterministic rebuild entrypoints if added
│       └── trigger/
│           └── tasks/
│               ├── phase-rewards.task.ts         # UPDATE — deterministic reward ownership resolution
│               ├── phase-activity.task.ts        # UPDATE — canonical residual-flow inference
│               ├── phase-finalize.task.ts        # UPDATE — rebuild dependent projections
│               ├── phase-rewards.test.ts         # UPDATE
│               ├── phase-activity.test.ts        # NEW/UPDATE
│               └── phase-finalize.test.ts        # NEW/UPDATE
└── src/server/analysis/
    ├── deposit-read-models.test.ts               # UPDATE
    ├── pool-read-models.test.ts                  # UPDATE
    └── computeSnapshots.test.ts                  # UPDATE
```

**Structure Decision**: Keep the refactor inside the existing analysis pipeline rather than creating a separate reconciliation subsystem. `phase-rewards` owns deterministic reward resolution through a dedicated reward-resolution helper, `canonicalInference` owns residual-flow higher-order outcomes and attributable-portion semantics, and finalize-side materializers remain the only writers of wallet-scoped Pools and Deposits projections but must execute through the same deterministic rebuild order used by rerun and CLI rebuild scripts.

## Phase 0: Outline & Research

See [research.md](research.md). Phase 0 resolves the reward-owner question for automated strategies: strategy rewards are attributed through `Strategy + StrategyExposure + Pool`. It also narrows the remaining identity question: the deterministic ownership basis is still `StrategyExposure` share/wrapper lifecycle evidence, and the Aerodrome-visible automated `Deposit #...` from `LpSugar.positions(...).id` is a deterministic external strategy-position reference that should be persisted alongside that owner identity when the wallet-scoped match is unique, but it does not replace `StrategyExposure` as the canonical owner. Phase 0 also fixes the 008 bounded-window conflict by grounding rebalance/redeploy in `attribution_states`, `attribution_source_lots`, and canonical `inferred_actions`, replacing any majority-share shortcut with attributable-portion semantics, and restoring pool reward aggregation to direct sums of resolved deposit and strategy rewards while keeping deposit reward totals manual-only.

## Phase 1: Design & Contracts

See [data-model.md](data-model.md), [contracts/reward-resolution.md](contracts/reward-resolution.md), [contracts/rebalance-read-models.md](contracts/rebalance-read-models.md), and [quickstart.md](quickstart.md).

Agent context update: `.github/copilot-instructions.md` is updated between the `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` markers to point at `specs/011-deterministic-reward-rebalance/plan.md`.

Post-design Constitution re-check: PASS. The design preserves provider boundaries, chain-aware identity, and explainable analytics while treating `LpSugar.positions(...).id` as the verified Aerodrome dashboard strategy-position reference, without collapsing it into manual NFT identity or reintroducing pool-level reward heuristics.

## Complexity Tracking

No constitutional violations to justify.
