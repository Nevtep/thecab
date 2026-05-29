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