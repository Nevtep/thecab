import type { EngineV2AccountingOutput } from "@/server/analysis/engine-v2/accounting";

import { materializeActivityRows, type EngineV2ReadModelRowInput } from "./activity-materializer";

function row(input: Omit<EngineV2ReadModelRowInput, "walletAddress" | "chainId"> & {
  chainId: number;
  walletAddress: string;
}): EngineV2ReadModelRowInput {
  return {
    ...input,
    walletAddress: input.walletAddress.toLowerCase(),
  };
}

export function materializeDepositRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  return accounting.deposits.map((deposit) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "deposits",
    rowKey: deposit.depositId,
    sourceDomainEventId: deposit.lifecycle[0]?.eventId ?? null,
    coverageStatus: deposit.coverageStatus,
    confidence: deposit.confidence,
    rowJson: { ...deposit },
    evidenceJson: {
      tokenId: deposit.tokenId,
      lifecycleEventIds: deposit.lifecycle.map((item) => item.eventId).filter(Boolean),
      reasonCodes: deposit.reasonCodes,
    },
  }));
}

export function materializeStrategyRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  return accounting.strategies.map((strategy) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "strategies",
    rowKey: strategy.strategyExposureId,
    sourceDomainEventId: strategy.lifecycle[0]?.eventId ?? null,
    coverageStatus: strategy.coverageStatus,
    confidence: strategy.confidence,
    rowJson: { ...strategy },
    evidenceJson: {
      strategyExposureId: strategy.strategyExposureId,
      lifecycleEventIds: strategy.lifecycle.map((item) => item.eventId).filter(Boolean),
      reasonCodes: strategy.reasonCodes,
    },
  }));
}

export function materializePoolRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  return accounting.pools.map((pool) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "pools",
    rowKey: pool.poolId,
    sourceDomainEventId: null,
    coverageStatus: pool.coverageStatus,
    confidence: pool.coverageStatus === "full" ? "high" : "medium",
    rowJson: { ...pool },
    evidenceJson: {
      poolId: pool.poolId,
      reasonCodes: pool.reasonCodes,
      explicitLinksOnly: true,
    },
  }));
}

export function materializeRewardRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  return accounting.rewards.map((reward) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "rewards",
    rowKey: reward.rewardId,
    sourceDomainEventId: null,
    coverageStatus: reward.coverageStatus,
    confidence: reward.confidence,
    rowJson: { ...reward },
    evidenceJson: {
      rewardId: reward.rewardId,
      affectsTotals: reward.affectsTotals,
      poolContribution: reward.poolContribution,
      reasonCodes: reward.reasonCodes,
    },
  }));
}

export function materializeGovernanceRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  const wallet = accounting.events[0]?.walletAddress ?? "";
  const chainId = accounting.events[0]?.chainId ?? 0;
  const lockRows = accounting.governance.locks.map((lock) => row({
    chainId,
    walletAddress: wallet,
    surface: "governance",
    rowKey: `lock:${lock.lockKey}`,
    sourceDomainEventId: null,
    coverageStatus: lock.coverageStatus,
    confidence: lock.confidence,
    rowJson: { kind: "lock", ...lock },
    evidenceJson: {
      tokenId: lock.tokenId,
      managedTokenId: lock.managedTokenId,
      reasonCodes: lock.reasonCodes,
    },
  }));
  const eventRows = accounting.governance.events.map((event) => row({
    chainId,
    walletAddress: wallet,
    surface: "governance",
    rowKey: `event:${event.eventId ?? event.txHash}`,
    sourceDomainEventId: event.eventId ?? null,
    coverageStatus: event.coverageStatus,
    confidence: event.confidence,
    rowJson: { kind: "event", ...event, occurredAt: event.occurredAt.toISOString() },
    evidenceJson: {
      tokenId: event.tokenId,
      reasonCodes: event.reasonCodes,
    },
  }));
  return [...lockRows, ...eventRows];
}

export function materializeAllDataViewRows(accounting: EngineV2AccountingOutput): EngineV2ReadModelRowInput[] {
  return [
    ...materializeActivityRows({ accounting }),
    ...materializeDepositRows(accounting),
    ...materializeStrategyRows(accounting),
    ...materializePoolRows(accounting),
    ...materializeRewardRows(accounting),
    ...materializeGovernanceRows(accounting),
  ];
}
