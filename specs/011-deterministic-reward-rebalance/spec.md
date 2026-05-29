# Feature Specification: Deterministic Reward & Rebalance Refactor

**Feature Branch**: `[011-deterministic-reward-rebalance]`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "Write a refactor feature spec for The Cab analysis engine that removes time-based heuristics from Aerodrome manual-deposit reward attribution and rebalance detection, and resolves the current spec conflict in favor of deterministic identity and residual-flow semantics."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deterministic Manual Reward Ownership (Priority: P1)

As an analyzed wallet user, I need manual Aerodrome rewards linked only to the deposit that can be proven to own them and strategy rewards linked through the correct `StrategyExposure` plus strategy position reference so that rewards never appear under the wrong position or pool.

**Why this priority**: The known failure is false reward ownership. Until manual reward ownership is deterministic, pool and deposit analytics are not trustworthy.

**Independent Test**: Can be fully tested with analyzed wallets that include manual Aerodrome claims, gauge unstake-with-reward flows, overlapping deposits in the same pool, and Mellow strategy rewards, verifying that every resolved manual reward has deposit proof, every resolved strategy reward links through `StrategyExposure` plus the matching `LpSugar` strategy position reference when deterministically available, and every ambiguous reward remains unresolved.

**Acceptance Scenarios**:

1. **Given** a manual Aerodrome reward candidate whose decoded input or provider metadata contains an explicit `tokenId`, **When** the analysis resolves ownership, **Then** the reward is linked to that deposit and the pool is derived from the deposit rather than owned directly.
2. **Given** a manual Aerodrome reward candidate without explicit `tokenId` fields but with same-transaction lifecycle or NFT evidence that proves one deposit identity, **When** the analysis resolves ownership, **Then** the reward is linked to that deposit and the proof path is preserved in provenance.
3. **Given** a manual Aerodrome reward candidate that reveals only pool, gauge, token, timing, or other non-identity hints, **When** the analysis cannot prove deposit identity, **Then** the reward remains unresolved and does not flow into manual deposit or pool reward totals as if it were certain.
4. **Given** a strategy reward candidate tied to a known Mellow wrapper or `StakingRewards` contract, **When** the engine proves the owning `StrategyExposure`, **Then** the reward is linked to that `StrategyExposure` without being reclassified as a manual deposit reward.
5. **Given** a strategy reward candidate whose owning `StrategyExposure` is proven and whose wrapper has exactly one wallet-scoped `LpSugar.positions(...)` row with matching `alm`, **When** the engine persists the resolved reward, **Then** it also persists `row.id` as the deterministic Aerodrome dashboard strategy position reference for debug and display surfaces.
6. **Given** a strategy reward candidate whose owning `StrategyExposure` is proven but no unique `LpSugar` row exists for the wrapper, **When** the engine persists the resolved reward, **Then** the reward remains resolved to the proven `StrategyExposure` while the external strategy position reference remains explicitly unresolved.

---

### User Story 2 - Residual-Flow Rebalance And Redeploy Continuity (Priority: P1)

As an analyzed wallet user, I need withdrawals, swaps, and later redeploys in the same pool to be explained through residual attributed balances so that rebalance continuity is based on actual asset flow rather than on elapsed time.

**Why this priority**: The product spec already defines rebalance through residual attributed assets, and the bounded-window heuristic conflicts with that model. This affects pool history, deposit performance, and higher-order activity interpretation.

**Independent Test**: Can be fully tested with wallets where a withdrawal from pool `P` is followed by swaps, intermediate cash-ins, other pool activity, and a later same-pool deposit, verifying that the attributable portions remain stable even if the timestamps are shifted beyond any prior window.

**Acceptance Scenarios**:

