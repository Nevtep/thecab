# Research: Analysis Engine V2

## Source Documents

- `docs/brief-spec-engine-v2-refactor.md`
- `docs/plan-refactor-engine-procesador-transacciones.md`
- `docs/plan-refactor-engine-enrichment-accounting.md`
- `docs/informe-modelo-datos-engine-v2.md`
- `docs/informe-engine-v2-bugs-gaps.md`
- `docs/api-research/moralis/address-transactions-decoded-classification-notes.md`
- `docs/api-research/abis/selector-matches-address-transactions-decoded.md`
- `scripts/research/analyze-decoded-history.ts`
- `scripts/research/fetch-protocol-abis.ts`
- `apps/web/src/server/analysis/decoded-history/*`

## Decision 1: Runtime Shape Is A Trigger Task DAG

**Decision**: Engine V2 runs as a Trigger task graph, not as request-time routes or screen-specific phases.

**Rationale**: Historical analysis paginates providers, decodes ABIs, fetches prices, enriches contracts, backfills logs, and performs chronological accounting. These operations are long-running, retryable, provider-limited, and must persist progress.

**Task graph**:

```text
engine-v2-start
  -> engine-v2-protocol-bootstrap
  -> engine-v2-collect-decoded-history-page(cursor=...)
      -> reenqueue until history complete
  -> engine-v2-finalize-collection
  -> engine-v2-canonicalize-history
  -> engine-v2-ensure-abi-registry
  -> engine-v2-decode-canonical-calls
  -> engine-v2-classify-chronological
  -> engine-v2-plan-enrichment
  -> engine-v2-run-enrichment-batch
  -> engine-v2-account-chronological
  -> engine-v2-materialize-read-models
  -> engine-v2-finalize-run
```

**Alternatives rejected**:

- Continue `phase-deposits`, `phase-rewards`, `phase-governance`, `phase-activity`: preserves screen-phase drift and duplicates provider work.
- Analyze provider page payloads directly: cannot guarantee immutable DB-first evidence, replayability, or consistent chronological state.

## Decision 2: Moralis Is Collection/Discovery, Not Semantic Authority

**Decision**: The collection stage uses Moralis decoded address transactions:

```text
GET /api/v2.2/{address}/verbose?chain=base&order=ASC&include=internal_transactions&limit=100
```

or an equivalent deterministic fixture captured from that endpoint. The engine persists provider rows and canonical rows before classification.

**Rationale**: Moralis provides useful wallet-centric history, logs, decoded event hints, and internal transactions, but its decoded labels are not complete enough to be final accounting/classification authority.

**Rules**:

- Persist raw provider page, request params, cursor, provider row count, response hash, and collection version.
- Deduplicate canonical transactions by `chainId + walletAddress + txHash`.
- Report provider row count vs distinct canonical transaction count.
- Do not start classification until collection is complete or an explicitly closed historical range is complete.
- For incremental runs, collect newest pages until a cached tx boundary is reached, then classify the affected range in ascending order.

## Decision 3: Promote Existing Research Helpers Into Production Services

**Decision**: Reuse the helpers already extracted under `apps/web/src/server/analysis/decoded-history` and wrap them with DB repositories. Treat `scripts/research/analyze-decoded-history.ts` and `scripts/research/fetch-protocol-abis.ts` as reference examples for how to compose those helpers, not as runtime implementation units.

**Reusable helpers**:

- `decodedTransactionsFromPagePayload`
- `dedupeDecodedTransactions`
- `sortDecodedTransactionsChronologically`
- `normalizeAddress`
- `buildRegistryMap`
- `decodeTransactionInput`
- `fetchVerifiedContractAbi`
- selector/event registry helpers
- log evidence helpers

**Required production adaptation**:

- Replace file-backed research registry reads with `contract_abis` and selector/event tables.
- Replace research script writes with DB repositories.
- Keep `scripts/research/analyze-decoded-history.ts` only as a fixture/regression harness and usage reference.
- Keep `scripts/research/fetch-protocol-abis.ts` only as an ABI bootstrap/reference command; runtime ABI fetch must use the same helper semantics through DB-backed services and dedupe by natural key.

## Decision 4: ABI Registry Is Persisted And Discoverable

**Decision**: The engine stores verified contract ABIs, selectors, event topics, contract kind, protocol, provenance, source URL, fetch status, proxy implementation, and decode version in DB.

**Rationale**: Moralis often returns `decoded_call=null`; BaseScan/Sourcify/GitHub ABIs are needed to decode inputs/logs and nested calls. Serverless Trigger tasks cannot rely on local research files or repeated explorer calls.

**Provider order**:

1. DB `contract_abis` and `contract_abi_selectors`.
2. Persistent cache/enrichment result.
3. Explorer/Sourcify fetch during analysis only.
4. Unresolved ABI gap with reason code if unavailable.

**No request-time ABI fetch**: DataView APIs never call explorer/Sourcify.

## Decision 5: Canonical Calls Are Required For Multicall And Claim-All

**Decision**: Add a `canonical_calls` tree per transaction.

**Rationale**: Aerodrome and position manager flows may hide semantic actions inside `multicall(bytes[])`, batch/router calls, or claim-all flows. A top-level selector is not enough to classify every child effect.

**Rules**:

- A direct call creates one `canonical_calls` row.
- `multicall(bytes[])` creates parent and child rows, preserving `call_path`.
- Child calls decode with the parent ABI when executed on the same target, or with target-specific ABI when a router/batch includes per-call targets.
- Domain events link to the exact call row that created the action.
- `claimFees`, `claimBribes`, `collect`, `burn`, `increaseLiquidity`, `decreaseLiquidity`, `RewardsDistributor.claim`, and strategy reward calls must be detectable inside nested calls.

