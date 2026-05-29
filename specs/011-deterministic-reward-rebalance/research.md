# Research: Deterministic Reward & Rebalance Refactor

**Feature**: `011-deterministic-reward-rebalance`  
**Date**: 2026-05-28

## R1. Manual Aerodrome reward resolution must stay tokenId-first

**Decision**: Manual Aerodrome reward ownership remains deterministic and deposit-first:

1. explicit `tokenId` from decoded input or provider metadata;
2. same-transaction lifecycle or NFT context that proves the `tokenId`;
3. otherwise unresolved.

**Rationale**:
- Product and protocol authority already define manual reward ownership as `RewardEvent -> Deposit -> Pool`.
- Repo memory confirms earlier pool/time/current-position fallbacks caused real misattribution drift and must not return.
- Existing `reward_events.resolution_status` already treats unresolved as a first-class outcome.

**Alternatives considered**:
- Pool-plus-time-window attribution: rejected because it contradicts the product spec and prior incident guardrails.
- Unique-active-deposit fallback: rejected because overlapping same-pool positions are valid.
- Current-position fallback: rejected because ownership is about claim-time identity, not current state.

## R2. Strategy rewards are attributed through StrategyExposure, not through manual tokenId

**Decision**: Strategy reward ownership follows:

```txt
RewardEvent -> StrategyExposure / Strategy -> Pool
```

The canonical strategy reward surface is Mellow `StakingRewards` plus paired `lpWrapper` and share lifecycle evidence.

**Rationale**:
- Product spec states Mellow strategy rewards should link to `strategyId`, `strategyExposureId`, `poolId` when known, `StakingRewards`, reward token, and claim transaction.
- Feasibility architecture maps `Mellow StakingRewards claim -> strategy_reward / mellow_reward -> linked to Strategy + StrategyExposure + Pool`.
- Strategy rewards must remain distinct from manual deposit rewards to prevent leakage between manual and automated analytics.

**Alternatives considered**:
- Direct pool reward ownership: rejected because pool is only an aggregate container.
- Manual-deposit fallback from same pool: rejected because Mellow exposure is not a manual deposit unless the wallet owns the underlying NFT.

## R3. Strategy processing should resolve the deterministic LpSugar position reference, but ownership still resolves through StrategyExposure unless stronger proof is verified

**Decision**: Do not invent a strategy `tokenId`, but also do not assume the absence of a deterministic automated deposit reference. The deterministic user-level ownership basis for Mellow participation remains:

```txt
StrategyExposure = chainId + walletAddress + strategyId
identity basis = share token or share balance lifecycle
supporting evidence = lpWrapper + StakingRewards + share mint/burn/transfer + deposit/withdraw lifecycle
```

The Aerodrome dashboard visibly exposes automated `Deposit #...` references, and live dashboard decoding shows that value comes from `LpSugar.positions(limit, offset, walletAddress).id` filtered by the returned `alm` wrapper address. Strategy processing should therefore always attempt to resolve the wallet-scoped `LpSugar` row for each known wrapper and, when exactly one deterministic match exists, persist `row.id` as the external strategy-position reference on `StrategyExposure.metadataJson` or a dedicated column. Until stronger protocol proof exists, that value is still not the canonical ownership key.

If `StrategyExposure` ownership is already proven but the external `LpSugar` reference is missing or ambiguous, the owner should remain resolved and only the external reference should remain unresolved.

Public Mellow documentation narrows where that reference is unlikely to come from:
- The public `points.mellow.finance` API does not expose any per-deposit or per-position id for users. `GET /v1/users/{user_address}` returns only `chain_id`, `user_address`, points totals, `user_vault_balance`, `timestamp`, and `vault_address`.
- `GET /v1/defi/users/{user_address}` adds `defi_protocol_address`, `name`, `protocol`, `pool_id`, `url`, and `boost`, but still no deposit id, token id, or user NFT id.
- Mellow ALM docs describe user deposits into `ERC20RootVault` as minting LP tokens or shares, while the documented `VaultRegistry` NFT is assigned to the vault system itself and controlled by the vault/root-vault-strategy management layer, not minted per user deposit.

