import { and, eq, inArray } from "drizzle-orm";
import { task } from "@trigger.dev/sdk/v3";

import {
  buildGovernanceEventRows,
  buildGovernanceMetricSnapshot,
  type GovernanceEventMaterialization,
  type GovernanceLedgerInput,
  type GovernanceMetricSnapshotMaterialization,
} from "@/server/analysis/governance-read-models";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import {
  governanceEvents,
  governanceMetricSnapshots,
  ledgerEvents,
  processedTxs,
} from "@/server/db/schema";

export type PhaseGovernanceTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

export type GovernanceMaterializationPlan = {
  governanceEvents: GovernanceEventMaterialization[];
  metricSnapshot: GovernanceMetricSnapshotMaterialization;
};

export function buildGovernanceMaterializationPlan(input: {
  chainId: number;
  walletAddress: string;
  ledgerRows: GovernanceLedgerInput[];
}): GovernanceMaterializationPlan {
  const rows = buildGovernanceEventRows(input.ledgerRows);
  return {
    governanceEvents: rows,
    metricSnapshot: buildGovernanceMetricSnapshot({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      rows,
    }),
  };
}

type PhaseGovernanceDeps = {
  loadLedgerRows: (payload: PhaseGovernanceTaskPayload) => Promise<GovernanceLedgerInput[]>;
  persistPlan: (payload: PhaseGovernanceTaskPayload, plan: GovernanceMaterializationPlan) => Promise<void>;
};

async function loadLedgerRows(payload: PhaseGovernanceTaskPayload): Promise<GovernanceLedgerInput[]> {
  const db = getDb();
  const txRows = await db
    .select({ txHash: processedTxs.txHash })
    .from(processedTxs)
    .where(eq(processedTxs.firstRunId, payload.runId));
  const txHashes = txRows.map((row) => row.txHash.toLowerCase());
  if (txHashes.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: ledgerEvents.id,
      chainId: ledgerEvents.chainId,
      walletAddress: ledgerEvents.walletAddress,
      txHash: ledgerEvents.txHash,
      logIndex: ledgerEvents.logIndex,
      eventType: ledgerEvents.eventType,
      occurredAt: ledgerEvents.occurredAt,
      classification: ledgerEvents.classification,
      confidence: ledgerEvents.confidence,
      metadataJson: ledgerEvents.metadataJson,
    })
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.chainId, payload.chainId),
        eq(ledgerEvents.walletAddress, payload.walletAddress.toLowerCase()),
        inArray(ledgerEvents.txHash, txHashes),
      ),
    );

  return rows.map((row) => ({
    ...row,
    category: typeof row.metadataJson.category === "string" ? row.metadataJson.category : null,
    summary: typeof row.metadataJson.summary === "string" ? row.metadataJson.summary : null,
    protocol: typeof row.metadataJson.protocol === "string" ? row.metadataJson.protocol : null,
    methodLabel: typeof row.metadataJson.methodLabel === "string" ? row.metadataJson.methodLabel : null,
    surfaceKind: typeof row.metadataJson.surfaceKind === "string"
      ? row.metadataJson.surfaceKind as GovernanceLedgerInput["surfaceKind"]
      : null,
    rewardType: typeof row.metadataJson.rewardType === "string" ? row.metadataJson.rewardType : null,
  }));
}

async function persistGovernancePlan(
  payload: PhaseGovernanceTaskPayload,
  plan: GovernanceMaterializationPlan,
) {
  const db = getDb();
  const walletAddress = payload.walletAddress.toLowerCase();
  const txHashes = plan.governanceEvents.map((row) => row.txHash);

  await db
    .delete(governanceMetricSnapshots)
    .where(
      and(
        eq(governanceMetricSnapshots.chainId, payload.chainId),
        eq(governanceMetricSnapshots.walletAddress, walletAddress),
        eq(governanceMetricSnapshots.runId, payload.runId),
      ),
    );

  if (txHashes.length > 0) {
    await db
      .delete(governanceEvents)
      .where(
        and(
          eq(governanceEvents.chainId, payload.chainId),
          eq(governanceEvents.walletAddress, walletAddress),
          inArray(governanceEvents.txHash, txHashes),
        ),
      );

    await db
      .insert(governanceEvents)
      .values(plan.governanceEvents);
  }

  await db.insert(governanceMetricSnapshots).values({
    runId: payload.runId,
    chainId: payload.chainId,
    walletAddress,
    summaryJson: plan.metricSnapshot.summaryJson,
    selectedDetailJson: plan.metricSnapshot.selectedDetailJson,
    coverageStatus: plan.metricSnapshot.coverageStatus,
    confidence: plan.metricSnapshot.confidence,
  });
}

export async function materializeGovernanceForRun(
  payload: PhaseGovernanceTaskPayload,
  deps: PhaseGovernanceDeps = {
    loadLedgerRows,
    persistPlan: persistGovernancePlan,
  },
) {
  const ledgerRows = await deps.loadLedgerRows(payload);
  const plan = buildGovernanceMaterializationPlan({
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    ledgerRows,
  });
  await deps.persistPlan(payload, plan);
  return {
    governanceEventCount: plan.governanceEvents.length,
    metricSnapshotCount: 1,
  };
}

export const phaseGovernanceTask = task({
  id: "phase-governance",
  run: async (payload: PhaseGovernanceTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.status === "cancelled") {
      return { governanceEventCount: 0, metricSnapshotCount: 0 };
    }

    return materializeGovernanceForRun(payload);
  },
});
