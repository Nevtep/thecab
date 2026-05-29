# Contract: Rebalance And Read-Model Semantics

**Feature**: `011-deterministic-reward-rebalance`  
**Purpose**: Define the canonical higher-order outcomes that Pools and Deposits may consume.

## 1. Canonical Residual-Flow Rules

1. Withdrawal from pool `P` opens or extends residual attributed balance for pool `P`.
2. Swap of residual pool token into the paired token of pool `P` creates `rebalance_same_pool` for the attributable amount only.
3. Later deposit into pool `P` funded from residual attributed assets creates `redeploy_same_pool` for the attributable funded amount.
4. Swap into an unrelated token creates `liquidation_from_residual`.
5. Transfer to an external wallet creates `cash_out_from_residual`.

Same-pool continuity is attributable-portion aware. It does not require the same-pool residual share to be the majority of total funding.

## 2. Allocation Waterfall

When a consuming movement exceeds one pool’s residual amount, allocation order is:

1. candidate pool residual attribution
2. matching-token cash-ins
3. matching-token liquidation-derived or reward-conversion inventory
4. other same-token residual attribution states pro rata
5. unknown wallet inventory as low-confidence remainder

No read model may override this allocation by time distance.
No higher-order classifier may require the candidate pool residual to exceed a majority threshold before preserving the attributable same-pool portion.

## 3. Required `inferred_actions` Semantics

Pools and Deposits consume only canonical `inferred_actions` rows whose `metadata_json.classificationBasis = residual_flow`.

Required metadata expectations for same-pool outcomes:

- attributable same-pool raw amount and/or share
- mixed-funding indicators when same-pool residual is only part of total funding
- excess allocation bucket summaries when non-candidate sources also fund the movement

Required action types:

- `rebalance_same_pool`
- `redeploy_same_pool`
- `new_capital_deposit`
- `unknown_source_deposit`
- `liquidation_from_residual`
- `cash_out_from_residual`

## 4. Projection Rules

Pools:

- use `inferred_actions` for grouped rebalance or redeploy timeline rows;
- compute reward totals directly as `sum(resolved rewards linked to pool deposits) + sum(resolved rewards linked to pool strategies)` from normalized reward ownership;
- degrade coverage or emit a neutral lifecycle row when canonical inference is absent, rather than recreating rebalance or redeploy semantics from local swap shape;
- degrade coverage when source attribution is incomplete.

Deposits:

- use `inferred_actions` only when linked to the deposit or its residual attribution lineage;
- aggregate only manual rewards resolved to the deposit identity itself;
- keep unresolved or unattributed gaps explicit in decomposition and lifecycle surfaces;
- never reconstruct rebalance or redeploy from time windows inside the read model.