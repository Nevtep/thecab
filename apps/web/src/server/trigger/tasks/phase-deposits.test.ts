import assert from "node:assert/strict";
import test from "node:test";

function ensureTestEnv() {
  process.env.MORALIS_API_KEY ??= "test-moralis-key";
  process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
  process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
  process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
  process.env.ANALYSIS_HISTORY_DAYS ??= "365";
  process.env.ANALYSIS_SLICE_DAYS ??= "90";
  process.env.ANALYSIS_MIN_HISTORY_WINDOW_HOURS ??= "1";
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

test("collectSliceHistoryPages marks paginationTruncated when the last allowed page still has a cursor", async () => {
  const { collectSliceHistoryPages } = await import("@/server/trigger/tasks/phase-deposits.task");

  let calls = 0;
  const result = await collectSliceHistoryPages({
    walletAddress: "0xabc",
    chainId: 8453,
    sliceStartUtc: new Date("2026-01-01T00:00:00.000Z"),
    sliceEndUtc: new Date("2026-03-31T00:00:00.000Z"),
    fetchPage: async ({ cursor }) => {
      calls += 1;
      return {
        result: Array.from({ length: 100 }, (_, index) => ({ hash: `${cursor ?? "page-0"}-${index}` })),
        cursor: `cursor-${calls}`,
      };
    },
  });

  assert.equal(calls, 20);
  assert.equal(result.paginationTruncated, true);
  assert.equal(result.records.length, 2000);
});

test("collectSliceHistoryPages stops cleanly without paginationTruncated when Moralis exhausts the cursor", async () => {
  const { collectSliceHistoryPages } = await import("@/server/trigger/tasks/phase-deposits.task");

  let calls = 0;
  const result = await collectSliceHistoryPages({
    walletAddress: "0xabc",
    chainId: 8453,
    sliceStartUtc: new Date("2026-01-01T00:00:00.000Z"),
    sliceEndUtc: new Date("2026-03-31T00:00:00.000Z"),
    fetchPage: async () => {
      calls += 1;

      if (calls === 1) {
        return {
          result: Array.from({ length: 100 }, (_, index) => ({ hash: `page-1-${index}` })),
          cursor: "cursor-2",
        };
      }

      return {
        result: Array.from({ length: 37 }, (_, index) => ({ hash: `page-2-${index}` })),
        cursor: null,
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.paginationTruncated, false);
  assert.equal(result.records.length, 137);
});

test("loadSliceHistoryWithAdaptiveSplitting recursively narrows overflowing windows until pagination is exhausted", async () => {
  const { loadSliceHistoryWithAdaptiveSplitting } = await import("@/server/trigger/tasks/phase-deposits.task");

  const requestedWindows: Array<{ fromDate: string; toDate: string }> = [];
  const result = await loadSliceHistoryWithAdaptiveSplitting({
    walletAddress: "0xabc",
    chainId: 8453,
    sliceStartUtc: new Date("2026-01-01T00:00:00.000Z"),
    sliceEndUtc: new Date("2026-01-03T00:00:00.000Z"),
    minimumWindowMs: 60 * 60 * 1000,
    fetchPage: async ({ fromDate, toDate }) => {
      requestedWindows.push({ fromDate, toDate });
      const durationMs = new Date(toDate).getTime() - new Date(fromDate).getTime();

      if (durationMs > 12 * 60 * 60 * 1000) {
        return {
          result: Array.from({ length: 100 }, (_, index) => ({ hash: `${fromDate}-${toDate}-${index}` })),
          cursor: `cursor-${requestedWindows.length}`,
        };
      }

      return {
        result: [{ hash: `${fromDate}-${toDate}-resolved` }],
        cursor: null,
      };
    },
  });

  assert.equal(result.paginationTruncated, false);
  assert.equal(result.records.length > 2, true);
  assert.equal(requestedWindows.length > 2, true);
});

test("loadSliceHistoryWithAdaptiveSplitting still reports paginationTruncated when the minimum window remains too dense", async () => {
  const { loadSliceHistoryWithAdaptiveSplitting } = await import("@/server/trigger/tasks/phase-deposits.task");

  const result = await loadSliceHistoryWithAdaptiveSplitting({
    walletAddress: "0xabc",
    chainId: 8453,
    sliceStartUtc: new Date("2026-01-01T00:00:00.000Z"),
    sliceEndUtc: new Date("2026-01-01T02:00:00.000Z"),
    minimumWindowMs: 60 * 60 * 1000,
    fetchPage: async () => ({
      result: Array.from({ length: 100 }, (_, index) => ({ hash: `dense-${index}` })),
      cursor: "still-dense",
    }),
  });

  assert.equal(result.paginationTruncated, true);
});

test("normalizeAerodromeLifecycleForPersistence fills collect token ids from resolved reward candidates", async () => {
  const { normalizeAerodromeLifecycleForPersistence } = await import("@/server/trigger/tasks/phase-deposits.task");

  const normalized = normalizeAerodromeLifecycleForPersistence({
    lifecycle: [
      {
        txHash: "0xcollect",
        occurredAt: new Date("2026-05-07T15:14:11.000Z"),
        tokenId: null,
        action: "collect",
        positionManagerAddress: null,
        poolAddress: "0xpool",
        category: "claim",
        methodLabel: "getReward",
        summary: "Claimed rewards",
      },
      {
        txHash: "0xmint",
        occurredAt: new Date("2026-05-02T05:08:23.000Z"),
        tokenId: "69133516",
        action: "mint",
        positionManagerAddress: null,
        poolAddress: "0xpool",
        category: "mint",
        methodLabel: "mint",
        summary: "Minted 1 NFT",
      },
    ],
    rewardCandidatesByHash: new Map([
      ["0xcollect", { targetTokenId: "69133516" }],
    ]),
  });

  assert.equal(normalized[0]?.tokenId, "69133516");
  assert.equal(normalized[1]?.tokenId, "69133516");
});