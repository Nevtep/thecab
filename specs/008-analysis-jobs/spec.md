# Feature Specification: Analysis Engine (Background Jobs Pipeline)

**Feature Branch**: `008-analysis-jobs`  
**Created**: 2026-05-24  
**Status**: Draft  
**Input**: User description: "The Cab's Analysis Engine — the background pipeline that reconstructs a connected wallet's Aerodrome + Mellow portfolio history on Base mainnet and produces the normalized domain data consumed by Overview, Pools, Deposits, Strategies, Rewards, Governance, and Activity surfaces."

**Authoritative inputs** (already accepted; this spec does not re-litigate them):

- [docs/spec/the-cab-product-technical-spec.md](../../docs/spec/the-cab-product-technical-spec.md) (v1.4.3) — domain model, Trigger.dev decision, chain-aware identity rules.
- [docs/spec/the-cab-feature-feasibility-implementation-architecture.md](../../docs/spec/the-cab-feature-feasibility-implementation-architecture.md) (v1.2) — provider split, persistence identity, coverage semantics.
- [docs/spec/the-cab-moralis-alchemy-provider-research-v1.0.md](../../docs/spec/the-cab-moralis-alchemy-provider-research-v1.0.md) (v1.0) — endpoint responsibilities, `RawProviderRecord` rule.
- [docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md](../../docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md) (v1.1) — deposit identity, `mint` vs `increaseLiquidity` ambiguity, residual attribution.
- [docs/spec/the-cab-brand-spec.md](../../docs/spec/the-cab-brand-spec.md) — control-tower brand tone.
- [specs/003-connected-wallet-overview](../003-connected-wallet-overview/spec.md), [specs/004-asset-trust-filtering](../004-asset-trust-filtering/spec.md), [specs/005-overview-protocol-positions](../005-overview-protocol-positions/spec.md), [specs/007-settings-screen](../007-settings-screen/spec.md) — downstream surfaces the engine must feed without contract drift.
- [specs/008-analysis-jobs/research.md](research.md) — accepted Phase 0 decisions. This spec cites `research.md §RN` rather than restating them.

**Stage scope**: This feature delivers the v1 Analysis Engine: a chain-aware, Trigger.dev v3 background pipeline that walks a connected wallet's Base mainnet history in 90-day slices (research.md §R3), produces daily-resolution normalized domain data (research.md §R4), short-circuits on a per-wallet processing cursor with 32-block reorg tolerance (research.md §R5), and exposes start/status/cancel APIs that match the canonical analysis status vocabulary defined in [specs/007-settings-screen](../007-settings-screen/spec.md). It does not introduce sub-daily price granularity, multi-chain runs, continuous background sweeps, deep reorg recovery beyond 32 blocks, or push notifications (research.md §R13).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — First-Time Full-History Reconstruction For A New Wallet (Priority: P1)

As a connected user who has just analyzed my wallet for the first time, I need the engine to reconstruct up to one year of my Aerodrome and Mellow activity on Base in a single run so Overview, Pools, Deposits, Strategies, Rewards, and Activity can render an honest historical picture without me having to trigger anything else.

**Why this priority**: The product cannot show historical lifecycle, attribution, or daily series at all without this run. Every downstream surface (003, 004, 005) depends on it. This is the engine's defining outcome.

**Independent Test**: Connect a wallet on Base mainnet with no prior analysis run, trigger `POST /api/analysis/start`, and verify that the run partitions the 365-day window into 90-day slices walking backward from `triggeredAtUtc`, executes Phase A→B per slice, then Phase D→E→F as global barriers, and finalizes daily-resolution series for portfolio value, per-pool value, per-deposit value, per-strategy value, and rewards.

**Acceptance Scenarios**:

1. **Given** a connected wallet on `chainId = 8453` with no prior `complete` `AnalysisRun`, **When** the user invokes `POST /api/analysis/start { walletAddress, chainId }`, **Then** the engine implicitly runs in `full_history` mode, partitions the window into at most five 90-day slices walking backward from `triggeredAtUtc`, and exposes per-slice progress through `GET /api/analysis/status`.
2. **Given** the run is `running`, **When** any slice completes Phase A and Phase B, **Then** the next-older slice is unblocked for enqueue and per-slice status transitions are observable via the status endpoint without polling Trigger.dev directly.
3. **Given** every slice has completed (`complete` or `failed`) and the global barrier is reached, **When** Phase D runs, **Then** canonical residual-flow inference classifies same-pool rebalances, same-pool redeploys, liquidations, and cash-outs across slice boundaries from deterministic source lots rather than bounded time windows.
4. **Given** Phase D, E, and F all succeed, **When** the run finalizes, **Then** `AnalysisRun.status = complete`, `ProcessingCursor.lastProcessedDayUtc` advances to the latest fully-processed UTC day, and daily `PerformanceSnapshot` series for portfolio, per-pool, per-deposit, per-strategy, and rewards exist for every covered day.

---

### User Story 2 — Incremental Re-Run Short-Circuits On The Processing Cursor (Priority: P1)

As a user re-analyzing my wallet a week after the first run, I need the engine to fetch only the days that have elapsed since the prior cursor and short-circuit every slice that is already fully behind the cursor, so re-runs are fast and do not waste provider quota.

**Why this priority**: Without the short-circuit, every re-run pays the full provider cost again. The cursor + per-tx index is the engine's core efficiency guarantee.

