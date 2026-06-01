import {
  engineV2AccountingLots,
  engineV2CashFlows,
  engineV2GovernanceClaimBatches,
  engineV2GovernanceClaimItems,
  engineV2GovernanceLockEvents,
  engineV2GovernanceLocks,
  engineV2ManagedLockLinks,
  engineV2ResidualInventory,
  engineV2Valuations,
} from "@/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import type { EngineV2DomainEventLike } from "./chronological-accounting";
import type { EngineV2GovernanceProjection } from "./governance-accounting";
import type { EngineV2RewardProjection } from "./reward-accounting";

type PersistedGovernanceLockRow = {
  id: string;
  lockTokenId: string;
};

export type EngineV2AccountingLotInput = {
  event: EngineV2DomainEventLike;
  lotKind: string;
  tokenAddress?: string | null;
  amountRaw?: string | null;
  valueUsdAtEvent?: string | null;
  remainingAmountRaw?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  coverageStatus?: string;
  reasonCodes?: string[];
  metadataJson?: Record<string, unknown>;
};

export type EngineV2CashFlowInput = {
  event: EngineV2DomainEventLike;
  flowKind: string;
  tokenAddress?: string | null;
  amountRaw?: string | null;
  valueUsdAtEvent?: string | null;
  coverageStatus?: string;
  reasonCodes?: string[];
  metadataJson?: Record<string, unknown>;
};

export type EngineV2ValuationInput = {
  event?: EngineV2DomainEventLike | null;
  chainId: number;
  walletAddress?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  valuationKind: string;
  tokenAddress?: string | null;
  amountRaw?: string | null;
  valueUsd?: string | null;
  pricedAt?: Date | null;
  pricePointId?: string | null;
  status?: string;
  reasonCodes?: string[];
  metadataJson?: Record<string, unknown>;
};

export type EngineV2ResidualInventoryInput = {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountRaw: string;
  valueUsd?: string | null;
  valuationStatus?: string;
  coverageStatus?: string;
  reasonCodes?: string[];
};

export function toAccountingLotValues(input: EngineV2AccountingLotInput): typeof engineV2AccountingLots.$inferInsert {
  return {
    chainId: input.event.chainId,
    walletAddress: input.event.walletAddress.toLowerCase(),
    sourceDomainEventId: input.event.id ?? null,
    lotKind: input.lotKind,
    tokenAddress: input.tokenAddress?.toLowerCase() ?? null,
    amountRaw: input.amountRaw ?? null,
    valueUsdAtEvent: input.valueUsdAtEvent ?? null,
    remainingAmountRaw: input.remainingAmountRaw ?? input.amountRaw ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    coverageStatus: input.coverageStatus ?? input.event.coverageStatus,
    reasonCodes: input.reasonCodes ?? input.event.reasonCodes,
    metadataJson: input.metadataJson ?? {},
  };
}

export function toCashFlowValues(input: EngineV2CashFlowInput): typeof engineV2CashFlows.$inferInsert {
  return {
    chainId: input.event.chainId,
    walletAddress: input.event.walletAddress.toLowerCase(),
    sourceDomainEventId: input.event.id ?? null,
    flowKind: input.flowKind,
    tokenAddress: input.tokenAddress?.toLowerCase() ?? null,
    amountRaw: input.amountRaw ?? null,
    valueUsdAtEvent: input.valueUsdAtEvent ?? null,
    occurredAt: input.event.occurredAt,
    txHash: input.event.txHash.toLowerCase(),
    coverageStatus: input.coverageStatus ?? input.event.coverageStatus,
    reasonCodes: input.reasonCodes ?? input.event.reasonCodes,
    metadataJson: input.metadataJson ?? {},
  };
}

