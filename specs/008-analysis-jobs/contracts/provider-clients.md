# Contract: Provider Clients (008-analysis-jobs)

**Feature**: `008-analysis-jobs`  
**Date**: 2026-05-24  
**Scope**: Boundaries, retry policy, rate budgeting, and audit logging for every external API the engine touches. Citations: `research.md §R8` (provider responsibilities + retry policy), `§R14.2` (gauge discovery), `spec.md` FR-026..FR-033 + FR-059..FR-061, `/memories/repo/provider-cache-coordination.md`.

## Provider Responsibilities (FIXED — research.md §R8)

| Provider | Allowed Calls | Forbidden |
|---|---|---|
| **Moralis** | Wallet discovery only: ERC-20 transfers index, NFT history index, transaction list paging. Used to *find candidate transactions* in the slice window. | Pricing. Decoding. Position math. Mellow-specific contract reads. |
| **Alchemy Prices** | Daily token prices: address-batched preferred; symbol-based fallback marked `source = 'alchemy_symbol'` and tagged lower confidence. | Intraday / per-block pricing in v1 (research.md §R4). |
| **Alchemy RPC** | `eth_getLogs`, `eth_getTransactionReceipt`, `eth_call` (read-only contract calls for slot decoding, gauge → pool discovery, Mellow `previewMint`, ERC-721 ownership/metadata). | Indexing / aggregation queries reserved for Moralis. Pricing. |
| **`alchemy_getAssetTransfers`** | Wallet-history fallback when Moralis indexing is incomplete for a given chain/window (FR-027). | Never the primary path; only invoked when Moralis returns coverage gaps. |

**Browser exposure rule** (FR-060, FR-061, SC-009): The browser MUST NEVER call any of these providers directly. Every call originates server-side inside a Trigger.dev task or a route handler.

## Layout

```text
apps/web/src/server/providers/
├── moralis/
│   ├── moralis.client.ts            # base HTTP wrapper, headers, key rotation if configured
│   ├── moralis.discovery.ts         # transfers/history paging
│   └── moralis.types.ts
├── alchemy/
│   ├── alchemy-prices.client.ts     # historical-token-prices (address + symbol)
│   ├── alchemy-rpc.client.ts        # JSON-RPC: getLogs, getTransactionReceipt, eth_call
│   ├── alchemy-transfers.client.ts  # alchemy_getAssetTransfers (fallback)
│   └── alchemy.types.ts
├── provider-cache.repository.ts     # EXISTING — Redis-backed cache layer (unchanged).
└── raw-provider-records.repository.ts  # NEW — persists every response before normalization.
```

## Universal Call Lifecycle (REQUIRED for EVERY provider call)

1. **Compute request hash**: `requestHash = sha256(provider || endpoint || canonicalJson(payload))`.
2. **Cache check** (provider-cache.repository): return cached body if TTL fresh.
3. **Network call**: subject to retry policy and queue.
4. **Persist raw**: write to `raw_provider_records` with `(provider, endpoint, requestHash, fetchedAt, sliceId?, runId?, statusCode, responseBytes)`. THIS WRITE PRECEDES NORMALIZATION (FR-029).
5. **Normalize**: produce domain types; never expose raw bytes to callers above this layer.
6. **Cache write**: store normalized body in Redis with TTL appropriate to the endpoint.

If step 4 fails, the call as a whole fails (we never normalize a record we cannot persist).

## Retry Policy (research.md §R8)

- **Attempts**: 5 (initial + 4 retries).
- **Backoff**: exponential, base 500ms, factor 2, jitter ±20%. Cap individual delay at 30s.
- **Retriable**: HTTP `429`, `500`, `502`, `503`, `504`, transport errors (ECONNRESET/ETIMEDOUT/aborted), and JSON-RPC body errors whose `code` is in a configured retriable set.
- **Non-retriable**: 4xx other than 429, validation/auth errors.
- **On exhaustion**: throw a typed `ProviderError { provider, endpoint, code: "providerThrottled" | "providerError" | ... }`. The owning slice surfaces this in `coverage_reasons[]` (FR-031). The Trigger.dev task retry budget (5 attempts) is the OUTER layer; the client-level retry is the INNER layer that handles transient bursts within a single attempt.