**Independent Test**: Run a full-history analysis on a wallet, wait a week of real or simulated time, trigger a second `POST /api/analysis/start`, and verify that only the new days were fetched from providers, that slices fully behind `lastProcessedDayUtc` return `skipped_cached` without provider calls, and that the second run still produces daily series covering the entire 365-day window.

**Acceptance Scenarios**:

1. **Given** a wallet with `ProcessingCursor.lastProcessedDayUtc = D` from a prior `complete` run, **When** a new run starts on day `D + 7`, **Then** the engine plans slices walking backward from `D + 7` and any slice whose `sliceEnd <= D` is marked `skipped_cached` immediately without any Moralis or Alchemy call.
2. **Given** the freshest slice spans `[D, D + 7]`, **When** Phase A queries wallet history, **Then** the effective request window is `[max(sliceStart, D), sliceEnd]` and any returned `txHash` already in `ProcessedTx` is dropped before decoding or pricing (research.md §R5).
3. **Given** the soft reorg window is the most recent 32 blocks, **When** the incremental run encounters `ProcessedTx` rows whose `blockNumber > head − 32`, **Then** those rows are re-checked rather than blindly trusted, while older rows continue to short-circuit.
4. **Given** the incremental run completes, **When** `ProcessingCursor` advances, **Then** it advances only to the latest fully-`complete` day (failed-slice days remain eligible for retry on the next run).

---

### User Story 3 — One Completed Run Per Account Per UTC Day (Priority: P1)

As the system operator, I need the engine to guarantee at most one completed full run per `(walletAddress, chainId, utcDayBucket)` so that repeated triggers — from impatient users, racing tabs, or status polling — cannot double-charge providers or duplicate domain rows.

**Why this priority**: Without this cap, provider cost and DB churn are unbounded under user pressure. It is also the contract the Settings UI relies on (research.md §R2).

**Independent Test**: Trigger `POST /api/analysis/start` twice within the same UTC day for the same `(walletAddress, chainId)` and verify the second call returns the existing run summary without enqueuing new work, and that no duplicate rows appear in the engine's domain tables.

**Acceptance Scenarios**:

1. **Given** a `complete` run already exists for `(walletAddress, chainId, utcDayBucket)`, **When** another `POST /api/analysis/start` is received the same UTC day, **Then** the API returns the existing run summary with the same `runId` and does not enqueue another `analysis.run` task.
2. **Given** a run is currently `queued` or `running` for the same `(walletAddress, chainId)`, **When** another `POST /api/analysis/start` is received, **Then** the API returns the in-flight `runId` and status, never a second concurrent run.
3. **Given** the UTC day rolls over, **When** the user triggers `POST /api/analysis/start` again, **Then** a new `AnalysisRun` is created and runs in `incremental` mode by default against the existing cursor.
4. **Given** the user explicitly passes `mode = "full_history"` after the UTC day rolls over, **When** the run starts, **Then** the engine plans the full 365-day window again but still respects the once-per-UTC-day cap for that new day.

---

### User Story 4 — Degraded Completion When A Slice Fails (Priority: P2)

As a user whose wallet hit a transient provider error on one slice, I need the engine to finish the run with the slices that did succeed, label the result as partial coverage, and tell me which reasons applied, so I am not blocked indefinitely and I am not lied to about completeness.

**Why this priority**: Honest coverage reporting is a product invariant. Without failure isolation, one slice taking out the whole run would erase the rest of the user's history reconstruction and contradict the product's coverage contract.

**Independent Test**: Inject a sustained `429`/`5xx` for one slice's provider calls, run a full-history analysis, and verify that the run finishes with `status = complete`, `coverage = partial`, the failing slice carries a structured reason, and `coverageReasons[]` is surfaced via `GET /api/analysis/status` in a UI-renderable form.

**Acceptance Scenarios**:

1. **Given** a slice exhausts its retry budget (5 attempts, exponential backoff with jitter on `429`/`5xx`/network per research.md §R8), **When** the run continues, **Then** sibling slices are not poisoned, Phase D/E/F still execute over the slices that did complete, and the run ends with `status = complete` and `coverage = partial`.
2. **Given** at least one slice failed, **When** `GET /api/analysis/status` is called, **Then** the response carries `coverageReasons[]` drawn from the controlled vocabulary (`missingPrices`, `partialDecoded`, `providerError`, `providerThrottled`, `reorgSuspect`, `decodeError`, `pricingPartial`, `unknownError`) and never a fabricated `100% coverage` claim.
3. **Given** a degraded run finalizes, **When** `ProcessingCursor` advances, **Then** it advances only to the latest fully-`complete` day, leaving failed-slice days eligible for retry on the next incremental run.
4. **Given** a fatal orchestrator error (not a slice-local error) interrupts the run, **When** the engine cannot continue, **Then** the run ends with `status = failed` and `ProcessingCursor` does not advance.

---

### User Story 5 — User Cancels A Running Analysis (Priority: P2)

As a connected user who triggered the wrong analysis or wants to abort a long run, I need to cancel it from Settings so the engine stops enqueuing new work, records the run internally as `cancelled`, and does not advance the processing cursor while the public status API still projects the canonical analysis vocabulary.

**Why this priority**: Cancellation is required by the Settings surface (007) for user control and operational safety. It also bounds runaway cost when an operator needs to intervene.

