# Quickstart: Analysis Engine V2

This quickstart describes the expected implementation and validation flow. It is not a request to run destructive database commands automatically.

## 1. Prepare Local Database

For local/dev validation, start from a clean analysis state when possible.

Expected safe flow:

```sh
pnpm db:migrate
pnpm db:purge -- --scope engine-v2 --confirm-engine-v2-purge
```

If a full local database drop/recreate is used, it must be developer-confirmed and never target production.

## 2. Run Engine V2 Against Fixtures

Use deterministic Moralis decoded-history fixtures first:

```sh
pnpm analysis:v2:regression
```

Expected assertions:

- provider rows are persisted and canonical tx hashes are deduped;
- transactions are sorted oldest to newest;
- logs, internal transactions, movements, and calls are persisted;
- unsupported/excluded/failed rows remain visible but do not affect totals;
- no request-time provider calls are needed to inspect read models.

## 3. Run Engine V2 Against A Wallet

The product path is the frontend analysis button, which calls `POST /api/analysis/start`.
With Engine V2 enabled, that existing route creates the `analysis_runs` row and queues the
`analysis-run` Trigger task. `analysis-run` then starts `engine-v2-start-collection`; the V2
task chain carries `analysisRunId` and `collectionRunId` through collection, canonicalization,
ABI/decode, classification, enrichment, accounting, read-model materialization, and final run
completion.

Required server/runtime env for local `trigger:dev` and production:

```sh
ANALYSIS_ENGINE_VERSION=v2
```

Equivalent split flags are still supported when a staged rollout is needed:

```sh
ANALYSIS_ENGINE_V2_TRIGGER=1
ANALYSIS_ENGINE_V2_READ_MODELS=1
```

Keep existing provider/runtime env vars configured for analysis-time workers:

```sh
MORALIS_API_KEY=...
ALCHEMY_API_KEY=...
ALCHEMY_BASE_RPC_URL=...
DATABASE_URL=...
TRIGGER_PROJECT_REF=...
TRIGGER_SECRET_KEY=...
BASESCAN_API_KEY=... # or ETHERSCAN_API_KEY for explorer ABI fetch
```

Expected Trigger stages:

```text
collecting -> canonicalizing -> decoding -> classifying -> enriching -> accounting -> materializing -> complete
```

The CLI remains a diagnostic helper only; product analysis starts from the frontend. Legacy phases
remain the rollback mode when Engine V2 env flags are absent.

## 4. Validate Classification Families

Regression must cover:

- native cash-in/out and transfer rows;
- approvals;
- swaps;
- failed transactions;
- manual Aerodrome deposits;
- Mellow strategy deposits/withdrawals/reward claims;
- governance create/increase/extend/withdraw;
- votes and pokes;
- `depositManaged(userTokenId, managedTokenId)`;
- `claimBribes` child items;
- `claimFees` direct and nested multicall items;
- RewardsDistributor rebase relock;
- spam/phishing/airdrop exclusions;
- unresolved ABI gaps.

## 5. Validate Enrichment And Edge Cases

Required checks:

- ABI fetch is DB-first and persisted.
- Token metadata is batched and persisted.
- Historical prices are event-time values; current prices are separate.
- Pool definitions are keyed by pool address and include token0/token1/tick spacing/fee tier when explicit.
- Distributor-to-pool links are built from `Voter.GaugeCreated` or equivalent registry evidence.
- Lock origin backfill runs only for governance methods referencing a strong unseen lock token id.
- NFT transfer backfill and transaction decoded backfill are deduped and persisted.
- Managed/relay helper/sugar state is analysis-time only and stored before UI consumption.

## 6. Validate Accounting

Required checks:

- cash-in/out separated from swaps, deposits, rewards, gas, and internal protocol movements;
- manual deposits and strategy exposures remain separated;
- residual inventory is chronological and does not expire by time;
- rewards count once across Rewards, Governance, Pools, Deposits, Strategies, and Activity;
- rebase relock is non-liquid and not cash-in;
- missing historical prices produce partial valuation, not current-price substitution.

## 7. Validate DataViews

Request-time route checks:

- Activity reads every canonical transaction row from DB-backed read models.
- Deposits show only manual deposit-owned lifecycle and rewards.
- Strategies show only strategy-owned exposures and rewards.
- Pools aggregate only explicit links.
- Rewards includes supported, unresolved, and excluded reward-like rows with affectsTotals rules.
- Governance shows separate direct locks, deposited user locks, managed token ids, epochs, votes, claims, and relocks.
- Overview remains out of scope.

## 8. Final Checks

```sh
pnpm typecheck
pnpm test:unit
pnpm analysis:v2:regression
pnpm i18n:check
pnpm ds:check
```

Record any skipped provider-backed checks with the reason, required env vars, and residual risk.

## Validation Notes

- `pnpm db:migrate`: pass on 2026-06-01; Drizzle applied migrations successfully against local `.env.local`.
- `pnpm typecheck`: pass on 2026-06-01 after Phase 8 cleanup.
- Frontend runtime wiring: pass on 2026-06-01. `POST /api/analysis/start` continues to queue `analysis-run`; with `ANALYSIS_ENGINE_VERSION=v2` or the split V2 flags, `analysis-run` starts the Engine V2 Trigger chain and the materialization task finalizes the analysis run.
- `pnpm test:unit`: pass on 2026-06-01; 399 tests passed.
- `pnpm analysis:v2:regression`: pass on 2026-06-01 with canonical, classification, enrichment, read-model, and known-bug assertions. The six Moralis fixture pages for the test wallet produced 534 provider rows, 534 distinct canonical transactions, zero duplicate tx hashes, chronological ordering, all six DataView surfaces, and stable known-bug coverage.
- `pnpm analysis:v2:run -- --wallet=0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954 --chain-id=8453 --mode=fixture --dry-run`: pass on 2026-06-01; task plan preserved lowercased wallet identity, chain id 8453, fixture mode, and Engine V2 task ordering from collection through materialization.
- `pnpm i18n:check`: pass on 2026-06-01.
- `pnpm ds:check`: pass on 2026-06-01; design-system checks passed. Existing advisory hardcoded-hex inventory remains outside Engine V2 scope.
- No Playwright, browser E2E, or automated a11y checks were added as Engine V2 release gates. The project already has an unrelated `test:a11y` script, but this feature remains covered by unit, repository, Trigger task, static DB-only, and deterministic regression checks.
- Request-time DataView verification: pass on 2026-06-01 through `db-only-read-models.test.ts`, `db-only-routes.test.ts`, repository import checks, and manual source scan. Activity, Deposits, Strategies, Pools, Rewards, and Governance consume materialized DB rows when `ANALYSIS_ENGINE_V2_READ_MODELS` is enabled and do not import provider-boundary clients on request paths.
