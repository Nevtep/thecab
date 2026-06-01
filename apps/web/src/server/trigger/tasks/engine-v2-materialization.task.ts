import { task } from "@trigger.dev/sdk/v3";

import {
  persistAccountingOutputs,
  runChronologicalAccounting,
  toAccountingLotValues,
  toCashFlowValues,
  toResidualInventoryValues,
  type EngineV2AccountingInput,
  type EngineV2DomainEventLike,
  type EngineV2EntityLinkLike,
} from "@/server/analysis/engine-v2/accounting";
import { materializeAllDataViewRows, persistReadModelRows } from "@/server/analysis/engine-v2/materializers";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";

export type EngineV2MaterializationDeps = {
  loadAccountingInput?: (input: { chainId: number; walletAddress: string }) => Promise<EngineV2AccountingInput>;
  persistAccounting?: typeof persistAccountingOutputs;
  persistRows?: typeof persistReadModelRows;
};

export async function runEngineV2AccountChronological(rawPayload: unknown, deps: EngineV2MaterializationDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const accountingInput = await (deps.loadAccountingInput?.(payload) ?? Promise.resolve({ events: [], links: [] }));
  const accounting = runChronologicalAccounting(accountingInput);
  const accountingPayload = {
    db: deps.persistAccounting ? undefined as never : getDb(),
    lots: accounting.deposits.flatMap((deposit) => deposit.lifecycle.map((event) => toAccountingLotValues({
      event: eventToDomainLike(payload, event, deposit.depositId),
      lotKind: "manual_deposit",
      valueUsdAtEvent: event.valueUsd,
      entityType: "deposit",
      entityId: deposit.depositId,
      coverageStatus: event.coverageStatus,
      reasonCodes: event.reasonCodes,
    }))),
    cashFlows: accounting.cashFlows.map((flow) => toCashFlowValues({
      event: eventToDomainLike(payload, flow, flow.eventId ?? flow.txHash),
      flowKind: flow.flowKind,
      tokenAddress: flow.tokenAddress,
      amountRaw: flow.amountRaw,
      valueUsdAtEvent: flow.valueUsdAtEvent,
      coverageStatus: flow.coverageStatus,
      reasonCodes: flow.reasonCodes,
    })),
    residualInventory: accounting.residualInventory.map((item) => toResidualInventoryValues({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      tokenAddress: item.tokenAddress,
      amountRaw: item.amountRaw,
      coverageStatus: item.coverageStatus,
      reasonCodes: item.reasonCodes,
    })),
  };
  if (deps.persistAccounting) {
    await deps.persistAccounting(accountingPayload);
  } else {
    await persistAccountingOutputs(accountingPayload);
  }

  return {
    eventCount: accounting.events.length,
    cashFlowCount: accounting.cashFlows.length,
    residualInventoryCount: accounting.residualInventory.length,
    depositCount: accounting.deposits.length,
    strategyCount: accounting.strategies.length,
    poolCount: accounting.pools.length,
    rewardCount: accounting.rewards.length,
    governanceEventCount: accounting.governance.events.length,
  };
}

export async function runEngineV2MaterializeReadModels(rawPayload: unknown, deps: EngineV2MaterializationDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const accountingInput = await (deps.loadAccountingInput?.(payload) ?? Promise.resolve({ events: [], links: [] }));
  const accounting = runChronologicalAccounting(accountingInput);
  const rows = materializeAllDataViewRows(accounting);
  if (deps.persistRows) {
    await deps.persistRows({ db: undefined as never, rows });
  } else {
    await persistReadModelRows({ db: getDb(), rows });
  }
  const bySurface = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.surface] = (acc[row.surface] ?? 0) + 1;
    return acc;
  }, {});
  return { rowCount: rows.length, bySurface };
}

function eventToDomainLike(
  payload: { chainId: number; walletAddress: string },
  event: {
    eventId?: string | null;
    eventType?: string;
    txHash: string;
    occurredAt: Date;
    coverageStatus?: string;
    reasonCodes?: string[];
  },
  fallbackId: string,
): EngineV2DomainEventLike {
  return {
    id: event.eventId ?? fallbackId,
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    eventType: event.eventType ?? "accounting_projection",
    eventFamily: "accounting",
    occurredAt: event.occurredAt,
    txHash: event.txHash,
    sequenceIndex: 0,
    coverageStatus: event.coverageStatus ?? "unknown",
    confidence: "unknown",
    reasonCodes: event.reasonCodes ?? [],
  };
}

export const engineV2AccountChronologicalTask = task({
  id: "engine-v2-account-chronological",
  run: async (payload: unknown) => runEngineV2AccountChronological(payload),
});

export const engineV2MaterializeReadModelsTask = task({
  id: "engine-v2-materialize-read-models",
  run: async (payload: unknown) => runEngineV2MaterializeReadModels(payload),
});

export type { EngineV2DomainEventLike, EngineV2EntityLinkLike };