**Independent Test**: Start a run, call `POST /api/analysis/cancel { runId }` while at least one slice is still in flight, and verify the run reaches internal `status = cancelled`, no new slices are enqueued, `ProcessingCursor` does not advance, and the public status endpoint projects the correct canonical post-cancel state without leaking `cancelled`.

**Acceptance Scenarios**:

1. **Given** a run is `queued` or `running`, **When** the user invokes `POST /api/analysis/cancel { runId }`, **Then** the orchestrator transitions the run to `cancelled`, in-flight slice tasks finish their current step and short-circuit, and no further `analysis.slice` or phase tasks are enqueued for that run.
2. **Given** a run is `cancelled`, **When** `GET /api/analysis/status` is called, **Then** the API does not leak the internal `cancelled` state and instead projects the canonical 007 status truthfully: `not_analyzed` if no prior successful run exists for that wallet, otherwise `ready` or `stale` based on the latest successful run.
3. **Given** a run is `cancelled`, **When** the user triggers another `POST /api/analysis/start` later the same UTC day, **Then** the engine treats it as a fresh trigger (the cancelled run does not satisfy the once-per-day completed-run cap) and enqueues a new `analysis.run`.
4. **Given** a run is already `complete`, **When** `POST /api/analysis/cancel` is called for it, **Then** the API returns a stable error envelope without mutating the completed run.

---

### User Story 6 — Daily-Resolution Series Power Every Downstream Surface (Priority: P1)

As a downstream surface (Overview, Pools, Deposits, Strategies, Rewards, Activity), I need the engine to write daily `PerformanceSnapshot`, per-pool, per-deposit, per-strategy, and rewards series so my read-model can render charts and lifecycle timelines without re-deriving them from raw events at request time.

**Why this priority**: The engine is the sole writer for these tables. Without daily series, downstream surfaces cannot render their chart contracts and would be forced to compute from raw events on every request — violating the product architecture.

**Independent Test**: After a `complete` run, query the engine's domain tables for a wallet with known activity and verify that daily portfolio value, per-pool value, per-deposit value, per-strategy value, and rewards rows exist for every UTC day in the covered window, that no day is skipped, and that values round to the day's `PricePoint` at `resolution = "daily"` (research.md §R4).

**Acceptance Scenarios**:

1. **Given** Phase F completes, **When** any downstream surface reads `PerformanceSnapshot` for the wallet, **Then** rows exist for every UTC day from the run's covered window start through `lastProcessedDayUtc`, with no gaps inside the covered window.
2. **Given** an event occurred on UTC day D, **When** the snapshot for D is written, **Then** valuation uses the `PricePoint` at `(chainId, tokenAddress, day = D, resolution = "daily")`, preferring address-based Alchemy prices over symbol fallback, with `PricePoint.source` recording the actual source used (research.md §R4, §R8).
3. **Given** a Mellow position exists for the wallet, **When** snapshots are written, **Then** Mellow exposure is tracked by `(chainId, wrapperAddress)` and never modeled as an NFT deposit (research.md §R7).
4. **Given** an Aerodrome NFT deposit's `tokenId` was created by `mint()` versus `increaseLiquidity(existing tokenId)`, **When** Phase A reconstructs lifecycle, **Then** the `mint` vs `increaseLiquidity` ambiguity rule from the protocol research is honored and the deposit lifecycle is not double-counted.

---

### User Story 7 — Honest, Localized Status For The UI (Priority: P2)

As the Settings and Overview UI, I need `GET /api/analysis/status` to return the canonical analysis status vocabulary from spec 007-settings-screen plus per-phase and per-slice progress, `coverageReasons[]`, and `lastSuccessfulRunAt`, all in a shape that can be rendered through i18next namespaces without hardcoded copy.

**Why this priority**: The UI cannot show truthful, localized progress without this contract. It is also the only way the once-per-UTC-day cap is visible to users.

**Independent Test**: Across a wallet's lifetime (`not_analyzed → queued → running → ready → stale → failed` per spec 007-settings-screen), call `GET /api/analysis/status` at each transition and verify the returned status string is the canonical enum, that per-phase and per-slice progress fields are present and consistent with the persisted state, and that no user-facing English copy is returned in the payload.

**Acceptance Scenarios**:

1. **Given** any wallet/chain combination, **When** `GET /api/analysis/status?walletAddress=&chainId=` is called, **Then** the response carries exactly one of `not_analyzed | queued | running | ready | stale | failed` (matching spec 007-settings-screen R1) and never an engine-internal status like `complete` or `cancelled` leaked through.
2. **Given** a run is `running`, **When** status is polled, **Then** the response includes per-phase progress (A/B/D/E/F) and per-slice progress (`queued`, `running`, `complete`, `skipped_cached`, `failed`) sourced from Postgres, not from Trigger.dev metadata (research.md §R12).
3. **Given** prior runs exist, **When** status is fetched, **Then** the response includes `lastSuccessfulRunAt` (UTC ISO timestamp) and a stable `runId` for the current or most-recent run.
4. **Given** any user-facing label is needed (status, coverage reason, error reason), **When** the UI renders, **Then** the engine returns machine codes only; the UI maps them through the `analysis`, `coverage`, and `errors` i18next namespaces.

---

### Edge Cases