1. **Given** a withdrawal from pool `P` that leaves residual attributed token `T` in the wallet, **When** a later swap consumes an attributable portion of `T` into the paired token of `P`, **Then** only the attributable portion is classified as `rebalance` for pool `P` and the remaining residual balance is updated accordingly.
2. **Given** residual attributed assets from pool `P` and later unrelated wallet activity between withdrawal and redeposit, **When** a later deposit into pool `P` is funded partly or fully from those residual assets, **Then** the attributable portion is classified as `redeploy` or same-pool continuation without using elapsed time as the classifier.
3. **Given** a swap consumes more token `T` than the amount currently attributed to pool `P`, **When** attribution is allocated, **Then** the pool only consumes its available residual amount and the excess follows the defined source-priority waterfall instead of being forced into `P`.
4. **Given** a residual pool token is swapped into an unrelated token or transferred to an external wallet, **When** the engine classifies the movement, **Then** it is treated as liquidation or cash-out rather than rebalance or redeploy.
5. **Given** a same-pool deposit or paired-token swap whose funding is a mix of attributable residual assets and fresh wallet inventory, **When** the attributable same-pool portion is less than half of the total funding, **Then** the engine still records the same-pool attributable portion and the remaining funding sources separately rather than collapsing the whole action into `new_capital` or `unknown`.

---

### User Story 3 - Truthful Read Models And Rebuilds (Priority: P2)

As a product owner or reviewer, I need downstream pool and deposit read models rebuilt from deterministic ownership and residual-flow rules so that the app surfaces explicit uncertainty instead of heuristic certainty.

**Why this priority**: Once normalized ownership and attribution rules change, downstream projections must be rebuilt or they will preserve the old misattribution semantics.

**Independent Test**: Can be fully tested by rebuilding normalized outputs and wallet-scoped pool/deposit projections for representative wallets, then checking that ambiguous rewards become unresolved, residual-driven rebalance timelines remain explainable, and downstream coverage/confidence states degrade instead of inventing certainty.

**Acceptance Scenarios**:

1. **Given** historical outputs previously shaped by bounded-window reward or rebalance heuristics, **When** the deterministic rebuild runs, **Then** affected normalized rows and read models are recomputed from identity and residual-flow evidence and ambiguous cases become unresolved with explicit coverage impact.
2. **Given** rebuilt Pools and Deposits read models, **When** a user views reward totals, timelines, or performance decomposition, **Then** only resolved manual deposit ownership contributes to deposit reward surfaces, resolved strategy ownership contributes only to strategy or pool aggregates, and unresolved cases are surfaced as partial or unknown coverage rather than silently counted.
3. **Given** two otherwise identical histories whose events are shifted across a previous 24-hour boundary, **When** they are analyzed with the new semantics, **Then** reward ownership and rebalance or redeploy outcomes remain the same because the asset-flow evidence is unchanged.
4. **Given** a pool timeline entry whose rebalance or redeploy semantics were not emitted by canonical `inferred_actions`, **When** the read model is rebuilt, **Then** it degrades coverage or emits a neutral lifecycle event rather than reconstructing rebalance or redeploy from local swap-shape heuristics.

### Edge Cases