export function toValuationValues(input: EngineV2ValuationInput): typeof engineV2Valuations.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress?.toLowerCase() ?? null,
    sourceDomainEventId: input.event?.id ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    valuationKind: input.valuationKind,
    tokenAddress: input.tokenAddress?.toLowerCase() ?? null,
    amountRaw: input.amountRaw ?? null,
    valueUsd: input.valueUsd ?? null,
    pricedAt: input.pricedAt ?? null,
    pricePointId: input.pricePointId ?? null,
    status: input.status ?? "unknown",
    reasonCodes: input.reasonCodes ?? [],
    metadataJson: input.metadataJson ?? {},
  };
}

export function toResidualInventoryValues(input: EngineV2ResidualInventoryInput): typeof engineV2ResidualInventory.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    tokenAddress: input.tokenAddress.toLowerCase(),
    amountRaw: input.amountRaw,
    valueUsd: input.valueUsd ?? null,
    valuationStatus: input.valuationStatus ?? "unknown",
    coverageStatus: input.coverageStatus ?? "partial",
    reasonCodes: input.reasonCodes ?? [],
  };
}

export type EngineV2AccountingRepositoryDb = {
  insert(table: unknown): any;
  select(): any;
};

function isUuid(value: string | null | undefined) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mergeCoverageStatus(values: string[]) {
  if (values.some((value) => value === "unresolved")) return "unresolved";
  if (values.some((value) => value === "partial")) return "partial";
  if (values.some((value) => value === "unsupported")) return "unsupported";
  if (values.some((value) => value === "excluded")) return values.every((value) => value === "excluded") ? "excluded" : "partial";
  if (values.some((value) => value === "full")) return "full";
  return "unknown";
}

function mergeConfidence(values: string[]) {
  if (values.some((value) => value === "low")) return "low";
  if (values.some((value) => value === "medium")) return "medium";
  if (values.some((value) => value === "high")) return "high";
  return "unknown";
}

function claimSurfaceForReward(reward: EngineV2RewardProjection) {
  if (reward.rewardType.includes("bribe")) return "bribe_claim";
  if (reward.rewardType.includes("fee")) return "fee_claim";
  if (reward.rewardType.includes("rebase")) return "rebase_claim";
  return "governance_claim";
}

function toGovernanceLockValues(input: {
  chainId: number;
  walletAddress: string;
  lock: EngineV2GovernanceProjection["locks"][number];
}): typeof engineV2GovernanceLocks.$inferInsert | null {
  if (!input.lock.votingEscrowAddress) return null;
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    ownerAddress: input.walletAddress.toLowerCase(),
    votingEscrowAddress: input.lock.votingEscrowAddress.toLowerCase(),
    lockTokenId: input.lock.tokenId,
    originKind: input.lock.originKind,
    status: input.lock.status,
    coverageStatus: input.lock.coverageStatus,
    confidence: input.lock.confidence,
    reasonCodes: input.lock.reasonCodes,
    metadataJson: {
      lockKey: input.lock.lockKey,
      managedTokenId: input.lock.managedTokenId,
    },
  };
}

function toGovernanceLockEventValues(input: {
  chainId: number;
  governanceLockId: string;
  event: EngineV2GovernanceProjection["events"][number];
}): typeof engineV2GovernanceLockEvents.$inferInsert {
  return {
    governanceLockId: input.governanceLockId,
    domainEventId: input.event.eventId,
    chainId: input.chainId,
    eventType: input.event.eventType,
    occurredAt: input.event.occurredAt,
    txHash: input.event.txHash.toLowerCase(),
    amountRaw: input.event.amountRaw ?? null,
    lockEnd: input.event.lockEnd ?? null,
    coverageStatus: input.event.coverageStatus,
    confidence: input.event.confidence,
    evidenceJson: {
      tokenId: input.event.tokenId,
      votingEscrowAddress: input.event.votingEscrowAddress,
      reasonCodes: input.event.reasonCodes,
    },
  };
}

