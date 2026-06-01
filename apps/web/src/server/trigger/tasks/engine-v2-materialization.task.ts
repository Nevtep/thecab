import { task, tasks } from "@trigger.dev/sdk/v3";
import { and, asc, eq, inArray } from "drizzle-orm";

import { finalizeAnalysisRun, updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
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
import { engineV2DomainEventLinks, engineV2DomainEvents } from "@/server/db/schema";

export type EngineV2MaterializationDeps = {
  loadAccountingInput?: (input: { chainId: number; walletAddress: string }) => Promise<EngineV2AccountingInput>;
  persistAccounting?: typeof persistAccountingOutputs;
  persistRows?: typeof persistReadModelRows;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
  updateRunProgress?: typeof updateAnalysisRunProgress;
  finalizeRun?: typeof finalizeAnalysisRun;
};

async function loadAccountingInputFromDb(input: { chainId: number; walletAddress: string }): Promise<EngineV2AccountingInput> {
  const db = getDb();
  const events = await db.select().from(engineV2DomainEvents).where(and(
    eq(engineV2DomainEvents.chainId, input.chainId),
    eq(engineV2DomainEvents.walletAddress, input.walletAddress.toLowerCase()),
  )).orderBy(asc(engineV2DomainEvents.occurredAt), asc(engineV2DomainEvents.sequenceIndex));
  const eventIds = events.map((event) => event.id);
  const links = eventIds.length > 0
    ? await db.select().from(engineV2DomainEventLinks).where(and(
      eq(engineV2DomainEventLinks.chainId, input.chainId),
      inArray(engineV2DomainEventLinks.domainEventId, eventIds),
    ))
    : [];
  return {
    events: events.map((event) => ({
      id: event.id,
      chainId: event.chainId,
      walletAddress: event.walletAddress,
      canonicalTransactionId: event.canonicalTransactionId,
      eventType: event.eventType,
      eventFamily: event.eventFamily,
      occurredAt: event.occurredAt,
      txHash: event.txHash,
      sequenceIndex: event.sequenceIndex,
      coverageStatus: event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: event.reasonCodes,
      valueEffectJson: event.valueEffectJson,
      evidenceJson: event.evidenceJson,
      metadataJson: event.metadataJson,
    })),
    links: links.map((link) => ({
      domainEventId: link.domainEventId,
      entityType: link.entityType,
      entityId: link.entityId,
      linkKind: link.linkKind,
      confidence: link.confidence,
      evidenceJson: link.evidenceJson,
    })),
  };
}

export async function runEngineV2AccountChronological(rawPayload: unknown, deps: EngineV2MaterializationDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_accounting",
      progressPct: 86,
    });
  }
  const accountingInput = await (deps.loadAccountingInput?.(payload) ?? loadAccountingInputFromDb(payload));
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
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-materialize-read-models", payload, {
    idempotencyKey: `engine-v2-materialize:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

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
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_materialization",
      progressPct: 96,
    });
  }
  const accountingInput = await (deps.loadAccountingInput?.(payload) ?? loadAccountingInputFromDb(payload));
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
  if (payload.analysisRunId) {
    const finalizeRun = deps.finalizeRun ?? finalizeAnalysisRun;
    await finalizeRun({
      runId: payload.analysisRunId,
      status: "complete",
      coverage: rows.some((row) => row.coverageStatus === "partial" || row.coverageStatus === "unresolved") ? "partial" : "full",
      coverageReasonsJson: Array.from(new Set(rows.flatMap((row) => {
        const reasonCodes = row.evidenceJson.reasonCodes;
        return Array.isArray(reasonCodes) ? reasonCodes.filter((item): item is string => typeof item === "string") : [];
      }))),
      lastError: null,
    });
  }
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
