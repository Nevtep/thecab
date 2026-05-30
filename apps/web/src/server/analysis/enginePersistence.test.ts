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
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

test("isSuspiciousSpoofedTransferActivity flags spoofed spam outflows that were not sent by the wallet", async () => {
  const { isSuspiciousSpoofedTransferActivity } = await import("@/server/analysis/enginePersistence");

  assert.equal(isSuspiciousSpoofedTransferActivity({
    walletAddress: "0xwallet",
    category: "token send",
    methodLabel: "transfer",
    fromAddress: "0xspoofed",
    toAddress: "0xphishing",
    meaningfulOutflowCount: 1,
    suspiciousOutflowCount: 1,
    trustedOutflowCount: 0,
  }), true);
});

test("isSuspiciousSpoofedTransferActivity keeps legitimate wallet cash outs visible", async () => {
  const { isSuspiciousSpoofedTransferActivity } = await import("@/server/analysis/enginePersistence");

  assert.equal(isSuspiciousSpoofedTransferActivity({
    walletAddress: "0xwallet",
    category: "token send",
    methodLabel: "transfer",
    fromAddress: "0xwallet",
    toAddress: "0xrecipient",
    meaningfulOutflowCount: 1,
    suspiciousOutflowCount: 0,
    trustedOutflowCount: 1,
  }), false);
});

test("serializeManualDepositLifecycle keeps normalized records for one deposit token", async () => {
  const { serializeManualDepositLifecycle } = await import("@/server/analysis/enginePersistence");

  const serialized = serializeManualDepositLifecycle({
    tokenId: "69133516",
    lifecycle: [
      {
        txHash: "0xMint",
        tokenId: "69133516",
        action: "mint",
        occurredAt: new Date("2026-05-02T05:08:23.000Z"),
        positionManagerAddress: "0x827922686190790B37229Fd06084350E74485B72",
        poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
        category: "mint",
        methodLabel: "mint",
        summary: "Minted 1 NFT",
      },
      {
        txHash: "0xCollect",
        tokenId: "69133516",
        action: "collect",
        occurredAt: new Date("2026-05-07T15:14:11.000Z"),
        positionManagerAddress: null,
        poolAddress: null,
        category: "claim",
        methodLabel: "getReward",
        summary: "Claimed rewards",
      },
      {
        txHash: "0xOther",
        tokenId: "other-token",
        action: "mint",
        occurredAt: new Date("2026-05-01T00:00:00.000Z"),
        positionManagerAddress: null,
        poolAddress: null,
        category: null,
        methodLabel: null,
        summary: null,
      },
    ],
  });

  assert.deepEqual(serialized, [
    {
      txHash: "0xmint",
      action: "mint",
      occurredAt: "2026-05-02T05:08:23.000Z",
      positionManagerAddress: "0x827922686190790b37229fd06084350e74485b72",
      poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
      category: "mint",
      methodLabel: "mint",
      summary: "Minted 1 NFT",
    },
    {
      txHash: "0xcollect",
      action: "collect",
      occurredAt: "2026-05-07T15:14:11.000Z",
      positionManagerAddress: null,
      poolAddress: null,
      category: "claim",
      methodLabel: "getReward",
      summary: "Claimed rewards",
    },
  ]);
});

test("resolvePersistedManualDepositStatus closes burned deposits even if a stale staked row is present", async () => {
  const { resolvePersistedManualDepositStatus } = await import("@/server/analysis/enginePersistence");

  const status = resolvePersistedManualDepositStatus({
    hasManualPosition: false,
    hasStakedPosition: true,
    lifecycle: [
      {
        txHash: "0xMint",
        tokenId: "71272831",
        action: "mint",
        occurredAt: new Date("2026-05-23T21:32:37.000Z"),
        positionManagerAddress: "0x827922686190790B37229Fd06084350E74485B72",
        poolAddress: "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
        category: "mint",
        methodLabel: null,
        summary: "Minted 1 NFT",
      },
      {
        txHash: "0xBurn",
        tokenId: "71272831",
        action: "decreaseLiquidity",
        occurredAt: new Date("2026-05-28T04:58:45.000Z"),
        positionManagerAddress: "0x827922686190790B37229Fd06084350E74485B72",
        poolAddress: "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
        category: "burn",
        methodLabel: "multicall",
        summary: "Burned 1 NFT",
      },
    ],
  });

  assert.equal(status, "closed");
});