- The wallet has zero on-chain Aerodrome/Mellow activity in the entire 365-day window: the run still completes, all slices return empty, `PerformanceSnapshot` rows are written as zero-position days, and `coverage = full`.
- A slice spans the deployment date of Aerodrome on Base (older than protocol existence): the slice still runs, returns empty for the pre-deployment days, and does not error.
- Two browser tabs trigger `POST /api/analysis/start` for the same wallet within milliseconds: the second request receives the same `runId` as the first (`idempotencyKey = run:{chainId}:{walletAddress}:{YYYY-MM-DD}` per research.md §R10).
- A wallet has activity on a chain other than `chainId = 8453`: v1 only analyzes Base; the request is rejected with a chain-aware validation error and never silently coerced.
- A reorg moves a transaction across a day boundary within the 32-block soft window: the affected `ProcessedTx` row is re-checked and snapshots for the affected day are recomputed before finalization (research.md §R5).
- Alchemy historical prices are missing for a `(chainId, tokenAddress, day)` tuple: the slice records `missingPrices` in its coverage reasons, the affected snapshot still renders with the best available price (symbol fallback marked lower confidence), and the run completes with `coverage = partial`.
- A previously-unknown gauge or factory address is discovered during Phase E: it is persisted as a `ProtocolContract` with provenance, and the rebuild does not hardcode factory addresses (research.md §R7; factory discovered via `router.defaultFactory()` per protocol research §4.3).
- Trigger.dev metadata is lost or stale: Postgres remains the source of truth; the run completes and the UI status polling continues to render correctly from persisted state (research.md §R12).
- A user cancels a run, then immediately retriggers it: cancellation does not satisfy the once-per-day cap; a fresh run is enqueued and the cancelled run remains observable in the run history.
- An `analysis.run` parent task crashes between Phase E and Phase F: re-execution with the same `idempotencyKey` resumes from the persisted slice/phase state and reaches `complete` without duplicate writes (research.md §R10).
- A `decreaseLiquidity` or manual withdrawal that creates residual source lots in one slice is later consumed by a same-pool swap or redeposit in another slice: Phase D runs after the global barrier and classifies the resulting canonical inferred action from deterministic residual/source-lot state, so slice boundaries do not produce a false negative (research.md §R6).
- The wallet history provider (Moralis) returns an incomplete page set: the engine falls back to `alchemy_getAssetTransfers` for that slice and records the fallback in the slice's `RawProviderRecord` provenance (research.md §R8).

## Requirements *(mandatory)*

### Stage Scope Constraint *(mandatory)*

- This feature implements the v1 Analysis Engine background pipeline only. It MUST NOT introduce sub-daily price granularity, multi-chain runs, continuous background sweeps, deep reorg recovery beyond the 32-block soft window, push notifications, cross-wallet analytics, or leaderboards (research.md §R13).
- This feature MUST reuse the canonical analysis status vocabulary defined in [specs/007-settings-screen](../007-settings-screen/spec.md) and MUST NOT introduce parallel status enums.
- This feature MUST write only into the engine's normalized domain tables that downstream surfaces (003, 004, 005) already consume; it MUST NOT redesign those table contracts inside this spec.

### Functional Requirements

#### 1) Run Lifecycle

- **FR-001**: The engine MUST model a run as `AnalysisRun` keyed by `(walletAddress, chainId)` with a `runId`, `mode` (`incremental` | `full_history`), `triggeredAtUtc`, `utcDayBucket` (`YYYY-MM-DD`), and `status` (`queued | running | complete | failed | cancelled`) per research.md §R2.
- **FR-002**: The engine MUST enforce at most one `complete` `AnalysisRun` per `(walletAddress, chainId, utcDayBucket)` via a DB unique constraint on `status = 'complete'` rows plus a Trigger.dev `idempotencyKey = run:{chainId}:{walletAddress}:{YYYY-MM-DD}` (research.md §R2, §R10).
- **FR-003**: Re-invocations of `POST /api/analysis/start` within the same UTC day for the same `(walletAddress, chainId)` MUST short-circuit and return the existing `complete` or in-flight run summary without enqueuing new work.
- **FR-004**: New wallets (no prior `complete` run) MUST be implicitly treated as `mode = full_history`. Wallets with a prior `complete` run MUST default to `mode = incremental`. `mode = full_history` MAY be explicitly requested by the client.
- **FR-005**: The maximum backwards window MUST be 365 days from `triggeredAtUtc` (UTC). Activity older than 365 days is out of scope for v1.
- **FR-006**: Every persisted record, job payload, query key, and provider call MUST carry `chainId`. v1 wires only `chainId = 8453` (Base mainnet) but no record, payload, or key MAY omit `chainId`.

#### 2) Slicing Strategy

- **FR-007**: A run MUST partition its target window into 90-day slices walking backward from `triggeredAtUtc` toward the cursor or 365-day horizon (research.md §R3).
- **FR-008**: Each slice MUST be persisted as `AnalysisSlice` identified by `(walletAddress, chainId, sliceStart, sliceEnd)` with status `queued | running | complete | skipped_cached | failed`.
- **FR-009**: All persisted timeline points MUST round to UTC day boundaries. v1 stores `PricePoint.resolution = "daily"` only (research.md §R4).
- **FR-010**: Per-run slice concurrency MUST be bounded (default: 2 concurrent slices) via a Trigger.dev `queue.concurrencyLimit`. Multiple wallets MAY analyze in parallel system-wide.

