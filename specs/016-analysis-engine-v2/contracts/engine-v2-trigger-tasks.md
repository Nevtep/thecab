# Contract: Engine V2 Trigger Tasks

## General Rules

- Every task payload includes `runId`, `walletAddress`, `chainId`, and `engineVersion`.
- Every task is idempotent by natural key.
- Every external provider call checks DB first, then persisted cache/enrichment results, then provider.
- No DataView request route calls these tasks synchronously.
- Tasks persist progress in analysis run status and reason codes.

## Task: `engine-v2-start`

Purpose: Initialize an Engine V2 run and decide whether collection is needed.

Input:

```ts
{
  runId: string;
  walletAddress: string;
  chainId: number;
  mode: "fresh" | "incremental" | "reanalysis" | "fixture";
  fixtureSetId?: string;
}
```

Output:

```ts
{
  collectionRunId: string;
  started: true;
}
```

Responsibilities:

- Validate chain and wallet.
- Create collection run if needed.
- Start protocol bootstrap.
- Trigger collection or canonicalization based on cache state.

## Task: `engine-v2-protocol-bootstrap`

Purpose: Seed core protocol contracts and ABI/selector registry.

Responsibilities:

- Upsert core Base protocol contracts for Aerodrome and known Mellow surfaces.
- Reuse `fetchVerifiedContractAbi` through a DB-backed ABI repository.
- Populate selector/event tables.
- Do not hardcode discovered user pools/strategies; discover them from transactions/logs later.

Idempotency key:

```text
engine-v2:protocol-bootstrap:{chainId}:{engineVersion}
```

## Task: `engine-v2-collect-decoded-history-page`

Purpose: Fetch one Moralis decoded address transaction page and persist it.

Input:

```ts
{
  runId: string;
  collectionRunId: string;
  walletAddress: string;
  chainId: number;
  cursor?: string | null;
  pageIndex: number;
}
```

Provider:

```text
GET /api/v2.2/{walletAddress}/verbose?chain=base&order=ASC&include=internal_transactions&limit=100&cursor={cursor}
```

Responsibilities:

- Persist `engine_v2_provider_pages`.
- Extract rows with `decodedTransactionsFromPagePayload`.
- Upsert `canonical_transactions`, logs, internal transactions, and provider references.
- Reenqueue itself when `cursor_out` exists.
- Stop only when no cursor remains or an incremental cached boundary is safely reached.

Idempotency key:

```text
engine-v2:collect:{chainId}:{walletAddress}:{collectionRunId}:{cursorOrStart}
```

## Task: `engine-v2-finalize-collection`

Purpose: Mark history collection complete and compute provider row vs canonical counts.

Responsibilities:

- Count raw provider rows and distinct canonical tx hashes.
- Persist duplicates/skips report.
- Mark collection complete.
- Trigger canonicalization.

## Task: `engine-v2-canonicalize-history`

Purpose: Normalize provider records into canonical logs, movements, and preliminary call roots.

Responsibilities:

- Use existing decoded-history helpers for chronological sorting and address normalization.
- Create canonical native/ERC20/ERC721/share/LP movements.
- Persist failed transactions and internal errors without lifecycle effects.
- Create root `canonical_calls` where raw input exists.

## Task: `engine-v2-ensure-abi-registry`

Purpose: Resolve ABIs needed for canonical transaction targets, log emitters, and known protocol candidates.

Responsibilities:

- Query DB ABI registry first.
- Create `enrichment_needs` for missing ABI/selector/topic records.
- Fetch explorer/Sourcify ABIs during analysis when needed and allowed.
- Persist ABI records and selector/event registry.
- Leave unresolved decode gaps with reason codes if ABI cannot be verified.

## Task: `engine-v2-decode-canonical-calls`

Purpose: Decode direct and nested calls.

Responsibilities:

- Decode transaction input using DB ABI registry.
- Decode `multicall(bytes[])` children and router/batch children.
- Persist `canonical_calls` with parent/child call paths.
- Re-run only rows whose ABI/decode version changed.

## Task: `engine-v2-classify-chronological`

Purpose: Classify every canonical transaction oldest to newest.

Responsibilities:

- Build transaction evidence from canonical tx/logs/internal tx/movements/calls.
- Apply classifiers in the order defined in `research.md`.
- Emit `domain_events`, `domain_event_links`, `transaction_classification_traces`.
- Create partial shells for strong referenced entities whose origin is missing.
- Create parent/child events for composite transactions.

Required classification families:

- failed/reverted
- approvals
- cash-in/cash-out and transfer-in/out
- swaps
- manual Aerodrome deposits and gauge actions
- Mellow/strategy exposures and rewards
- governance lock create/increase/extend/withdraw/transfer
- votes, pokes, reset
- depositManaged and managed lock links
- claimBribes, claimFees, rebase claims
- unsupported/excluded/unresolved

## Task: `engine-v2-plan-enrichment`

Purpose: Create deduplicated enrichment needs after classification.

Responsibilities:

- ABI/selector/topic needs.
- Token metadata needs.
- Historical/current price needs.
- Pool definition/current state needs.
- Manual position current state needs.
- Strategy current-state/LpSugar needs.
- Lock identity backfill needs.
- Managed/relay current-state needs.
- Distributor-to-pool link needs.
- Transaction decoded/log backfill needs.

## Task: `engine-v2-run-enrichment-batch`

Purpose: Execute a bounded batch of enrichment needs.

Input:

```ts
{
  runId: string;
  walletAddress: string;
  chainId: number;
  needTypes?: string[];
  maxItems: number;
}
```

Responsibilities:

- Respect DB-first/cache-first/provider-last ordering.
- Persist request/response references, attempts, errors, retry timing.
- Never loop endlessly on rate limits.
- Trigger decode/classification re-run only for rows affected by newly resolved evidence.

## Task: `engine-v2-account-chronological`

Purpose: Build event-time accounting and current-value state.

Responsibilities:

- Process domain events oldest to newest.
- Build cash-in/out, accounting lots, residual inventory, deposit accounting, strategy share accounting, pool aggregation, rewards accounting, governance lock/epoch/reward accounting.
- Use historical price points for event values.
- Keep current values separate from historical event values.
- Preserve unresolved valuation gaps.

## Task: `engine-v2-materialize-read-models`

Purpose: Materialize DataView tables from domain events/accounting.

Responsibilities:

- Activity includes every canonical row as classified/failed/unsupported/unresolved/excluded.
- Deposits include only manual deposit-owned entities.
- Strategies include only strategy-owned exposures and rewards.
- Pools aggregate only explicit links.
- Rewards show all supported, unresolved, and excluded reward-like rows with no double counting.
- Governance shows locks, managed links, votes, epochs, claims, relocks, and coverage.
- Overview is not refactored in this feature.

## Task: `engine-v2-regression-fixture`

Purpose: Run deterministic fixture validation.

Input:

```ts
{
  fixtureSetId: string;
  chainId: number;
  walletAddress: string;
}
```

Responsibilities:

- Load Moralis decoded-history fixture pages from `docs/api-research/moralis`.
- Run canonicalization/classification/enrichment simulation/accounting/materialization without live provider calls unless fixture explicitly permits.
- Assert classification families, edgecases, no double counting, and DB-only read models.

## Trigger Deployment Notes

- `apps/web/trigger.config.ts` already discovers `./src/server/trigger/tasks`.
- Add `engine-v2-*.task.ts` files under that directory.
- Update `analysis-run.task.ts` to route to Engine V2 behind explicit mode/feature flag first, then cut over after regression.
- Keep legacy phases available only as rollback while V2 is validated.
