import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";
import { materializeAllDataViewRows } from "@/server/analysis/engine-v2/materializers";

export function runReadModelRegression() {
  const walletAddress = "0x0000000000000000000000000000000000000001";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "deposit-event",
        chainId: 8453,
        walletAddress,
        eventType: "manual_deposit_open",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xdep",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          positionManagerAddress: "0x00000000000000000000000000000000000000aa",
          tokenId: "1",
          valueUsd: "100",
        },
      },
      {
        id: "strategy-event",
        chainId: 8453,
        walletAddress,
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xstrat",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { strategyExposureId: "strategy-1", valueUsd: "50", sharesRaw: "1" },
      },
      {
        id: "reward-event",
        chainId: 8453,
        walletAddress,
        eventType: "governance_claimFees",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        txHash: "0xreward",
        sequenceIndex: 2,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missing_distributor_pool_link"],
        metadataJson: { rewardId: "reward-1", rewardType: "governance_fee", lockTokenId: "110971", amountUsd: "7" },
      },
    ],
    links: [
      { domainEventId: "deposit-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "strategy-event", entityType: "strategy_exposure", entityId: "strategy-1" },
      { domainEventId: "strategy-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "reward-event", entityType: "governance_lock", entityId: "lock-1" },
    ],
  });
  const rows = materializeAllDataViewRows(accounting);
  const surfaces = new Set(rows.map((row) => row.surface));
  for (const surface of ["activity", "deposits", "strategies", "pools", "rewards", "governance"]) {
    if (!surfaces.has(surface)) {
      throw new Error(`ENGINE_V2_READ_MODEL_REGRESSION_MISSING_${surface.toUpperCase()}`);
    }
  }
  if (accounting.pools.some((pool) => Number(pool.rewardValueUsd) > 0)) {
    throw new Error("ENGINE_V2_READ_MODEL_REGRESSION_INFERRED_POOL_REWARD");
  }
  return {
    rowCount: rows.length,
    surfaces: [...surfaces].sort(),
    unresolvedRewardCount: accounting.rewards.filter((reward) => reward.poolContribution === "unresolved").length,
  };
}