#### 3) Short-Circuit Cache And Reorg Tolerance

- **FR-011**: The engine MUST maintain `ProcessingCursor` rows keyed by `(walletAddress, chainId)` storing `lastProcessedDayUtc` and `lastProcessedBlockNumber` (research.md §R5).
- **FR-012**: The engine MUST maintain a `ProcessedTx` append-only index keyed by `(chainId, txHash)` recording the run/slice that first processed each transaction and its `blockNumber`.
- **FR-013**: A slice whose `sliceEnd <= lastProcessedDayUtc` MUST be marked `skipped_cached` without any provider call.
- **FR-014**: A slice that overlaps the cursor MUST limit its effective request window to `[max(sliceStart, lastProcessedDayUtc), sliceEnd]` and MUST drop any returned `txHash` already in `ProcessedTx`.
- **FR-015**: The engine MUST treat the most recent 32 blocks as a soft reorg window and MUST re-check `ProcessedTx` rows whose `blockNumber > head − 32` on incremental runs.
- **FR-016**: Daily snapshots for a UTC day MUST only be finalized when the chain head is at least 32 blocks past the day's last block.
- **FR-017**: `ProcessingCursor` MUST advance only to the latest fully-`complete` UTC day. Failed-slice days MUST remain eligible for retry on the next run.

#### 4) Phase DAG

- **FR-018**: A run MUST execute the phases in this order (research.md §R6):
  1. **Phase A** (Deposits & Strategies) per slice, fanning out per `(positionManager, tokenId)` and per Mellow `(wrapperAddress)` candidate.
  2. **Phase B** (Rewards) per slice, depending on Phase A within the same slice; fans out per deposit/strategy from A.
  3. **Slice handoff**: completing A+B for slice N unblocks enqueue of slice N−1.
  4. **Phase D** (Activity classification) — global barrier after all slices' A+B complete.
  5. **Phase E** (Pool augmentation) — after Phase D.
  6. **Phase F** (Run finalization) — daily `PerformanceSnapshot` writes, `ProcessingCursor` advance, status flip to `complete`.
- **FR-019**: Phase D MUST classify higher-order wallet activity from deterministic source-of-funds and residual-flow state. Same-pool rebalances and same-pool redeploys MUST be emitted only when canonical attribution links the consuming action back to the originating pool's residual lots; time-window heuristics MUST NOT decide these labels.
- **FR-020**: Phase A MUST honor the `mint()` vs `increaseLiquidity(existing tokenId)` ambiguity rule from the protocol research and MUST NOT double-count deposit lifecycles.
- **FR-021**: Mellow exposure MUST be tracked by `(chainId, wrapperAddress)` and MUST NEVER be modeled as an NFT deposit (research.md §R7).
- **FR-022**: Phase E MUST discover factory and gauge addresses dynamically (e.g. `router.defaultFactory()` per protocol research §4.3) and persist them to `ProtocolContract` with provenance; factory and gauge addresses MUST NOT be hardcoded in engine code.
- **FR-023**: Phase F MUST advance `ProcessingCursor` and flip `AnalysisRun.status = complete` in a single transaction so the cache invariant is atomic.

#### 5) Parallelism Rules

- **FR-024**: Within a slice, Phase A MUST fan out per `(positionManager, tokenId)` and per Mellow wrapper candidate via Trigger.dev `batchTriggerAndWait`.
- **FR-025**: Within a slice, Phase B MUST fan out per deposit/strategy from Phase A output.
- **FR-026**: Phase D, E, and F MUST be singletons per `runId` (one execution per run; idempotency keys per research.md §R10).
- **FR-027**: The engine MUST treat per-run slice concurrency and per-provider queue concurrency as separate controls: wallet-local fan-out is bounded by FR-010, while provider budget protection is enforced independently by FR-048 so one wallet's slice plan cannot substitute for global provider throttling.

#### 6) Providers And Persistence

- **FR-028**: The engine MUST honor the provider split: Moralis owns wallet history, balances, ERC-20/NFT transfers, and decoded summaries as hints only; Alchemy owns current and historical prices (address-based preferred, symbol fallback marked lower confidence in `PricePoint.source`); Alchemy RPC owns `eth_getLogs`, `eth_getTransactionReceipt`, `eth_call`; `alchemy_getAssetTransfers` is the wallet-history fallback (research.md §R8).
- **FR-029**: Every external provider response MUST be persisted as `RawProviderRecord` keyed by `(provider, endpoint, request hash, fetchedAt)` before normalization, per the provider research.
- **FR-030**: `PricePoint` resolution MUST be `"daily"` for v1. Sub-daily granularity MUST NOT be stored.
- **FR-031**: The engine MUST record coverage reasons per slice using the controlled vocabulary `missingPrices | partialDecoded | providerError | providerThrottled | reorgSuspect | decodeError | pricingPartial | unknownError` and MUST surface aggregated reasons through the status API (research.md §R8, §R9).
- **FR-032**: All entity writes MUST be idempotent upserts keyed by chain-aware identity per the product spec §2.3 of the feasibility doc. No address-only or hash-only unique constraints anywhere in the engine schema.

#### 7) Failure, Retries, Idempotency

