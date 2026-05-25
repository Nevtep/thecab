# Phase 0 Research: Analysis Engine (Jobs Pipeline)

**Feature**: `008-analysis-jobs`
**Date**: 2026-05-24
**Scope**: Resolve every architectural unknown for the background analysis engine that reconstructs a connected wallet's Aerodrome + Mellow portfolio history on Base mainnet. This document captures the decisions that the `spec.md`, `plan.md`, `data-model.md`, and `contracts/` will assume as settled.

Authoritative inputs:
- [docs/spec/the-cab-product-technical-spec.md](../../docs/spec/the-cab-product-technical-spec.md) — domain model, Trigger.dev decision, chain-aware identity rules.
- [docs/spec/the-cab-feature-feasibility-implementation-architecture.md](../../docs/spec/the-cab-feature-feasibility-implementation-architecture.md) — provider split, persistence identity, coverage semantics.
- [docs/spec/the-cab-moralis-alchemy-provider-research-v1.0.md](../../docs/spec/the-cab-moralis-alchemy-provider-research-v1.0.md) — endpoint responsibilities, `RawProviderRecord` rule.
- [docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md](../../docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md) — deposit identity, `mint` vs `increaseLiquidity` ambiguity, residual attribution.
- Existing specs `003-connected-wallet-overview`, `004-asset-trust-filtering`, `005-overview-protocol-positions`, `007-settings-screen` — surfaces the engine must feed without contract drift.

---

## R1. Job runtime selection

**Decision**: Use **Trigger.dev v3** as the durable job runtime for the analysis engine. Confirm the decision already recorded in the product spec.

**Rationale**:
- The app deploys to Vercel and is serverless. A separate durable runtime is mandatory because per-slice work (paged provider history + RPC reads + ABI decoding + price enrichment + DB writes) can exceed any Vercel function duration ceiling (60s hobby / 300s Pro / 900s Fluid).
- Trigger.dev v3 executes task code on its own compute, so per-task duration is bounded by `maxDuration` (configurable up to multiple hours on cloud, unbounded self-hosted) rather than by the Vercel HTTP runtime.
- Native primitives map 1:1 to the engine's DAG:
  - `triggerAndWait` / `batchTriggerAndWait` express parent/child fan-out and the global barrier before Activity (Phase D), Pool augmentation (Phase E), and Finalization (Phase F).
  - `idempotencyKey` directly enforces "one completed run per account per UTC day" and "skip already-processed slice" semantics without custom locking.
  - Per-task `queue: { concurrencyLimit }` and `concurrencyKey` provide a clean throttle for Moralis, Alchemy Prices, and Alchemy RPC rate budgets.
  - Per-task `retry` config delivers exponential backoff for provider `429`/`5xx` without custom code.
  - `metadata.set()` gives a live progress channel for the UI poll, while Postgres remains the source of truth.
- v3 is open source and self-hostable, providing an exit ramp if cloud pricing or vendor sovereignty becomes a concern.

**Alternatives considered**:
- **Inngest** — Closest runner-up. Comparable DAG, idempotency, concurrency keys, and durable-step model. Rejected for v1 because Inngest invokes the developer's own HTTP endpoints for each step, so every step must complete inside the Vercel function ceiling. A 90-day slice with rate-limited providers will exceed 300s; forcing artificial step-splitting trades clarity for runtime accommodation. Kept warm as Plan B.
- **BullMQ + Redis** — Requires a long-running Node worker (Render/Railway/Fly), contradicting the serverless deployment posture and adding infra not otherwise needed.
- **Temporal** — Capability fits but operational and conceptual overhead is excessive for a single-product v1.
- **Hatchet** — Promising, but smaller ecosystem and weaker Next.js/Vercel integration story than Trigger.dev v3 today.
- **Cloudflare Queues / SQS + Lambda / Vercel Cron + Functions** — Primitives only; would re-implement idempotency, DAG, retries, and observability by hand. Out of scope for v1.

**Caveats to honor in `plan.md`**:
- `maxDuration` must be set explicitly per task type (run orchestrator, slice, phase task, finalization). Defaults will clip Phase D on busy wallets.
- Trigger.dev metadata is for live UI hints only. Postgres (Drizzle) remains the source of truth for `AnalysisRun`, `AnalysisSlice`, `ProcessingCursor`, and `ProcessedTx`.
- Cost is per run-minute on Trigger Cloud. Worst-case sizing (4 × 90-day slices × Phase A+B + global D + E + F) must fit the chosen plan; self-hosting stays available if not.