test("buildAccrualRewardSnapshotRows keeps synthetic snapshot identity stable across reruns", async () => {
  const { buildAccrualRewardSnapshotRows } = await import("@/server/analysis/enginePersistence");

  const firstRun = buildAccrualRewardSnapshotRows({
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
    chainId: 8453,
    sliceEndUtc: new Date("2026-05-29T00:00:00.000Z"),
    accrualSnapshotDayUtc: "2026-05-28",
    accrualSnapshots: [
      {
        depositOrStrategyId: "deposit-b",
        rewardType: "reward_accrual_snapshot",
        protocol: "aerodrome",
        targetType: "deposit",
        targetTokenId: "2",
      },
      {
        depositOrStrategyId: "deposit-a",
        rewardType: "reward_accrual_snapshot",
        protocol: "aerodrome",
        targetType: "deposit",
        targetTokenId: "1",
      },
    ],
  });

  const secondRun = buildAccrualRewardSnapshotRows({
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
    chainId: 8453,
    sliceEndUtc: new Date("2026-05-29T00:00:00.000Z"),
    accrualSnapshotDayUtc: "2026-05-28",
    accrualSnapshots: [
      {
        depositOrStrategyId: "deposit-a",
        rewardType: "reward_accrual_snapshot",
        protocol: "aerodrome",
        targetType: "deposit",
        targetTokenId: "1",
      },
      {
        depositOrStrategyId: "deposit-b",
        rewardType: "reward_accrual_snapshot",
        protocol: "aerodrome",
        targetType: "deposit",
        targetTokenId: "2",
      },
    ],
  });

  const firstByDeposit = new Map(firstRun.map((row) => [row.depositOrStrategyId, row] as const));
  const secondByDeposit = new Map(secondRun.map((row) => [row.depositOrStrategyId, row] as const));

  assert.equal(firstByDeposit.get("deposit-a")?.logIndex, 0);
  assert.equal(firstByDeposit.get("deposit-b")?.logIndex, 0);
  assert.equal(firstByDeposit.get("deposit-a")?.txHash, secondByDeposit.get("deposit-a")?.txHash);
  assert.equal(firstByDeposit.get("deposit-b")?.txHash, secondByDeposit.get("deposit-b")?.txHash);
});

test("resolvePersistedRewardResolutionStatus treats strategy exposure ownership as resolved", async () => {
  const { resolvePersistedRewardResolutionStatus } = await import("@/server/analysis/enginePersistence");

  assert.equal(resolvePersistedRewardResolutionStatus({
    depositOrStrategyId: "deposit-1",
    strategyExposureId: null,
  }), "resolved");
  assert.equal(resolvePersistedRewardResolutionStatus({
    depositOrStrategyId: null,
    strategyExposureId: "exposure-1",
  }), "resolved");
  assert.equal(resolvePersistedRewardResolutionStatus({
    depositOrStrategyId: null,
    strategyExposureId: null,
  }), "unresolved");
});

test("resolveManualDepositDisplayMetadata prefers canonical pool metadata over numeric fallback symbols", async () => {
  const { resolveManualDepositDisplayMetadata } = await import("@/server/analysis/enginePersistence");

  const result = resolveManualDepositDisplayMetadata({
    chainId: 8453,
    family: "staked_lp",
    canonicalPoolLabel: "WETH / USDC 100",
    token0Address: "0x4200000000000000000000000000000000000006",
    token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    fallbackLabel: "AERO / CL staked LP",
    fallbackPoolLabel: "2026 / 05",
    fallbackPrimaryTokenSymbol: "2026",
    fallbackSecondaryTokenSymbol: "05",
  });

  assert.deepEqual(result, {
    label: "WETH / USDC staked LP",
    poolLabel: "WETH / USDC 100",
    primaryTokenSymbol: "WETH",
    secondaryTokenSymbol: "USDC",
  });
});

test("mergePersistedPositionMetadataJson preserves existing range metadata when the incoming row is degraded", async () => {
  const { mergePersistedPositionMetadataJson } = await import("@/server/analysis/enginePersistence");

  const merged = mergePersistedPositionMetadataJson({
    existing: {
      label: "Existing label",
      metadata: {
        feeTierLabel: "100",
        rangeLowerTick: -200,
        rangeUpperTick: 200,
        currentTick: 0,
        isInRange: true,
        rangeLowerPrice: 1,
        rangeUpperPrice: 2,
        rangeQuoteTokenSymbol: "USDC",
        rangeDisplayFractionDigits: 4,
      },
    },
    next: {
      label: "Fresh label",
      metadata: {
        feeTierLabel: null,
        rangeLowerTick: null,
        rangeUpperTick: null,
        currentTick: null,
        isInRange: null,
        rangeLowerPrice: null,
        rangeUpperPrice: null,
        rangeQuoteTokenSymbol: null,
        rangeDisplayFractionDigits: null,
      },
    },
  }) as Record<string, unknown> & { metadata: Record<string, unknown> };

  assert.equal(merged.label, "Fresh label");
  assert.deepEqual(merged.metadata, {
    feeTierLabel: "100",
    rangeLowerTick: -200,
    rangeUpperTick: 200,
    currentTick: 0,
    isInRange: true,
    rangeLowerPrice: 1,
    rangeUpperPrice: 2,
    rangeQuoteTokenSymbol: "USDC",
    rangeDisplayFractionDigits: 4,
  });
});