- **FR-033**: Per-task retry MUST be 5 attempts with exponential backoff and jitter on `429`, `5xx`, and network errors (research.md §R8).
- **FR-034**: A slice that exhausts its retry budget MUST NOT poison sibling slices and MUST NOT block Phase D/E/F. The run MUST complete with `status = complete` and `coverage = partial`, carrying `coverageReasons[]` (research.md §R9).
- **FR-035**: A fatal orchestrator error (not slice-local) MUST end the run with `status = failed` and MUST NOT advance `ProcessingCursor`.
- **FR-036**: `POST /api/analysis/cancel { runId }` MUST mark the run `cancelled`. In-flight slices MUST finish their current step and short-circuit. `ProcessingCursor` MUST NOT advance on cancellation.
- **FR-037**: Trigger.dev `idempotencyKey` MUST be set at every level using the scheme in research.md §R10 (`run:{chainId}:{walletAddress}:{YYYY-MM-DD}`, `slice:{chainId}:{walletAddress}:{sliceStart}:{sliceEnd}`, `deposits:{chainId}:{walletAddress}:{positionManagerOrWrapper}:{identity}:{sliceStart}`, `rewards:{chainId}:{depositOrStrategyId}:{sliceStart}`, `activity:{runId}`, `pools:{runId}`, `finalize:{runId}`).

#### 8) API Contract

- **FR-038**: `POST /api/analysis/start` MUST accept `{ walletAddress, chainId, mode? }` and MUST return either the existing same-UTC-day completed run summary or `{ runId, status }` for a newly enqueued run.
- **FR-039**: `GET /api/analysis/status?walletAddress=&chainId=` MUST return the canonical analysis status from [specs/007-settings-screen](../007-settings-screen/spec.md) R1 (`not_analyzed | queued | running | ready | stale | failed`), plus per-phase progress (A/B/D/E/F), per-slice progress, `coverageReasons[]`, `lastSuccessfulRunAt`, and the current/most-recent `runId`.
- **FR-040**: `POST /api/analysis/cancel { runId }` MUST mark the run `cancelled` and MUST be idempotent against an already-`cancelled` or already-`complete`/`failed` run (returning a stable error envelope rather than mutating it).
- **FR-041**: All TanStack Query keys for analysis state MUST include `chainId`.
- **FR-042**: API responses MUST sanitize provider errors into safe machine codes plus structured fields and MUST NOT return raw third-party response bodies to the browser.
- **FR-043**: API responses MUST return machine codes only for status, coverage reasons, and error reasons. User-facing strings MUST be resolved on the client through i18next namespaces.

#### 9) Job Runtime (Trigger.dev v3)

- **FR-044**: The engine MUST use Trigger.dev v3 as the durable job runtime (research.md §R1). Inngest is the documented runner-up and MUST NOT be wired in v1.
- **FR-045**: The task topology MUST be `analysis.run → analysis.slice → phase.deposits, phase.rewards; then phase.activity, phase.pools, phase.finalize` (singletons per run). Parent/child fan-out MUST use `triggerAndWait` / `batchTriggerAndWait`.
- **FR-046**: `maxDuration` MUST be set explicitly per task type (run orchestrator, slice, each phase task, finalization). Defaults MUST NOT be relied upon.
- **FR-047**: Trigger.dev metadata (`metadata.set`) MAY be used for live UI hints only. Postgres (Drizzle) MUST remain the sole source of truth for `AnalysisRun`, `AnalysisSlice`, `ProcessingCursor`, `ProcessedTx`, and all domain rows. Loss of Trigger.dev metadata MUST NEVER affect persisted run state (research.md §R12).
- **FR-048**: Per-provider queues (`moralis`, `alchemy-rpc`, `alchemy-prices`) MUST each have a `concurrencyKey` and `concurrencyLimit` driven by environment variables.

#### 10) Phase-Level Writes

- **FR-049**: Phase A MUST upsert `RawProviderRecord`, `Deposit`, `Strategy`, `StrategyExposure`, lifecycle `LedgerEvent` rows, and `AssetMovement` rows using chain-aware identity (research.md §R7).
- **FR-050**: Phase B MUST upsert `RewardEvent` rows and per-day reward snapshot rows keyed by `(chainId, depositOrStrategyId, day)`. Unclaimed accruals at slice boundaries MUST be snapshotted so the daily rewards line is renderable (research.md §R7).
- **FR-051**: Phase D MUST upsert enriched `LedgerEvent` classifications, `AttributionState`, and `AttributionSourceLot` rows per the residual attribution model in the protocol research.
- **FR-052**: Phase E MUST upsert `Pool` rows, daily `PoolMetricsSnapshot` rows, and `ProtocolContract` rows for newly discovered factories or gauges.
- **FR-053**: Phase F MUST upsert daily `PerformanceSnapshot` rows for portfolio value, per-pool value, per-deposit value, per-strategy value, and rewards.

#### 11) Localization, Brand, And Explainability

- **FR-054**: The engine MUST NOT emit user-facing copy. All status, coverage, and error labels surfaced to the UI MUST be machine codes resolvable through the `analysis`, `coverage`, and `errors` i18next namespaces.
- **FR-055**: English and Spanish translation resources for the engine's machine codes MUST be added in parity. Adding a new machine code without parity translations MUST fail the i18n parity quality gate.
- **FR-056**: Any sample labels in this spec or in downstream UI MUST preserve The Cab control-tower brand tone (precise, technical, non-hypey) and MUST NOT use casino, meme, or retail-trading product language.
- **FR-057**: Coverage and partial-completion behavior MUST be reported truthfully via `coverageReasons[]`. The engine MUST NOT report `100% coverage` when any slice failed or any price was missing.
- **FR-058**: Locale-aware formatting for any engine-derived timestamps, counts, or numeric values shown in the UI MUST be applied on the client. The engine MUST return raw values (UTC ISO timestamps, integer counts, decimal strings) and MUST NOT pre-format them.