**Rationale**:
- Product spec explicitly says Mellow participation is modeled as `StrategyExposure` and that wrapper/share behavior is the identity basis.
- Product spec `StrategyExposure identity` names wallet address, strategy ID, share token or share balance lifecycle, and deposit/withdraw/share evidence. It does not define a strategy deposit tokenId.
- Protocol research notes VaultRegistry NFTs exist at the vault-system level, but the product interpretation still tracks user exposure at wrapper/root-vault/share level first.
- User-observed Aerodrome UI evidence and HAR decoding show that Aerodrome renders `Deposit #${position.id}` and that the position object comes from `LpSugar.positions(...)`, giving a concrete deterministic source instead of a generic possibility.
- Public Mellow API and ALM docs do not document a user-scoped deposit id surface, so any future mapping must come from deeper protocol or integration evidence rather than the public points API.
- Current DB schema already reflects this choice: `strategy_exposures` is keyed by `(chainId, strategyId, walletAddress, wrapperAddress)` and stores `sharesRaw`, not a tokenId.
- Live protocol evidence shows `LpSugar.positions(...).id` and `LpWrapper.positionId()` are different values, so the dashboard-facing strategy position reference must be stored separately rather than inferred from the wrapper contract alone.

**Alternatives considered**:
- Reuse the underlying Aerodrome manual NFT tokenId: rejected because Mellow user exposure is not a user-owned manual Aerodrome deposit unless explicitly proven.
- Invent a synthetic strategy tokenId from wrapper deposits: rejected because it would be a new heuristic identity not backed by product or protocol authority.
- Ignore the Aerodrome-visible automated deposit id entirely: rejected because the dashboard evidence already identifies `LpSugar.positions(...).id` as a deterministic external reference that implementation can query directly.
- Use vault registry NFT as the user exposure tokenId without verification: rejected because the docs do not yet prove it is the wallet’s exposure identity surface.

## R4. Rebalance and redeploy must be residual-flow outcomes, not time-window outcomes

**Decision**: Same-pool rebalance and redeploy remain canonical outputs of residual attribution plus source-of-funds allocation, not of elapsed time.

**Rationale**:
- Product spec sections 2.7 and 2.8 define rebalance via residual attributed balances and explicitly forbid fixed time windows.
- Current engine memory confirms `inferred_actions` is the canonical wallet-scoped surface for higher-order outcomes and `sourceOfFundsWaterfall.ts` is the deterministic allocator.
- `canonicalInference.ts` already owns residual source-lot allocation; the refactor should extend this path instead of layering another heuristic classifier on top.

Additional implementation implication:

- same-pool continuity must preserve attributable portions even when same-pool residual is a minority share of total funding;
- a majority-share shortcut would contradict the product rule that mixed same-pool plus fresh-capital funding still preserves the attributable same-pool portion.

**Alternatives considered**:
- Keep the bounded window only as a configurable fallback: rejected because the spec conflict is semantic, not numeric.
- Reconstruct rebalance at read time in Pools or Deposits: rejected because the same deterministic outcome must feed all downstream read models consistently.

## R5. Minimal persistence change: reward events need user-level strategy linkage and proof metadata

**Decision**: Keep existing normalized tables as the source of truth, but extend reward persistence so strategy rewards can link to `StrategyExposure` explicitly and all resolved or unresolved rewards retain proof basis and reason codes.

**Rationale**:
- Existing `reward_events` already stores `deposit_or_strategy_id` and `resolution_status`, but it cannot represent the user-level `StrategyExposure` linkage the product spec expects for Mellow rewards.
- Read models and reviews need stable proof metadata to explain why a reward was resolved or left unresolved.

Additional persistence implication:

- the persisted reward record should retain proof-oriented linkage fields such as `strategy_exposure_id`, `resolved_pool_id`, `resolution_basis`, and `resolution_reason_codes`;
- any deterministic `LpSugar` strategy-position reference should be stored as additive explainability metadata rather than as the canonical owner key.

**Alternatives considered**:
- Encode all strategy exposure linkage only in `metadata_json`: rejected because user-level linkage should be queryable without re-decoding ad hoc JSON everywhere.
- Split strategy rewards into a separate table: rejected because a shared `RewardEvent` model is already required across manual, strategy, and governance views.

## R6. Rebuilds must prefer visible coverage loss over silent carry-forward

**Decision**: Rebuild normalized rewards, inferred actions, and dependent pool/deposit read models so ambiguous cases become unresolved or partial rather than inheriting prior heuristic certainty.

**Rationale**:
- The feature’s purpose is to remove false certainty from the engine.
- Existing pool and deposit materializers already consume `reward_events`, `inferred_actions`, and attribution tables; the correct fix is to rebuild those projections from corrected normalized evidence.

Additional rebuild implications:

- deposit read models must remain manual-only reward surfaces and must not pull in same-pool strategy rewards;
- pool timeline rebalance or redeploy rows must come only from canonical `inferred_actions`, with degraded coverage or neutral lifecycle output when canonical inference is absent;
- finalize-time rebuilds and CLI reruns should use the same deterministic rebuild order so semantics do not diverge between execution paths.

**Alternatives considered**:
- Preserve old read-model values until perfect replacement data exists: rejected because it would continue surfacing known-bad semantics.