## Per-Queue Rate Budget (research.md §R8)

- All Moralis traffic flows through Trigger.dev queue `moralis` with `concurrencyKey = chainId` and `concurrencyLimit = TRIGGER_QUEUE_MORALIS_CONCURRENCY`.
- All Alchemy Prices traffic flows through queue `alchemy-prices`.
- All Alchemy RPC + asset-transfers traffic flows through queue `alchemy-rpc`.
- The client itself does NOT implement an RPS limiter; queue concurrency × per-call latency is the bound. Defaults in `contracts/trigger-tasks.md §Queues`.

## Endpoint Boundaries (Detailed)

### Moralis

- `GET /api/v2.2/{address}/erc20/transfers` — paged ERC-20 transfers.
- `GET /api/v2.2/{address}/nft/transfers` — paged ERC-721 transfers (Aerodrome NFT position discovery, Mellow wrapper discovery).
- `GET /api/v2.2/wallets/{address}/history` — wallet activity index for window coverage checks.

**Out of scope**: Moralis pricing endpoints — never called.

### Alchemy Prices

- `POST /prices/v1/{apiKey}/tokens/historical` (address-based, preferred).
- `POST /prices/v1/{apiKey}/tokens/historical-by-symbol` (symbol fallback). Resulting `price_points.source = 'alchemy_symbol'`; downstream consumers MAY downgrade confidence (research.md §R8).

### Alchemy RPC

JSON-RPC over HTTPS:

- `eth_getLogs` — event extraction inside `(fromBlock, toBlock)` slice windows.
- `eth_getTransactionReceipt` — receipt-level enrichment.
- `eth_call` — read-only contract calls (Mellow `previewMint`, gauge→pool lookup, ERC-721 ownership).
- `eth_blockNumber` — head check for 32-block reorg window.

### `alchemy_getAssetTransfers`

- Method `alchemy_getAssetTransfers` over JSON-RPC.
- Used ONLY when Moralis coverage is suspect (FR-027). Emits coverage reason `providerError` or `partialDecoded` if it itself returns incomplete pages.

## Coverage Reason Vocabulary (FR-031)

Provider clients emit these strings into `analysis_slices.coverage_reasons_json`:

- `providerError` — non-retriable failure.
- `providerThrottled` — 429 budget exhausted after retries.
- `missingPrices` — Alchemy Prices returned no value for a token at a required day.
- `pricingPartial` — some prices resolved, some did not.
- `decodeError` — ABI decode failed for a discovered tx/log.
- `partialDecoded` — some events decoded, some did not.
- `reorgSuspect` — head − blockNumber < 32 at processing time (research.md §R5).
- `unknownError` — fallback bucket; logs include classification details.

Engine code MUST select from this fixed set; ad-hoc strings are a contract violation.

## Symbol-Fallback Confidence Rule

When `alchemy-prices.client.ts` falls back to symbol pricing:

1. Write `price_points.source = 'alchemy_symbol'` (data-model §2.6).
2. Emit `pricingPartial` for the slice if at least one token in the slice required this fallback.
3. Downstream P&L consumers MUST NOT inflate confidence; the UI surfaces the lower-confidence badge via the `analysis.coverage.priceSymbolFallback` i18n key.

## Auditing & Observability

- Every call writes structured logs `{ provider, endpoint, runId, sliceId, durationMs, statusCode, attempt, retriedBecause }`.
- Per-run aggregates `provider_attempts_json` accumulate into `analysis_slices` (data-model §1.1).
- Trigger.dev task metadata exposes `metadata.providerCalls = { moralis: n, alchemyRpc: n, alchemyPrices: n }` as a UI hint only (research.md §R12).

## Audit Checklist

- [ ] No engine module bypasses these clients to call providers directly.
- [ ] No browser bundle imports anything from `apps/web/src/server/providers/**`.
- [ ] Every client writes `raw_provider_records` before normalization.
- [ ] No hardcoded factory or gauge address exists anywhere outside seed data; all are discovered via RPC and persisted in `protocol_contracts` (research.md §R7, §R14.2).
- [ ] Retry policy values come from one shared `providerRetry.config.ts` module, not duplicated per client.