#### 12) Security And Provider Boundaries

- **FR-059**: Provider secrets (Moralis key, Alchemy key, Trigger.dev secret) MUST live only in server-side environment variables. `NEXT_PUBLIC` MUST NOT be used for any provider secret.
- **FR-060**: All third-party provider calls MUST execute only inside server-side modules (Trigger.dev tasks or server route handlers). Browser code MUST consume only internal application routes.
- **FR-061**: `RawProviderRecord` rows MUST NOT be exposed to the browser as-is. The engine MUST normalize them before any internal API returns them.

#### 13) Out Of Scope For v1

- **FR-062**: Multi-chain runs are out of scope. The schema and APIs are chain-aware, but only `chainId = 8453` is wired.
- **FR-063**: Sub-daily price granularity and intraday snapshots are out of scope.
- **FR-064**: Continuous background sweep without a user-triggered start is out of scope; the once-per-UTC-day cap is the contract.
- **FR-065**: Deep reorg recovery beyond the 32-block soft window is out of scope.
- **FR-066**: Push notifications when a run completes are out of scope; the UI polls `GET /api/analysis/status`.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: The engine surfaces only machine codes; downstream UI labels MUST preserve The Cab control-tower brand tone and MUST avoid hype, casino, meme, and retail-trading product language.
- **CA-002 Localization**: The engine MUST NOT emit user-facing copy. Machine codes MUST be resolvable through the `analysis`, `coverage`, and `errors` i18next namespaces with full English/Spanish parity.
- **CA-003 Localization Formatting**: The engine MUST return raw timestamps (UTC ISO), integer counts, and decimal strings. Locale-aware formatting MUST be applied on the client.
- **CA-004 Chain Awareness**: Every persisted record, job payload, idempotency key, query key, API request, and provider call MUST carry `chainId`. No address-only or hash-only identity anywhere in the engine schema.
- **CA-005 Provider Boundaries**: Moralis (wallet history, transfers, decoded hints), Alchemy Prices (daily prices), Alchemy RPC (`getLogs`/`getTransactionReceipt`/`eth_call`), and `alchemy_getAssetTransfers` (wallet-history fallback) MUST be used per research.md §R8. All provider responses MUST be persisted as `RawProviderRecord` before normalization. Browser MUST NOT call any provider directly.
- **CA-006 Explainability**: The engine MUST report coverage truthfully via `coverageReasons[]`, MUST NOT fabricate completeness, and MUST advance `ProcessingCursor` only to the latest fully-`complete` UTC day so the cache invariant is meaningful.

### Key Entities *(include if feature involves data)*