- Two manual deposits are open in the same pool at the same time and a reward candidate has no provable `tokenId`; the system must keep it unresolved rather than pick the only plausible-looking deposit.
- A gauge unstake returns reward tokens in the same transaction but provider history labels the receipt as a generic token receive row; candidate generation must still capture the reward without inventing deposit ownership.
- A withdrawal from pool `P` is followed by cash-ins, another pool withdrawal, and unrelated swaps before a later same-pool redeploy; the engine must explain the source split instead of using time distance as a shortcut.
- A swap consumes more of a token than the residual amount attributed to one pool; the attributable portion must be capped at available residual balance and the excess must not create negative residual attribution.
- Residual attributed balance sits in the wallet for days or weeks with no movement; the attribution must remain open rather than expire.
- A later same-pool deposit is funded by a mix of residual assets and fresh wallet capital; only the attributable portion should be classified as same-pool redeploy.
- A reward candidate points to a strategy, wrapper, or staking surface rather than a manual deposit surface; it must not leak into manual deposit ownership.
- A deposit entered the wallet by NFT transfer-in and later receives a reward candidate that still lacks provable token identity; the missing ownership proof must stay explicit rather than be inferred from the wallet's current state.
- Multiple `LpSugar.positions(...)` rows match the same wrapper and wallet at the same time; the engine must leave the strategy position reference unresolved instead of guessing which dashboard id owns the reward.
- A strategy reward is proven to belong to a `StrategyExposure` but no unique `LpSugar` row exists; the missing external strategy position reference must not block owner resolution or trigger manual-deposit fallback.
- A same-pool redeploy uses a minority portion of residual capital and a majority portion of fresh capital; the residual attribution must still be preserved as same-pool continuity instead of being discarded by a majority-share threshold.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analysis engine MUST refactor manual Aerodrome reward attribution and rebalance classification to use deterministic identity and residual-flow semantics, superseding the bounded-window rule currently described in `specs/008-analysis-jobs/spec.md` FR-019 and the matching bounded-window language in the related 008 research and data-model documents.
- **FR-002**: Manual Aerodrome reward ownership MUST follow the ownership tree `RewardEvent -> Deposit -> Pool`.
- **FR-003**: Manual Aerodrome deposit ownership MUST be chain-scoped and identity-based. Current pool membership, temporal proximity, unique currently open deposits, or current-position state MUST NOT be treated as ownership proof.
- **FR-004**: Reward candidate generation MUST collect candidate manual reward events from explicit claim or collect surfaces, known gauge-origin inbound reward receipts, and unstake transactions that realize rewards in the same transaction.
- **FR-005**: Each reward candidate MUST retain enough provenance to support deterministic resolution, including `chainId`, transaction reference, contract surface, decoded input or provider metadata, and any same-transaction lifecycle or NFT context used for proof.
- **FR-006**: Reward resolution MUST first use explicit `tokenId` evidence from decoded transaction input or provider metadata, including equivalent field shapes such as `tokenId`, `token_id`, `tokenIds`, `token_ids`, `positionId`, `position_id`, or equivalent nested variants.
- **FR-007**: If explicit `tokenId` evidence is absent, reward resolution MAY use same-transaction lifecycle or NFT context only when that context proves the owning deposit identity without depending on elapsed time or pool-only inference.
- **FR-008**: If neither explicit `tokenId` evidence nor same-transaction proof can establish deposit identity, the reward candidate MUST remain unresolved.
- **FR-009**: The engine MUST explicitly forbid and avoid these manual reward-attribution fallbacks: pool-plus-time-window attribution, unique-active-deposit-in-pool fallback, current-position fallback, and direct pool reward ownership before deposit ownership.
- **FR-010**: Unresolved manual reward candidates MUST be persisted with explicit unresolved status and reason codes so downstream read models can surface coverage loss without inventing ownership.
- **FR-010A**: Persisted reward resolution rows MUST carry proof-oriented linkage fields sufficient to rebuild deterministic ownership without re-reading provider payloads, including `strategy_exposure_id`, `resolved_pool_id`, `resolution_basis`, and `resolution_reason_codes`, plus any persisted external strategy position reference when it is deterministically known.
- **FR-011**: Strategy-owned rewards and manual-deposit-owned rewards MUST remain separated by owner type. A reward candidate targeting a strategy, wrapper, or staking surface MUST NOT be reclassified as a manual deposit reward without manual deposit proof.
- **FR-011A**: Strategy processing MUST attempt to resolve the Aerodrome dashboard-facing strategy position reference from `LpSugar.positions(limit, offset, walletAddress).id` for known wrappers by matching `row.alm` to `Strategy.wrapperAddress`. When exactly one deterministic wallet-scoped row matches, the engine MUST persist and use that value as the strategy reward-linking position reference.
- **FR-011B**: If no unique `LpSugar` row matches a strategy wrapper for the wallet, the strategy position reference MUST remain unresolved. The engine MUST NOT guess from pool-only overlap, time proximity, public Mellow points APIs, or `LpWrapper.positionId()`.
- **FR-011C**: Strategy reward ownership MUST resolve through `StrategyExposure` first. A proven `StrategyExposure` owner remains valid even when the external `LpSugar` strategy position reference cannot be uniquely resolved.
- **FR-011D**: Wrapper-level hints, public Mellow points APIs, and Aerodrome dashboard-facing position references MAY support strategy reward explainability, but they MUST NOT replace `StrategyExposure` as the canonical strategy reward owner.
- **FR-012**: A manual withdrawal, decrease, or close from pool `P` that returns wallet-held assets MUST open or extend residual attribution for pool `P` at the token level.
- **FR-013**: A swap that consumes residual attributed token from pool `P` into the paired token of pool `P` MUST be classified as `rebalance` for the attributable consumed amount only.
- **FR-014**: A later deposit into pool `P` funded from residual attributed assets from pool `P` MUST be classified as `redeploy` or same-pool continuation for the attributable funded amount, even when intermediate wallet activity occurred between withdrawal and redeposit.
- **FR-015**: Rebalance and redeploy classification MUST NOT depend on elapsed time, configured windows, same-day rules, or adjacency heuristics. The engine MUST explain the gap through asset-flow evidence instead.
- **FR-016**: When a swap or deposit consumes more of a token than the residual amount attributed to one pool, attribution MUST be split. The excess amount MUST follow the product-specified source-priority waterfall: matching-token cash-ins first, liquidation-derived inventory second, and pro-rata allocation across other same-token residual attribution states last.
- **FR-016A**: Same-pool rebalance and redeploy classification MUST be attributable-portion aware, not majority-threshold based. When any proved portion of a movement is funded by same-pool residual attribution, the engine MUST preserve that portion's same-pool continuity and persist the remaining funding sources separately.
- **FR-017**: Residual attribution MUST not expire because time passed. It remains open until resolved by observed movement or explicit higher-confidence evidence.
- **FR-018**: A swap from a residual pool token into an unrelated token MUST be classified as liquidation from that pool, not as rebalance.
- **FR-019**: A transfer of residual pool-attributed assets to an external wallet MUST be classified as cash-out from that pool, not as rebalance or redeploy.
- **FR-020**: A swap from a residual pool token into a token belonging to another tracked pool MAY be classified as transfer or reassignment only when explicit residual-flow evidence supports that ownership change. Otherwise the engine MUST preserve unresolved or lower-confidence attribution rather than guess.
- **FR-021**: Activity classification outputs MUST produce deterministic higher-order outcomes for at least reward resolution, unresolved reward, rebalance, redeploy, liquidation, transfer or reassignment, and cash-out, each with provenance and coverage or confidence state.
- **FR-022**: Manual deposit and pool read models MUST derive reward totals, rebalance narratives, redeploy narratives, and performance decomposition inputs only from resolved ownership and residual attribution states. Pool reward totals MUST equal `sum(resolved rewards linked to the pool's deposits) + sum(resolved rewards linked to the pool's strategies)`. They MUST NOT backfill missing totals with forbidden heuristics or depend on deposit-only rollups for pool rewards.
- **FR-022A**: Deposit read models MUST aggregate only manual rewards resolved to that deposit's identity. Strategy-owned rewards from the same pool, sibling strategy exposures, or strategy-facing dashboard references MUST NOT contribute to deposit reward totals.
- **FR-022B**: Pool timeline rebalance and redeploy rows MUST be derived only from canonical `inferred_actions`. When canonical inference is absent, read models MUST degrade coverage or emit neutral lifecycle rows instead of reconstructing higher-order meaning from local swap-shape heuristics.
- **FR-023**: When ownership or attribution remains unresolved, downstream pool and deposit read models MUST degrade coverage or confidence and surface reason codes rather than hide the gap or convert it into false certainty.
- **FR-024**: The refactor MUST preserve existing product UX scope. Any user-facing change is limited to corrected values, updated explanations, and truthful coverage messaging required by the new semantics.
- **FR-025**: All affected normalized records, inferred outcomes, APIs, caches, rebuild scripts, and read models MUST remain chain-aware. No address-only, pool-only, or transaction-hash-only ownership key may stand in for manual deposit identity.
- **FR-026**: Migration and rebuild behavior MUST be idempotent per wallet and chain and MUST support recomputing downstream projections from normalized records without reintroducing time-based heuristics.
- **FR-026A**: Finalize-time rebuilds, CLI rebuild scripts, and rerun recovery paths MUST execute the same deterministic reclassification order: reward re-resolution, canonical inference, snapshot rebuild, pool rebuild, and deposit rebuild.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: The feature MUST preserve The Cab's precise, control-tower tone. Any new or changed user-facing explanations about unresolved ownership or residual attribution MUST remain technical and non-hype-oriented.
- **CA-002 Localization**: Any user-facing copy added or changed to explain unresolved rewards, residual attribution, or coverage loss MUST remain localizable and MUST NOT be hardcoded in UI components.
- **CA-003 Localization Formatting**: Any corrected reward, capital, or timeline values surfaced by downstream views MUST continue to use locale-aware formatting for currency, percentages, token amounts, dates, and times.
- **CA-004 Chain Awareness**: The feature MUST preserve `chainId` across reward ownership, deposit identity, residual attribution, inferred higher-order actions, read-model rebuilds, API contracts, and query keys.
- **CA-005 Provider Boundaries**: The feature MUST continue to treat provider-decoded data as evidence rather than product truth. Moralis and decoded provider payloads may supply candidate metadata, RPC or decoded same-transaction context may prove identity, and Alchemy remains the historical pricing source of truth; unresolved cases MUST remain unresolved instead of switching to an unapproved provider or heuristic.
- **CA-006 Explainability**: The feature MUST expose coverage and confidence impacts when ownership or attribution cannot be proven, and MUST prefer unresolved or partial output over falsely resolved output.

