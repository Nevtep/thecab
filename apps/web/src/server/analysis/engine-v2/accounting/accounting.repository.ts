import {
  engineV2AccountingLots,
  engineV2CashFlows,
  engineV2ResidualInventory,
  engineV2Valuations,
} from "@/server/db/schema";

import type { EngineV2DomainEventLike } from "./chronological-accounting";

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
  insert(table: unknown): {
    values(values: unknown[]): {
      onConflictDoNothing(): Promise<unknown>;
    };
  };
};

export async function persistAccountingOutputs(input: {
  db: EngineV2AccountingRepositoryDb;
  lots?: ReturnType<typeof toAccountingLotValues>[];
  cashFlows?: ReturnType<typeof toCashFlowValues>[];
  valuations?: ReturnType<typeof toValuationValues>[];
  residualInventory?: ReturnType<typeof toResidualInventoryValues>[];
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
}
