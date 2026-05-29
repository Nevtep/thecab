# Moralis Pagination Hard Limit Findings

## Current Behavior

**Slice Planning** ([orchestrator.ts](orchestrator.ts#L36-L71)):
- 365-day window divided into 90-day slices (default ANALYSIS_SLICE_DAYS = 90)
- Produces 5 slices per wallet per analysis run
- Slices are independent, processed concurrently (max 2 concurrent)

**Transaction Pagination** ([phase-deposits.task.ts](phase-deposits.task.ts#L87-L105)):
- `loadSliceHistory()` paginates Moralis `/wallets/:walletAddress/history`
- Max pages per slice: **MORALIS_HISTORY_MAX_PAGES_PER_SLICE = 20**
- Records per page: **MORALIS_HISTORY_PAGE_LIMIT = 100**
- **Hard limit: 2,000 transactions per slice**

**Loop termination** ([phase-deposits.task.ts](phase-deposits.task.ts#L100)):
- Breaks if `pageRecords.length < MORALIS_HISTORY_PAGE_LIMIT` (last page)
- Breaks if `response.cursor` is empty/null (no more pages)
- **Breaks silently at 20 pages regardless of whether more data exists**
- Returns truncated record set without warning or error

**Impact on Guarantee**:
- If a 90-day slice has > 2,000 transactions, excess transactions are **silently lost**
- No coverage reason logged, no txCount mismatch detection
- Analysis run completes as "ready" with incomplete data
- User sees full Pools UI but some transactions are missing

## Spec Requirement

[009-pools-history/spec.md](009-pools-history/spec.md) **FR-003**:
> "Pools MUST support the full analyzed history window up to 365 days and MUST show the actual covered range when less than one year is available."

This does NOT explicitly guarantee all transactions will be processed, but the Pools feature depends on the analysis engine. If transactions are lost in phase-deposits, Pools history is incomplete.

## Failure Mode

Wallet with > 2,000 transactions in any 90-day window:
1. phase-deposits.loadSliceHistory() stops at 20 pages
2. Returns only first 2,000 transactions from that slice
3. persistSliceHistory() processes them normally
4. Analysis completes as "ready"
5. User views incomplete Pools history without knowing
6. Missing transactions = missing deposits/rewards/rebalances in detail view

## Files Affected
- [apps/web/src/server/trigger/tasks/phase-deposits.task.ts](phase-deposits.task.ts) — loadSliceHistory() function (line 87-105)
- [apps/web/src/server/analysis/enginePersistence.ts](enginePersistence.ts) — persistSliceHistory() (line 755+) receives truncated records
- [apps/web/src/server/analysis/orchestrator.ts](orchestrator.ts) — planAnalysisSlices() determines slice windows
- No tests validate transaction count completeness per slice