---

## R2. Run lifecycle and once-per-day cap

**Decision**: An `AnalysisRun` is keyed by `(walletAddress, chainId)` and carries a `runId`, `mode` (`incremental` | `full_history`), `triggeredAtUtc`, `utcDayBucket` (`YYYY-MM-DD`), and `status` (`queued | running | complete | failed | cancelled`). At most one `complete` run per `(walletAddress, chainId, utcDayBucket)` exists. Re-invocations within the same UTC day short-circuit to the existing run summary without enqueuing new work.

**Rationale**:
- Aligns with the product non-goal of running open-ended continuous indexing. Confines provider cost and DB churn to one rebuild per account per day.
- UTC day buckets are deterministic across timezones and match the day-precision chart requirement (R4).
- Trigger.dev `idempotencyKey = run:{chainId}:{walletAddress}:{YYYY-MM-DD}` enforces the cap at the runtime layer; the DB unique constraint enforces it at the persistence layer.

**Mode rules**:
- New wallets (no prior `complete` run) are implicitly `full_history`. The engine processes up to 365 days backward from `triggeredAtUtc`.
- Wallets with a prior `complete` run default to `incremental`. The window is `[lastProcessedDayUtc, today)`, capped at 365 days.
- `mode = full_history` may be explicitly requested by the user via `POST /api/analysis/start` to force a full rebuild within the day cap; subsequent same-day triggers still short-circuit.

**Alternatives considered**:
- Per-account rolling cooldown (e.g. "once per 24h") — rejected: harder to reason about for the user and the cache invariants; UTC day boundary is simpler and matches chart precision.
- No cap, debounced re-runs — rejected: invites provider cost runaway and conflicts with the product spec.

---

## R3. Slicing strategy and resumability

**Decision**: Within a run, partition the target window into **90-day slices walking backward** from `triggeredAtUtc` toward the `lastProcessedDayUtc` cursor (or the 365-day horizon). Each slice is an independently persisted unit identified by `(walletAddress, chainId, sliceStart, sliceEnd)` with status `queued | running | complete | skipped_cached | failed`.

**Rationale**:
- 90 days is the empirical sweet spot for Moralis wallet history and Alchemy `getAssetTransfers` paging: small enough to keep a single slice well under the chosen `maxDuration`, large enough to limit slice count (≤5 per full-history run) and Trigger.dev billable run-minutes.
- Walking backward means the freshest slice runs first; the UI can render recent data while older slices stream in.
- Per-slice persistence lets a failed slice be retried without re-processing siblings, and enables the short-circuit cache (R5).

**Concurrency rules**:
- Per-slice tasks within a run run with a global `queue.concurrencyLimit` (e.g. 2) so that providers are not hammered by parallel slices on the same wallet.
- Multiple wallets analyze in parallel across the system; per-provider `concurrencyKey` throttles enforce global rate budgets independently of per-wallet limits.

**Alternatives considered**:
- 30-day slices — rejected: too many slices for full history, more orchestration overhead, no meaningful resilience gain.
- 180-day slices — rejected: too close to provider paging limits; risk of single-slice timeout.
- Forward walk (oldest first) — rejected: delays user-visible recent data and conflicts with the incremental-cursor model.

---

## R4. Day-level precision

**Decision**: All persisted timeline points (portfolio value, per-pool value, per-deposit value, rewards series, attribution snapshots) round to **UTC day boundaries**. Event-time valuation uses the day's `PricePoint` at `resolution = "daily"` unless a more precise quote was cached for the same `(chainId, tokenAddress, day)`. Sub-daily price granularity is out of scope for v1.

**Rationale**:
- The product surfaces (Overview chart, deposit lifecycle, rewards chart) all draw daily points. Higher resolution costs more provider calls without UX benefit.
- Daily buckets make the short-circuit cache (R5) trivially correct: a fully-processed day cannot be partially re-processed.
- Alchemy historical prices support daily resolution efficiently with address-based queries.

**Rules**:
- `PricePoint.resolution = "daily"` is the default and only resolution v1 stores. The product spec's price identity (`chainId + tokenAddress + timestamp + source + resolution`) still applies.
- Daily price lookups are batched per slice: collect unique `(tokenAddress, day)` tuples from all events in the slice, then issue minimal Alchemy historical-prices calls.