function toManagedLockLinkValues(input: {
  chainId: number;
  walletAddress: string;
  userLockId: string;
  managedLockId?: string | null;
  link: EngineV2GovernanceProjection["managedLinks"][number];
}): typeof engineV2ManagedLockLinks.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    userLockId: input.userLockId,
    managedLockId: input.managedLockId ?? null,
    userTokenId: input.link.userTokenId,
    managedTokenId: input.link.managedTokenId,
    managerAddress: input.link.managerAddress?.toLowerCase() ?? null,
    depositedAt: input.link.depositedAt,
    withdrawnAt: null,
    evidenceJson: {
      txHash: input.link.txHash,
      sourceEventId: input.link.sourceEventId,
      votingEscrowAddress: input.link.votingEscrowAddress,
    },
  };
}

function toGovernanceClaimBatchValues(input: {
  chainId: number;
  walletAddress: string;
  txHash: string;
  claimSurface: string;
  items: EngineV2RewardProjection[];
}): typeof engineV2GovernanceClaimBatches.$inferInsert {
  return {
    domainEventId: input.items[0]?.sourceDomainEventId ?? null,
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txHash: input.txHash.toLowerCase(),
    claimSurface: input.claimSurface,
    itemCount: input.items.length,
    coverageStatus: mergeCoverageStatus(input.items.map((item) => item.coverageStatus)),
    confidence: mergeConfidence(input.items.map((item) => item.confidence)),
    evidenceJson: {
      rewardIds: input.items.map((item) => item.rewardId),
      reasonCodes: Array.from(new Set(input.items.flatMap((item) => item.reasonCodes))),
      poolContributions: input.items.map((item) => item.poolContribution),
    },
  };
}

function toGovernanceClaimItemValues(input: {
  chainId: number;
  walletAddress: string;
  reward: EngineV2RewardProjection;
  itemIndex: number;
}): typeof engineV2GovernanceClaimItems.$inferInsert {
  return {
    domainEventId: input.reward.sourceDomainEventId ?? null,
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txHash: input.reward.txHash.toLowerCase(),
    itemIndex: input.itemIndex,
    rewardType: input.reward.rewardType,
    tokenAddress: input.reward.tokenAddress?.toLowerCase() ?? null,
    amountRaw: input.reward.amountRaw ?? null,
    valueUsdAtClaim: input.reward.amountUsd ?? null,
    lockTokenId: input.reward.lockTokenId ?? null,
    poolId: isUuid(input.reward.poolId) ? input.reward.poolId : null,
    sourceContract: input.reward.sourceContract?.toLowerCase() ?? null,
    affectsTotals: input.reward.affectsTotals,
    poolContribution: input.reward.poolContribution,
    coverageStatus: input.reward.coverageStatus,
    confidence: input.reward.confidence,
    evidenceJson: {
      rewardId: input.reward.rewardId,
      linkedEntityId: input.reward.linkedEntityId,
      reasonCodes: input.reward.reasonCodes,
    },
  };
}