- **AnalysisRun**: A single reconstruction execution keyed by `(walletAddress, chainId)`, carrying `runId`, `mode`, `triggeredAtUtc`, `utcDayBucket`, `status`, `coverage`, `coverageReasons[]`, `completedAtUtc`. Unique on `(walletAddress, chainId, utcDayBucket) where status = 'complete'`.
- **AnalysisSlice**: A 90-day partition of a run keyed by `(walletAddress, chainId, sliceStart, sliceEnd)`, carrying status, retry counters, coverage reasons, and provider-attempt counts.
- **ProcessingCursor**: One row per `(walletAddress, chainId)` storing `lastProcessedDayUtc` and `lastProcessedBlockNumber`. Advances only on fully-`complete` UTC days.
- **ProcessedTx**: Append-only index keyed by `(chainId, txHash)` recording the first run/slice that processed each transaction, its `blockNumber`, and a `processedAtUtc` timestamp.
- **RawProviderRecord**: Append-only record of every external provider response, keyed by `(provider, endpoint, request hash, fetchedAt)`. Source of auditability and re-classification without re-fetching.
- **PricePoint**: Daily-resolution price keyed by `(chainId, tokenAddress, day, source, resolution)` with `resolution = "daily"` for v1.
- **Deposit / Strategy / StrategyExposure**: Aerodrome and Mellow position lifecycle entities keyed by chain-aware identity per the product spec §2.3.
- **LedgerEvent**: Classified on-chain event keyed by `(chainId, txHash, logIndex)`. Phase A writes lifecycle events; Phase D enriches with activity classification.
- **RewardEvent**: Reward emission, claim, or accrual entity keyed by chain-aware identity, with a per-day snapshot table keyed by `(chainId, depositOrStrategyId, day)`.
- **AttributionState / AttributionSourceLot**: Residual attribution model entities written by Phase D per the protocol research.
- **Pool / PoolMetricsSnapshot**: Aerodrome pool metadata and daily pool-level metrics keyed by `(chainId, poolAddress)` and `(chainId, poolAddress, day)`.
- **PerformanceSnapshot**: Daily portfolio, per-pool, per-deposit, per-strategy, and rewards value rows written by Phase F.
- **ProtocolContract**: Discovered protocol infrastructure (factory, gauge, router, position manager) keyed by `(chainId, address)` with provenance.
- **AssetMovement**: Token transfer normalization keyed by `(chainId, txHash, logIndex)` linked to deposit/strategy lifecycle when applicable.
- **Analysis Status Response**: Read-only view returned by `GET /api/analysis/status`, exposing the canonical status enum, per-phase progress, per-slice progress, `coverageReasons[]`, `lastSuccessfulRunAt`, and `runId`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time run for a new wallet processes up to 365 days in 90-day slices walking backward from `triggeredAtUtc` and finalizes `AnalysisRun.status = complete` with daily-resolution series populated for every covered UTC day, in 100% of validation wallets.
- **SC-002**: A second run for the same wallet one week after the first fetches only the new days; every slice fully behind `lastProcessedDayUtc` returns `skipped_cached` with zero provider calls, in 100% of validation wallets.
- **SC-003**: At most one `complete` `AnalysisRun` per `(walletAddress, chainId, utcDayBucket)` exists; repeated `POST /api/analysis/start` triggers within the same UTC day return the same `runId` in 100% of cases.
- **SC-004**: Daily `PerformanceSnapshot` rows for portfolio value, per-pool value, per-deposit value, per-strategy value, and rewards are present for every UTC day in the covered window after Phase F completes, with zero gaps inside the window, in 100% of validation wallets.
- **SC-005**: Every persisted entity, idempotency key, job payload, API request, and TanStack Query key includes `chainId`. Zero address-only or hash-only unique constraints exist in the engine schema.
- **SC-006**: A single slice failure does not block the run in 100% of validation cases; the run finalizes with `status = complete`, `coverage = partial`, and `coverageReasons[]` drawn from the controlled vocabulary, surfaced via `GET /api/analysis/status`.
- **SC-007**: `GET /api/analysis/status` returns exactly one of `not_analyzed | queued | running | ready | stale | failed` (canonical per spec 007-settings-screen R1) in 100% of polls; no engine-internal status leaks to the API.
- **SC-008**: The engine emits zero user-facing English strings; all status, coverage, and error labels are machine codes with full English/Spanish parity in the `analysis`, `coverage`, and `errors` i18next namespaces.
- **SC-009**: Browser code makes zero direct calls to Moralis, Alchemy, or Trigger.dev; 100% of provider traffic originates from server-side Trigger.dev tasks or server routes.
- **SC-010**: Per-provider Trigger.dev queues keep RPS under configured plan limits in 100% of load-test runs; provider `429`/`5xx` responses recover via the 5-attempt exponential-backoff-with-jitter retry policy and degrade to `coverageReasons[]` only after retries are exhausted.
- **SC-011**: `ProcessingCursor.lastProcessedDayUtc` advances only to the latest fully-`complete` UTC day in 100% of completed runs (including degraded `coverage = partial` runs); failed-slice days remain eligible for retry on the next incremental run.
- **SC-012**: `POST /api/analysis/cancel` transitions the run to `cancelled`, halts new slice enqueues, and leaves `ProcessingCursor` unchanged in 100% of cancellation validation cases.
- **SC-013**: The engine passes lint, typecheck, build, and i18n parity quality gates before completion.

## Assumptions

- The downstream surfaces (Overview, Pools, Deposits, Strategies, Rewards, Activity) already define their read-model contracts in specs 003/004/005 and consume the engine's normalized domain tables; this spec does not redesign those contracts.
- The canonical analysis status vocabulary (`not_analyzed | queued | running | ready | stale | failed`) is owned by [specs/007-settings-screen](../007-settings-screen/spec.md) R1 and is mapped from the engine's internal `AnalysisRun.status` (`queued | running | complete | failed | cancelled`) at the API boundary. Internal `cancelled` never leaks through the public status API.
- Trigger.dev v3 is the agreed durable runtime per research.md §R1; cost and self-hosting trade-offs are tracked in the plan phase, not in this spec.
- Postgres (Drizzle) is the source of truth for all engine state; Trigger.dev metadata is observability only (research.md §R12).
- Moralis and Alchemy plan limits and concurrency ceilings are tunable via environment variables; this spec assumes per-provider concurrency keys are sufficient to stay within budget.
- Base mainnet reorg depth is empirically ≤ 2 blocks; the 32-block soft window is a comfortable safety margin (research.md §R5).
- Phase D higher-order activity labels are determined by deterministic source-lot and residual-flow attribution, not by configurable time windows (research.md §R6).
- Aerodrome factory and gauge addresses are discovered dynamically (`router.defaultFactory()` per protocol research §4.3) and cached in `ProtocolContract`; the engine does not ship with hardcoded protocol addresses beyond the router entry point.
- Mellow exposure is tracked by `(chainId, wrapperAddress)` and not modeled as an NFT deposit; the exact event set per Mellow wrapper is verified during implementation (research.md §R14.1).
- v1 stores `PricePoint` only at daily resolution; sub-daily granularity is a deliberate non-goal (research.md §R4, §R13).
- The UI polls `GET /api/analysis/status` every 5 seconds while a run is `running` (research.md §R12); push notifications are out of scope.
- Provider-side outages outside the engine's retry budget surface as `coverageReasons[]` rather than blocking the run; this is the explicit product contract (research.md §R9).
- The plan phase will measure a worst-case full-history run (5 slices × A+B + D + E + F + retries) against the chosen Trigger.dev plan and document the self-hosting fallback path (research.md §R14.4).