---

## R5. Short-circuit cache and processed cursor

**Decision**: Maintain two persistence layers for the cache:

1. **`ProcessingCursor`** — one row per `(walletAddress, chainId)` storing `lastProcessedDayUtc` (the most recent UTC day fully processed by a `complete` run) and `lastProcessedBlockNumber` (best-effort upper bound for reorg tolerance).
2. **`ProcessedTx`** — append-only index keyed by `(chainId, txHash)` recording the run that first processed the transaction, the slice it belonged to, and the block number.

When a slice job starts, it computes its effective window:
- If `sliceEnd <= lastProcessedDayUtc`, the slice is marked `skipped_cached` and returns immediately without any provider call.
- Otherwise it queries the wallet history provider only for `[max(sliceStart, lastProcessedDayUtc), sliceEnd]`. Any returned transaction whose `txHash` is already in `ProcessedTx` is skipped before decoding/pricing.

**Reorg tolerance**: The engine treats the most recent 32 blocks as "soft" and re-checks them on incremental runs by ignoring `ProcessedTx` rows whose `blockNumber > head - 32`. Day-resolution finalization for a UTC day is deferred until 32 blocks past the day's last block, so daily snapshots are never re-written.

**Rationale**:
- The two-layer cache delivers the user's stated goal: a re-run one week after the first analysis only fetches the last 7 days; once it crosses `lastProcessedDayUtc`, every remaining slice exits in milliseconds without provider traffic.
- Per-tx granularity protects against partial-slice failures: if a slice failed halfway through, only its unprocessed transactions are fetched on retry.
- 32-block tolerance comfortably covers Base reorgs (typical depth ≤2 blocks) without forcing daily re-writes.

**Alternatives considered**:
- Block-range cursor only (no per-tx index) — rejected: cannot distinguish partial-slice failures from full coverage.
- Per-tx index only (no day cursor) — rejected: forces a provider call per slice to determine boundaries.
- Aggressive reorg re-scanning (whole-day re-process) — rejected: defeats the cache and is unnecessary on Base.

---

## R6. Phase DAG inside a run

**Decision**: Each run is a Trigger.dev parent task `analysis.run` that orchestrates child tasks in this order:

```
analysis.run
  └─ for each slice (backward, concurrencyLimit applied):
       analysis.slice
         ├─ phase.deposits         (A)  — manual + strategy lifecycle
         └─ phase.rewards          (B)  — depends on A within the slice
  ── barrier: await all slices complete ──
  ├─ phase.activity                (D)  — rebalance detection + wallet activity enrichment
  ├─ phase.pools                   (E)  — depends on D
  └─ phase.finalize                (F)  — daily snapshots + cursor advance + status flip
```

**Rationale**:
- Phase A (Deposits & Strategies) is the source of truth for which positions exist in the slice. Phase B (Rewards) needs A's output to know which deposits were staked when, so B is gated on A within the slice.
- Phase C (slice handoff) is implicit: completing A+B for slice N unblocks slice N-1's enqueue; the parent task drives this with `batchTriggerAndWait`.
- Phase D (Activity) requires the full set of deposit lifecycles across all slices to correctly classify rebalances (withdraw → swap → redeposit windows can span slice boundaries), so it runs after every slice's A+B completes.
- Phase E (Pools) augments aggregated data with metadata reads; running after D ensures its inputs are complete.
- Phase F (Finalize) writes `PerformanceSnapshot` daily points, advances `ProcessingCursor`, and flips `AnalysisRun.status = complete`.

**Within-phase parallelism**:
- Phase A fans out per discovered `(positionManager, tokenId)` and per Mellow `(wrapperAddress)` candidate via `batchTriggerAndWait` with its own concurrency limit.
- Phase B fans out per deposit/strategy from A's output.
- Phase D processes the global remaining-tx list in batches of N (configurable) with bounded concurrency.

**Alternatives considered**:
- Run D per-slice and stitch later — rejected: rebalance windows would be cut at slice boundaries, producing false negatives.
- Merge D into B — rejected: violates separation of concerns and prevents independent retry of activity classification.

---

## R7. Per-phase responsibilities and entity writes