export async function persistAccountingOutputs(input: {
  db: EngineV2AccountingRepositoryDb;
  chainId?: number;
  walletAddress?: string;
  lots?: ReturnType<typeof toAccountingLotValues>[];
  cashFlows?: ReturnType<typeof toCashFlowValues>[];
  valuations?: ReturnType<typeof toValuationValues>[];
  residualInventory?: ReturnType<typeof toResidualInventoryValues>[];
  governance?: EngineV2GovernanceProjection;
  rewards?: EngineV2RewardProjection[];
}) {
  if (input.lots?.length) {
    await input.db.insert(engineV2AccountingLots).values(input.lots).onConflictDoNothing();
  }
  if (input.cashFlows?.length) {
    await input.db.insert(engineV2CashFlows).values(input.cashFlows).onConflictDoNothing();
  }
  if (input.valuations?.length) {
    await input.db.insert(engineV2Valuations).values(input.valuations).onConflictDoNothing();
  }
  if (input.residualInventory?.length) {
    await input.db.insert(engineV2ResidualInventory).values(input.residualInventory).onConflictDoNothing();
  }

  if (input.governance && input.chainId && input.walletAddress) {
    const governanceLockRows = input.governance.locks
      .map((lock) => toGovernanceLockValues({ chainId: input.chainId!, walletAddress: input.walletAddress!, lock }))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (governanceLockRows.length > 0) {
      await input.db.insert(engineV2GovernanceLocks).values(governanceLockRows).onConflictDoNothing();
    }

    const governanceTokenIds = Array.from(new Set([
      ...input.governance.locks.map((lock) => lock.tokenId),
      ...input.governance.events.map((event) => event.tokenId).filter((value): value is string => Boolean(value)),
      ...input.governance.managedLinks.flatMap((link) => [link.userTokenId, link.managedTokenId]),
      ...(input.rewards ?? []).map((reward) => reward.lockTokenId).filter((value): value is string => Boolean(value)),
    ]));

    const persistedLocks: PersistedGovernanceLockRow[] = governanceTokenIds.length > 0
      ? await input.db.select().from(engineV2GovernanceLocks).where(and(
        eq(engineV2GovernanceLocks.chainId, input.chainId),
        eq(engineV2GovernanceLocks.walletAddress, input.walletAddress.toLowerCase()),
        inArray(engineV2GovernanceLocks.lockTokenId, governanceTokenIds),
      ))
      : [];
    const lockByTokenId = new Map<string, PersistedGovernanceLockRow>(persistedLocks.map((lock: PersistedGovernanceLockRow) => [lock.lockTokenId, lock]));

    const governanceEventRows = input.governance.events
      .map((event) => {
        if (!event.tokenId) return null;
        const governanceLock = lockByTokenId.get(event.tokenId);
        return governanceLock ? toGovernanceLockEventValues({
          chainId: input.chainId!,
          governanceLockId: governanceLock.id,
          event,
        }) : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (governanceEventRows.length > 0) {
      await input.db.insert(engineV2GovernanceLockEvents).values(governanceEventRows).onConflictDoNothing();
    }

    const managedLinkRows = input.governance.managedLinks
      .map((link) => {
        const userLock = lockByTokenId.get(link.userTokenId);
        if (!userLock) return null;
        const managedLock = lockByTokenId.get(link.managedTokenId);
        return toManagedLockLinkValues({
          chainId: input.chainId!,
          walletAddress: input.walletAddress!,
          userLockId: userLock.id,
          managedLockId: managedLock?.id ?? null,
          link,
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (managedLinkRows.length > 0) {
      await input.db.insert(engineV2ManagedLockLinks).values(managedLinkRows).onConflictDoNothing();
    }
  }

  if (input.rewards && input.chainId && input.walletAddress) {
    const governanceRewards = input.rewards.filter((reward) => reward.ownerStatus === "governance");
    const groupedRewards = new Map<string, EngineV2RewardProjection[]>();
    for (const reward of governanceRewards) {
      const claimSurface = claimSurfaceForReward(reward);
      const key = `${reward.txHash.toLowerCase()}:${claimSurface}`;
      const current = groupedRewards.get(key) ?? [];
      current.push(reward);
      groupedRewards.set(key, current);
    }

    const claimBatchRows = [...groupedRewards.entries()].map(([key, rewards]) => {
      const [txHash, claimSurface] = key.split(":");
      return toGovernanceClaimBatchValues({
        chainId: input.chainId!,
        walletAddress: input.walletAddress!,
        txHash,
        claimSurface,
        items: rewards,
      });
    });
    if (claimBatchRows.length > 0) {
      await input.db.insert(engineV2GovernanceClaimBatches).values(claimBatchRows).onConflictDoNothing();
    }

    const claimItemRows = governanceRewards.map((reward, index) => toGovernanceClaimItemValues({
      chainId: input.chainId!,
      walletAddress: input.walletAddress!,
      reward,
      itemIndex: reward.itemIndex ?? index,
    }));
    if (claimItemRows.length > 0) {
      await input.db.insert(engineV2GovernanceClaimItems).values(claimItemRows).onConflictDoNothing();
    }
  }
}
