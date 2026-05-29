# Contract: Reward Resolution

**Feature**: `011-deterministic-reward-rebalance`  
**Purpose**: Define the normalized ownership contract for manual and strategy rewards.

## 1. Owner Trees

Manual rewards:

```txt
RewardEvent -> Deposit -> Pool
```

Strategy rewards:

```txt
RewardEvent -> StrategyExposure -> Strategy -> Pool
```

Governance rewards remain separate.

## 2. Manual Resolution Priority

Accepted proof bases:

1. explicit `tokenId` in decoded input or provider metadata
2. same-transaction lifecycle or NFT context proving the `tokenId`

Fallback if neither exists:

```txt
unresolved
```

Forbidden proof bases:

- pool-plus-time-window inference
- unique-active-deposit-in-pool fallback
- current-position fallback
- direct pool ownership before deposit ownership

## 3. Strategy Resolution Priority

Accepted proof bases:

1. official Mellow `lpWrapper` + `StakingRewards` pairing mapped to a known `Strategy`
2. wallet interaction with that wrapper or staking contract in the claim transaction
3. share token or share balance lifecycle proving the owning `StrategyExposure`
4. deterministic `LpSugar.positions(limit, offset, walletAddress).id` match where `row.alm == Strategy.wrapperAddress`, used only as an additive external strategy-position reference when the wallet-scoped match is unique

If the strategy is known but the wallet-level `StrategyExposure` is not proven, the reward remains unresolved.

If the `StrategyExposure` is proven but no unique `LpSugar` row matches, the reward still resolves to that `StrategyExposure` and the external strategy-position reference remains unresolved.

Rejected strategy-position shortcuts:

- `LpWrapper.positionId()` as a substitute for the Aerodrome dashboard strategy position reference
- `LpSugar.positions(...).id` as a replacement for canonical `StrategyExposure` ownership
- pool-plus-time-window matching
- public Mellow points API balances as a per-user position id source
- guessing a strategy position id from current pool membership

## 4. Persisted Resolution Fields

Each normalized reward row must expose or persist:

- `resolution_status`
- resolved owner id (`deposit_or_strategy_id` and `strategy_exposure_id` when applicable)
- `resolution_basis`
- `resolution_reason_codes[]`
- `resolved_pool_id` when known
- deterministic strategy position reference when known from `LpSugar.positions(...).id`, stored as additive explainability metadata rather than as the canonical owner key
- `metadata_json` proof hints (source contract, decoded fields, target token or share evidence)

## 5. Read-Model Consumption

- Pools may aggregate only resolved manual and resolved strategy rewards.
- Deposits may aggregate only resolved manual rewards linked to the deposit identity itself.
- Strategy views may aggregate only resolved strategy rewards.
- Same-pool strategy rewards must never flow into deposit reward totals just because the deposit and strategy share a pool.
- Unresolved rewards affect coverage or confidence and remain visible for debugging or future re-resolution.