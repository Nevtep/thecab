# Contract: Engine V2 DataView Read Models

## Global Request Rules

- Request-time APIs are DB-only.
- No Moralis, Alchemy, RPC, explorer, Sourcify, GitHub, or LpSugar calls in route handlers.
- Every request is chain-scoped and wallet-scoped.
- Read models expose coverage/confidence/reason codes, not fabricated completeness.
- Each row must be traceable to canonical transaction evidence and domain events.

Common input:

```ts
{
  walletAddress: string;
  chainId: number;
  runId?: string;
  cursor?: string;
  pageSize?: number;
}
```

Common row evidence:

```ts
{
  txHash: string;
  blockNumber: number;
  occurredAt: string;
  canonicalTransactionId: string;
  domainEventIds: string[];
  coverageStatus: "full" | "share_level" | "partial" | "unknown" | "unresolved" | "excluded";
  confidence: "high" | "medium" | "low";
  reasonCodes: string[];
  evidence: {
    canonicalLogs?: string[];
    canonicalCalls?: string[];
    movements?: string[];
    enrichmentNeeds?: string[];
    pricePointIds?: string[];
  };
}
```

## Activity

Materializes one or more rows for every canonical transaction.

Required categories:

- supported classified activity
- failed transaction
- approval
- cash-in/cash-out
- swap
- manual deposit lifecycle
- strategy lifecycle/reward
- pool context
- governance lock/vote/poke/claim/rebase/managed deposit
- unsupported
- unresolved
- excluded spam/phishing/airdrop-like transfer

Selected detail must include:

- action summary
- transaction section
- token movements
- value effect
- linked contexts
- classification/source evidence
- coverage notes

## Deposits

Materializes only manual user-owned deposit positions.

Required identity:

```text
chainId + positionManagerAddress + tokenId
```

Required outputs:

- pool id and pool definition
- opened/closed state
- lifecycle events
- tick range and current range state
- capital in/out at historical event value
- LP fees and explicit rewards
- current or close value
- realized/unrealized PnL and decomposition
- coverage/confidence

Forbidden:

- Strategy-owned internal pool logs cannot become manual deposits.
- Gauge internals caused by governance vote/poke cannot become manual deposits.
- Missing tokenId means no manual deposit entity.

## Strategies

Materializes automated strategy exposures.

Required identity:

```text
chainId + walletAddress + strategy/wrapper/share identity
```

Required outputs:

- strategy/wrapper/staking addresses
- share balance history
- deposits/withdrawals
- rewards claimed
- underlying pool mapping when explicit
- current value from share/current-state evidence
- coverage states including `share_level`

Forbidden:

- LpSugar cannot create lifecycle or ownership.
- Mellow internal pool activity remains strategy-owned.

## Pools

Materializes pool-level aggregates keyed by pool address.

Required identity:

```text
chainId + poolAddress
```

Required outputs:

- token0/token1/tickSpacing/fee tier/pool kind
- gauge/bribe/fee distributor links when explicit
- manual deposit contribution
- strategy contribution
- governance reward contribution when distributor link exists
- residual inventory contribution
- current state/range snapshots
- historical timeline

Forbidden:

- No ownership or reward pool association from token pair + time window.
- No merging pools by label.

## Rewards

Materializes claim-based reward items.

Required outputs:

- reward type: LP fee, gauge emission, strategy reward, governance bribe, governance fee, rebase, unknown, excluded
- token, amount, USD at claim when available
- owner/source status: manual deposit, strategy, governance, unresolved, excluded
- linked entity id when explicit
- pool contribution status: `contributes`, `none`, `unresolved`, `excluded`
- affectsTotals flag

No double counting:

- One reward item can appear in multiple DataViews but counts once.
- Rebase relock is non-liquid and not cash-in.

## Governance

Materializes lock, epoch, vote, managed/relay, and reward state.

Required outputs:

- lock identities keyed by voting escrow + token id
- direct locks, deposited user locks, and managed token ids as separate identities
- lock lifecycle: create, grant/external transfer-in, increase, extend, rebase relock, deposit managed, withdraw
- vote/poke/reset events by lock token id
- managed links `userTokenId -> managedTokenId`
- claimBribes/claimFees/rebase items
- epoch summaries with derived epoch marker where applicable
- current-state helper/sugar evidence when persisted

Forbidden:

- Do not create a lock from `depositManaged`.
- Do not treat managed token id as wallet-owned direct lock.
- Do not infer pool association for claims without distributor registry evidence.

## Route/API Validation

Implementation tasks must add tests that assert:

- route handlers do not import provider clients;
- route handlers call repositories/read-model services only;
- returned rows include chain id, coverage, confidence, and reason codes;
- selected-detail evidence links back to canonical/domain rows.