| Phase | Reads | Writes (idempotent upserts) | Notes |
|---|---|---|---|
| A — Deposits & Strategies | Moralis wallet history, Moralis NFT transfers (position manager), Alchemy RPC logs (`IncreaseLiquidity`, `DecreaseLiquidity`, `Collect`, gauge `Deposit`/`Withdraw`, Mellow wrapper deposit/withdraw), contract reads for tickRange/factory | `RawProviderRecord`, `Deposit`, `Strategy`, `StrategyExposure`, `LedgerEvent` (lifecycle events), `AssetMovement` | Respects `mint` vs `increaseLiquidity(existing tokenId)` rule from protocol research §3.3. Mellow exposure never modeled as an NFT deposit. |
| B — Rewards | Phase A output + Alchemy RPC logs (gauge `ClaimRewards`, voter fees/bribes, Mellow reward distributions), Collect events from A | `RewardEvent`, per-day reward snapshot rows keyed by `(chainId, depositOrStrategyId, day)` | Snapshots claimed and unclaimed accruals at slice boundaries so the daily rewards line is renderable. Uses contract reads for unclaimed amounts at the slice end block. |
| D — Activity | All Phase A+B output + remaining wallet transactions not yet classified | `LedgerEvent` (enriched classification), `AttributionState`, `AttributionSourceLot` | Rebalance heuristic: `decreaseLiquidity`/withdraw of token T from pool P → swap touching T within a bounded window (default 24h) → deposit into P. Window bound documented in `data-model.md`. Residual attribution per product spec §6. |
| E — Pools | All Phase A/B/D output + on-demand contract reads for missing pool metadata | `Pool`, `PoolMetricsSnapshot` (daily), `ProtocolContract` (factory/gauge if newly discovered) | Factory address discovered via `router.defaultFactory()` per protocol research §4.3; not hardcoded. |
| F — Finalize | All prior output | `PerformanceSnapshot` (daily, portfolio/pool/deposit/strategy), advance `ProcessingCursor`, set `AnalysisRun.status = complete`, set `completedAtUtc` | Single transactional advance of cursor + status flip so the cache invariants are atomic. |

All writes are upserts keyed by the chain-aware identities defined in the product spec §2.3 of the feasibility doc. No address-only or hash-only unique constraints.

---

## R8. Provider responsibility and rate-budget rules

**Decision**: Honor the provider split from the Moralis & Alchemy research:

- **Moralis** — wallet history discovery, ERC-20 transfers, NFT transfers, decoded transaction summaries (used as hints only). Never the canonical price source.
- **Alchemy Prices** — current and historical token prices. Address-based preferred; symbol fallback marked lower confidence in `PricePoint.source`.
- **Alchemy RPC** — `eth_getLogs`, `eth_getTransactionReceipt`, `eth_call` for ABI-driven decoding and contract reads.
- **Alchemy `alchemy_getAssetTransfers`** — fallback when Moralis history is incomplete or ambiguous.

**Rate budgets**:
- Each provider has a dedicated Trigger.dev queue with a `concurrencyKey` and `concurrencyLimit` set from environment variables, so global RPS stays under plan limits regardless of how many wallets are analyzing concurrently.
- Per-request retry policy: 5 attempts, exponential backoff starting at 1s with jitter, on `429`/`5xx`/network. Final failure surfaces a coverage reason code (`providerThrottled`, `providerError`) on the affected slice and does not poison sibling work.

**Raw record persistence**: Every external response is stored as a `RawProviderRecord` row keyed by `(provider, endpoint, request hash, fetchedAt)` before normalization, per the provider research. This guarantees auditability and lets re-classification re-run without re-fetching.

---

## R9. Failure isolation and degraded completion

**Decision**: A single slice failure does not block the run. After a slice's retry budget is exhausted:

- The slice is marked `failed` with a structured reason (`providerError`, `decodeError`, `pricingPartial`, `unknownError`).
- The run continues. Phase D/E/F still execute over the slices that did complete.
- The run completes with `status = complete` and `coverage = partial`, carrying `coverageReasons[]` so the UI can label the result truthfully (`Coverage partial` per brand copy).
- `ProcessingCursor` advances only to the latest fully-`complete` day. Failed-slice days are eligible for retry on the next incremental run.

**Rationale**:
- The product spec mandates honest coverage reporting over fabricated completeness.
- Allowing degraded completion prevents indefinite blocking by transient provider issues while preserving correctness of the cache invariant ("`lastProcessedDayUtc` is fully processed").

**Cancellation**: Runs may be cancelled via `POST /api/analysis/cancel`. The orchestrator marks the run `cancelled`; in-flight slices finish their current step and short-circuit. `ProcessingCursor` does not advance on cancellation.