### Key Entities *(include if feature involves data)*

- **Manual Deposit Identity**: A chain-scoped Aerodrome manual position owner defined by immutable deposit or NFT identity and its proven lifecycle continuity.
- **Reward Candidate**: A potential reward receipt or claim event with the evidence bundle needed to determine whether it belongs to a manual deposit, a strategy, or remains unresolved.
- **Reward Resolution**: The persisted ownership outcome for a reward candidate, including resolved owner type, proof path, unresolved status, and coverage reason codes.
- **Residual Attribution State**: The remaining wallet-held token balance that still belongs economically to a specific pool after withdrawal and remains open until actual movement resolves it.
- **Inferred Higher-Order Action**: A deterministic outcome such as rebalance, redeploy, liquidation, transfer or reassignment, or cash-out derived from residual-flow evidence rather than elapsed time.
- **Pool And Deposit Projection**: Wallet-scoped read-model rows that summarize rewards, lifecycle narratives, performance decomposition, and coverage state for Pools and Deposits using only normalized deterministic evidence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the acceptance regression set for manual Aerodrome rewards, 100% of resolved manual reward rows have persisted explicit `tokenId` proof or same-transaction proof attached to the owning deposit.
- **SC-002**: In ambiguous same-pool regression fixtures, 0 manual reward rows are resolved through pool-plus-time-window, unique-active-deposit, current-position, or direct-pool-first fallbacks.
- **SC-003**: In rebalance and redeploy regression fixtures where timestamps are shifted across a former 24-hour boundary but asset flows are unchanged, classification outcomes remain unchanged.
- **SC-004**: After rebuild, pool and deposit projections reflect deterministic ownership and residual attribution, and every unsupported case is surfaced through explicit unresolved or partial coverage rather than false certainty.
- **SC-005**: A wallet-and-chain rebuild can be rerun without changing final outputs except where the underlying normalized source evidence changed.
- **SC-006**: For validation wallets with both manual deposits and Mellow strategies in the same pool, each rebuilt pool reward total equals the sum of resolved deposit rewards plus resolved strategy rewards for that pool, with no double counting and no loss caused by deposit projection changes.
- **SC-007**: For validation wallets where a pool contains both manual deposits and strategies, deposit reward totals never increase because a same-pool strategy reward was included in a deposit projection.
- **SC-008**: For mixed-funding same-pool redeploy and rebalance fixtures, the rebuilt outputs preserve the attributable same-pool portion even when that portion is less than half of the total funded amount.