## Decision 6: Classification Is One Chronological Pass

**Decision**: The classifier processes canonical transactions oldest to newest:

```text
block_timestamp ASC,
block_number ASC,
transaction_index ASC,
tx_hash ASC,
log_index ASC
```

**Rationale**: Deposits, locks, strategy exposures, residual inventory, rewards, votes, and lots depend on earlier state.

**Classifier order**:

1. Failed/reverted transaction.
2. Spam/phishing/airdrop exclusion guard.
3. Known protocol direct call or nested call.
4. Known protocol event/log evidence.
5. Governance surfaces.
6. Manual deposit/withdraw/stake/unstake surfaces.
7. Reward/fee/bribe/rebase surfaces.
8. Swap/router/pool surfaces.
9. Strategy wrapper/share/staking surfaces.
10. Cash-in/cash-out.
11. Unsupported/unresolved.

Cash-in/out is intentionally late because it is an economic fallback, not a protocol classifier.

## Decision 7: Missing Evidence Creates Enrichment Needs

**Decision**: Missing ABI, token metadata, price, pool definition, lock origin, distributor mapping, strategy relation, current-state, log backfill, or transaction decoded backfill becomes an `enrichment_needs` row with a natural dedupe key.

**Rationale**: The engine must show partial/unresolved rows without inventing ownership or values.

**Examples**:

- ABI: `chainId + contractAddress`
- Selector/topic: `chainId + contractAddress + selectorOrTopic`
- Token metadata: `chainId + tokenAddress`
- Historical price: `chainId + tokenAddress + time/block + resolution`
- Pool definition: `chainId + poolAddress`
- NFT transfer backfill: `chainId + votingEscrowAddress + tokenId`
- Transaction decoded backfill: `chainId + txHash`
- Distributor-to-pool mapping: `chainId + distributorAddress`

## Decision 8: Historical Prices Are Event-Time Values

**Decision**: Use Alchemy historical prices as primary time-series/event valuation source; use Moralis price-by-block only as validation/fallback when exact block-level spot evidence is required.

**Rationale**: Event accounting must not use current prices for historical values. The product needs capital in/out, fees, rewards, cash-in/out, residual inventory, deposits, strategies, governance, and pool values at event time.

**Rules**:

- Persist price points by chain, token, time/block, source, resolution.
- Current prices are separate from historical event price points.
- If no historical price is available, keep amount evidence and mark valuation unavailable.
- Wrapped-token pricing may use underlying only when wrapper identity is verified.
- Provider divergence outside tolerance downgrades coverage and records `priceProviderDivergence`.

## Decision 9: Pool, Deposit, Strategy, Reward, And Governance Links Need Explicit Identity

**Decision**: The engine links domain events to entities only when explicit evidence exists.

**Identity rules**:

- Pool: `chainId + poolAddress`.
- Manual deposit: `chainId + positionManagerAddress + tokenId`.
- Strategy exposure: `chainId + walletAddress + strategy/wrapper/share identity`.
- Governance lock: `chainId + votingEscrowAddress + lockTokenId`.
- Managed lock link: explicit `depositManaged(userTokenId, managedTokenId)` or verified current-state helper/RPC evidence.
- Reward item: `chainId + txHash + logIndex/callPath + rewardType + token + source contract`.

**Forbidden**: Inferring ownership, pool, reward, epoch, strategy, or deposit association from pool + time window.

## Decision 10: Known Edge Cases Become First-Class Rules

**Decision**: The bug/gap cases are part of the plan and must become tests/tasks.

**Resolved handling**:

- Provider row mismatch: dedupe by canonical transaction hash, report counts.
- `depositManaged` with unknown lock origin: create partial lock shell, managed transition, and deduped lock identity backfill.
- Protocol grant lock origin: use NFT transfer history and decoded origin tx only when a governance method references an unseen lock token id.
- Direct lock vs managed lock vs managed token: keep separate identities.
- Aerodrome managed/relay state: persist `depositManaged` link and optionally enrich via wallet-scoped helper/sugar or `VotingEscrow.idToManaged`, never at request time.
- `claimBribes`: create child items by decoded bribe/token arrays plus matching transfer logs.
- `claimFees` in multicall: decode child calls and match transfer evidence.
- Rebase claims: require input token id, `Claimed`, AERO transfer to VotingEscrow, and `VotingEscrow.Deposit` equality; value effect is locked, not liquid cash-in.
- Distributor-to-pool mapping: use `Voter.GaugeCreated` or equivalent registry evidence, not token pair/time/recent vote.
- Missing origin/entity: persist partial shell and enrichment need.

## Decision 11: Clean Slate Reset Is A Local/Dev Tooling Requirement

**Decision**: Add or extend guarded local/dev purge/reset commands so Engine V2 can be validated from a clean database state.

**Rationale**: This refactor replaces core analysis semantics. A clean slate is useful to validate migrations, collection, canonicalization, classification, enrichment, accounting, and read-model materialization without V1 artifacts.

**Rules**:

- No destructive reset runs implicitly.
- Command must require explicit environment/confirmation and must not target production by default.
- Purge can be scoped to analysis/canonical/read-model tables for a wallet/chain.
- Regression quickstart may recommend drop/recreate for local/dev only.

## Decision 12: Overview Is Out Of Scope

**Decision**: Engine V2 materializes Activity, Deposits, Strategies, Pools, Rewards, and Governance read models. Overview remains unchanged until a later refactor.

**Rationale**: Overview uses different fast visibility semantics and should not block the historical DataView engine.