---

## R10. Idempotency key scheme

**Decision**: Trigger.dev `idempotencyKey` is set at every level:

| Trigger | Key |
|---|---|
| `analysis.run` (top-level) | `run:{chainId}:{walletAddress}:{YYYY-MM-DD}` |
| `analysis.slice` | `slice:{chainId}:{walletAddress}:{sliceStart}:{sliceEnd}` |
| `phase.deposits` per candidate | `deposits:{chainId}:{walletAddress}:{positionManagerOrWrapper}:{identity}:{sliceStart}` |
| `phase.rewards` per deposit/strategy | `rewards:{chainId}:{depositOrStrategyId}:{sliceStart}` |
| `phase.activity` (singleton per run) | `activity:{runId}` |
| `phase.pools` (singleton per run) | `pools:{runId}` |
| `phase.finalize` (singleton per run) | `finalize:{runId}` |

Combined with the DB unique constraints on `AnalysisRun(walletAddress, chainId, utcDayBucket) where status = 'complete'` and on each entity's chain-aware identity, double-execution cannot produce duplicate rows even under retry.

---

## R11. API surface delta

**Decision**: The engine exposes/refines these routes (all chain-aware, all i18n-friendly error envelopes):

- `POST /api/analysis/start` — body: `{ walletAddress, chainId, mode?: "incremental" | "full_history" }`. Returns the existing same-day completed run when present, otherwise enqueues `analysis.run` and returns `{ runId, status }`.
- `GET /api/analysis/status?walletAddress=&chainId=` — returns the canonical analysis status (per `007-settings-screen` R1) plus per-phase and per-slice progress, `coverageReasons[]`, and `lastSuccessfulRunAt`.
- `POST /api/analysis/cancel` — body: `{ runId }`. Marks the run `cancelled`.

`/api/wallet/overview`, `/api/pools`, `/api/deposits`, `/api/strategies`, `/api/rewards`, `/api/activity` continue to read from the normalized domain tables — they do not call the engine directly. The engine is the sole writer to those tables for protocol-derived data.

---

## R12. Observability and progress reporting

**Decision**: Two complementary channels:

- **Postgres (source of truth)**: `AnalysisRun`, `AnalysisSlice`, and per-phase rows expose status, counts, timing, and `coverageReasons[]`. `/api/analysis/status` reads from here. The UI may poll every 5s while a run is `running`.
- **Trigger.dev metadata (live hint)**: each task calls `metadata.set({ phase, sliceIndex, totalSlices, processedTxs, totalTxs })` for richer dashboard observability and optional UI streaming. Not required for correctness; loss of metadata never affects the persisted run state.

Errors are logged structured (`runId`, `sliceId`, `phase`, `provider`, `reason`, `attempt`) for both Trigger.dev and the app logger so the same trace is reconstructable from either side.

---

## R13. Out of scope for v1

- Multi-chain runs (architecture is chain-aware but only Base mainnet is wired).
- Sub-daily price granularity and intraday snapshots.
- Continuous background analysis without a user-triggered or scheduled start (the once-per-UTC-day cap is the contract).
- Deep reorg recovery beyond the 32-block soft window.
- Cross-wallet analytics, leaderboards, or aggregations.
- Push notifications when a run completes (UI polls).

---

## R14. Open verification items (carried into `plan.md` / implementation)

These do not block the spec but must be resolved during implementation:

1. **Mellow event coverage** per wrapper/vault — confirm the exact event set emitted by each Mellow Aerodrome strategy and whether contract reads are needed for share valuation. Source: protocol research §1 "Needs further verification".
2. **Gauge-to-pool discovery** for every Aerodrome pool type (CL vs stable vs volatile). Strategy: cache discovered `(gauge → pool)` mappings in `ProtocolContract` with provenance.
3. **Rebalance window default** (currently 24h) — validate against a sample of real wallets before locking. Make the value a config constant, not a magic number in code.
4. **Trigger.dev plan sizing** — measure a worst-case full-history run (5 slices × Phase A+B + D + E + F + retries) against the cloud plan's run-minute budget. Self-hosted fallback path documented in deployment notes.
5. **Unclaimed-reward valuation precision** — decide whether unclaimed amounts at slice end use the slice-end block's contract read or extrapolate from the most recent claim, when contract reads are not feasible.
