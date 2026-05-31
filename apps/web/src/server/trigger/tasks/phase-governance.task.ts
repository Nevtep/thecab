import { and, eq, inArray } from "drizzle-orm";
import { task } from "@trigger.dev/sdk/v3";

import {
  buildGovernanceEventRows,
  buildGovernanceMetricSnapshot,
  buildGovernanceRewardRows,
  type GovernanceEventMaterialization,
  type GovernanceLedgerInput,
  type GovernanceMetricSnapshotMaterialization,
  type GovernanceRewardInput,
  type GovernanceRewardMaterialization,
} from "@/server/analysis/governance-read-models";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import {
  governanceEvents,
  governanceMetricSnapshots,
  governanceRewardRows,
  ledgerEvents,
  processedTxs,
  rewardEvents,
} from "@/server/db/schema";

export type PhaseGovernanceTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

export type GovernanceMaterializationPlan = {
  governanceEvents: GovernanceEventMaterialization[];
  governanceRewards: GovernanceRewardMaterialization[];
  metricSnapshot: GovernanceMetricSnapshotMaterialization;
};

export function buildGovernanceMaterializationPlan(input: {
  chainId: number;
  walletAddress: string;
  ledgerRows: GovernanceLedgerInput[];
  rewardRows?: GovernanceRewardInput[];
}): GovernanceMaterializationPlan {
  const rows = buildGovernanceEventRows(input.ledgerRows);
  return {
    governanceEvents: rows,
    governanceRewards: buildGovernanceRewardRows(input.rewardRows ?? []),
    metricSnapshot: buildGovernanceMetricSnapshot({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      rows,
    }),
  };
}

type PhaseGovernanceDeps = {
  loadLedgerRows: (payload: PhaseGovernanceTaskPayload) => Promise<GovernanceLedgerInput[]>;
  loadRewardRows: (payload: PhaseGovernanceTaskPayload) => Promise<GovernanceRewardInput[]>;
  persistPlan: (payload: PhaseGovernanceTaskPayload, plan: GovernanceMaterializationPlan) => Promise<void>;
};

async function loadRunTxHashes(payload: PhaseGovernanceTaskPayload) {
  const db = getDb();
  const txRows = await db
    .select({ txHash: processedTxs.txHash })
    .from(processedTxs)
    .where(eq(processedTxs.firstRunId, payload.runId));
  return [...new Set(txRows.map((row) => row.txHash.toLowerCase()))];
}

async function loadLedgerRows(payload: PhaseGovernanceTaskPayload): Promise<GovernanceLedgerInput[]> {
  const db = getDb();
  const txHashes = await loadRunTxHashes(payload);
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

async function loadRewardRows(payload: PhaseGovernanceTaskPayload): Promise<GovernanceRewardInput[]> {
  const db = getDb();
  const txHashes = await loadRunTxHashes(payload);
  if (txHashes.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: rewardEvents.id,
      chainId: rewardEvents.chainId,
      walletAddress: rewardEvents.walletAddress,
      txHash: rewardEvents.txHash,
      logIndex: rewardEvents.logIndex,
      rewardType: rewardEvents.rewardType,
      resolutionBasis: rewardEvents.resolutionBasis,
      resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
      tokenAddress: rewardEvents.tokenAddress,
      amountRaw: rewardEvents.amountRaw,
      amountUsd: rewardEvents.amountUsd,
      occurredAt: rewardEvents.occurredAt,
      resolutionStatus: rewardEvents.resolutionStatus,
      resolvedPoolId: rewardEvents.resolvedPoolId,
      metadataJson: rewardEvents.metadataJson,
    })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.chainId, payload.chainId),
        eq(rewardEvents.walletAddress, payload.walletAddress.toLowerCase()),
        inArray(rewardEvents.txHash, txHashes),
        eq(rewardEvents.isAccrualSnapshot, false),
      ),
    );

  return rows.map((row) => ({
    ...row,
    metadataJson: row.metadataJson ?? {},
  }));
}

async function persistGovernancePlan(
  payload: PhaseGovernanceTaskPayload,
  plan: GovernanceMaterializationPlan,
) {
  const db = getDb();
  const walletAddress = payload.walletAddress.toLowerCase();
  const txHashes = plan.governanceEvents.map((row) => row.txHash);
  const rewardTxHashes = plan.governanceRewards.map((row) => row.txHash);

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

  if (rewardTxHashes.length > 0) {
    await db
      .delete(governanceRewardRows)
      .where(
        and(
          eq(governanceRewardRows.chainId, payload.chainId),
          eq(governanceRewardRows.walletAddress, walletAddress),
          inArray(governanceRewardRows.txHash, rewardTxHashes),
        ),
      );

    await db
      .insert(governanceRewardRows)
      .values(plan.governanceRewards.map((row) => ({
        ...row,
        runId: payload.runId,
      })));
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
    loadRewardRows,
    persistPlan: persistGovernancePlan,
  },
) {
  const [ledgerRows, rewardRows] = await Promise.all([
    deps.loadLedgerRows(payload),
    deps.loadRewardRows(payload),
  ]);
  const plan = buildGovernanceMaterializationPlan({
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    ledgerRows,
    rewardRows,
  });
  await deps.persistPlan(payload, plan);
  return {
    governanceEventCount: plan.governanceEvents.length,
    governanceRewardCount: plan.governanceRewards.length,
    metricSnapshotCount: 1,
  };
}

export const phaseGovernanceTask = task({
  id: "phase-governance",
  run: async (payload: PhaseGovernanceTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.status === "cancelled") {
      return { governanceEventCount: 0, governanceRewardCount: 0, metricSnapshotCount: 0 };
    }

    return materializeGovernanceForRun(payload);
  },
});