## Assumptions

- Scope is limited to Aerodrome manual deposit reward attribution, rebalance and redeploy semantics, and the downstream pool and deposit read models that consume those semantics.
- Mellow strategy semantics remain unchanged by this feature except that strategy-owned rewards must stay separated from manual-deposit-owned rewards.
- Existing normalized analysis tables and provider provenance are sufficient to rebuild wallet-scoped outputs without expanding product navigation or adding new product surfaces.
- The existing coverage model (`full`, `share_level`, `partial`, `unknown`) remains in force and is extended by clearer unresolved reason codes rather than replaced.
- Product and protocol authorities in `docs/spec/` supersede older feature-language drift when they conflict.

## Migration & Rollout

### Superseded Specification Language

- This feature supersedes the bounded-window rebalance language in `specs/008-analysis-jobs/spec.md` FR-019.
- This feature also supersedes the matching bounded-window rule in the 008 analysis-jobs research and data-model documents wherever manual Aerodrome rebalance or redeploy classification depends on a configured time window.
- `specs/009-pools-history` and `specs/010-deposits-lifecycle` keep their existing user-facing scope, but their rebalance, redeploy, reward, and performance semantics must now be interpreted from deterministic ownership and residual attribution rather than bounded windows.

### Rebuild Scope

1. Recompute normalized reward ownership and activity classification per wallet and chain for these canonical tables and outputs:
   - `reward_events`, including manual reward ownership and unresolved manual reward rows
   - `ledger_events`, where enriched classifications depend on higher-order activity outcomes
   - `inferred_actions`, for canonical rebalance, redeploy, liquidation, transfer, and cash-out narratives
   - `attribution_states` and `attribution_source_lots`, for residual balances and source lots
   - `performance_snapshots` for scopes that depend on corrected reward ownership or corrected residual-flow classification
2. Rebuild wallet-scoped Pools projections from normalized records:
   - `pool_wallet_summaries`
   - `pool_history_snapshots`
   - `pool_timeline_events`
3. Rebuild wallet-scoped Deposits projections from normalized records:
   - `deposit_wallet_summaries`
   - `deposit_lifecycle_events`
   - `deposit_performance_decompositions`

### Rollout Guidance

1. Run the semantic rebuild first on representative validation wallets that include overlapping same-pool deposits, ambiguous reward candidates, unstake-with-reward flows, long-gap residual redeploys, and partial-swap attribution cases.
2. Treat rewards or higher-order actions that lose ownership proof during rebuild as expected unresolved outcomes, not migration defects.
3. Validate that rebuilt outputs never create negative residual attribution, never let one pool consume more residual token than it owns, and never resolve a manual reward without explicit or same-transaction deposit proof.
4. Promote rebuilt read models to user-facing consumers only after the normalized ownership and attribution rebuild has completed for the target wallet and chain.
5. Keep rollback limited to replacing read-model outputs with a previous build if necessary. Do not reintroduce the forbidden heuristics as a fallback mechanism.