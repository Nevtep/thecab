import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getAnalysisSlice } from "@/server/analysis/analysis-slice.repository";
import { persistResolvedRewardEvents } from "@/server/analysis/enginePersistence";
import { getDb } from "@/server/db/client";
import { deposits, rawProviderRecords, strategies, strategyExposures } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

type RewardCandidate = {
  txHash: string;
  occurredAt: Date;
  category: string | null;
  summary: string | null;
  protocol: string | null;
  targetType: "deposit" | "strategy" | null;
  targetTokenId: string | null;
  targetWrapperAddress: string | null;
};

function asRewardCandidate(value: unknown): RewardCandidate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const txHash = typeof candidate.txHash === "string" ? candidate.txHash : null;
  const occurredAtRaw = typeof candidate.occurredAt === "string" ? candidate.occurredAt : null;
  if (!txHash || !occurredAtRaw) {
    return null;
  }

  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return {
    txHash,
    occurredAt,
    category: typeof candidate.category === "string" ? candidate.category : null,
    summary: typeof candidate.summary === "string" ? candidate.summary : null,
    protocol: typeof candidate.protocol === "string" ? candidate.protocol : null,
    targetType: candidate.targetType === "deposit" || candidate.targetType === "strategy"
      ? candidate.targetType
      : null,
    targetTokenId: typeof candidate.targetTokenId === "string" ? candidate.targetTokenId : null,
    targetWrapperAddress: typeof candidate.targetWrapperAddress === "string"
      ? candidate.targetWrapperAddress.toLowerCase()
      : null,
  };
}

function inferRewardType(candidate: RewardCandidate) {
  const text = [candidate.category, candidate.summary].filter(Boolean).join(" ").toLowerCase();
  return text.includes("reward") || text.includes("collect") ? "reward_claim" : "claim";
}

export type PhaseRewardsTaskPayload = {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
};

export const phaseRewardsTask = task({
  id: "phase-rewards",
  run: async (payload: PhaseRewardsTaskPayload) => {
    const [run, slice] = await Promise.all([
      getAnalysisRunById(payload.runId),
      getAnalysisSlice(payload.sliceId),
    ]);
    if (!run || !slice || run.status === "cancelled") {
      return {
        rewardEventCount: 0,
        coverageReasons: [],
      };
    }

    const db = getDb();
    const [rows, depositRows, strategyRows] = await Promise.all([
      db
      .select({ responseJson: rawProviderRecords.responseJson })
      .from(rawProviderRecords)
      .where(
        and(
          eq(rawProviderRecords.runId, payload.runId),
          eq(rawProviderRecords.sliceId, payload.sliceId),
          eq(rawProviderRecords.provider, "analysis-engine"),
          eq(rawProviderRecords.endpoint, "/protocols/reward-candidates"),
        ),
      )
      .orderBy(desc(rawProviderRecords.createdAt))
      .limit(1),
      db
        .select({
          id: deposits.id,
          tokenId: deposits.tokenId,
          protocol: deposits.metadataJson,
        })
        .from(deposits)
        .where(
          and(
            eq(deposits.walletAddress, payload.walletAddress.toLowerCase()),
            eq(deposits.chainId, payload.chainId),
          ),
        ),
      db
        .select({
          id: strategies.id,
          wrapperAddress: strategyExposures.wrapperAddress,
          protocol: strategies.protocol,
        })
        .from(strategyExposures)
        .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
        .where(
          and(
            eq(strategyExposures.walletAddress, payload.walletAddress.toLowerCase()),
            eq(strategyExposures.chainId, payload.chainId),
          ),
        ),
    ]);

    const latestRewardCandidates = Array.isArray(rows[0]?.responseJson.rewardCandidates)
      ? rows[0]?.responseJson.rewardCandidates.map(asRewardCandidate).filter((candidate): candidate is RewardCandidate => Boolean(candidate))
      : [];

    const depositTargets = depositRows.map((row) => ({
      id: row.id,
      tokenId: row.tokenId,
      protocol: typeof row.protocol.protocol === "string" ? row.protocol.protocol : "aerodrome",
    }));
    const strategyTargets = strategyRows.map((row) => ({
      id: row.id,
      wrapperAddress: row.wrapperAddress.toLowerCase(),
      protocol: row.protocol,
    }));

    const resolvedClaims = latestRewardCandidates.map((candidate, index) => {
      const matchingDeposit = candidate.targetTokenId
        ? depositTargets.find((target) => target.tokenId === candidate.targetTokenId)
        : candidate.protocol === "aerodrome"
          ? depositTargets[0]
          : null;
      const matchingStrategy = candidate.targetWrapperAddress
        ? strategyTargets.find((target) => target.wrapperAddress === candidate.targetWrapperAddress)
        : candidate.protocol === "mellow"
          ? strategyTargets[0]
          : null;

      return {
        txHash: candidate.txHash,
        logIndex: index,
        rewardType: inferRewardType(candidate),
        depositOrStrategyId: matchingDeposit?.id ?? matchingStrategy?.id ?? null,
        occurredAt: candidate.occurredAt,
        category: candidate.category,
        summary: candidate.summary,
        protocol: candidate.protocol,
        targetType: matchingDeposit ? "deposit" : matchingStrategy ? "strategy" : candidate.targetType,
        targetTokenId: candidate.targetTokenId,
        targetWrapperAddress: candidate.targetWrapperAddress,
      };
    });

    const unresolvedCandidateCount = resolvedClaims.filter((claim) => !claim.depositOrStrategyId).length;
    const accrualSnapshots = [
      ...depositTargets.map((target) => ({
        depositOrStrategyId: target.id,
        rewardType: "reward_accrual_snapshot",
        protocol: target.protocol,
        targetType: "deposit" as const,
        targetTokenId: target.tokenId,
      })),
      ...strategyTargets.map((target) => ({
        depositOrStrategyId: target.id,
        rewardType: "reward_accrual_snapshot",
        protocol: target.protocol,
        targetType: "strategy" as const,
        targetWrapperAddress: target.wrapperAddress,
      })),
    ];

    const persisted = await persistResolvedRewardEvents({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      sliceEndUtc: slice.sliceEndUtc,
      claims: resolvedClaims,
      accrualSnapshots,
    });

    return {
      rewardEventCount: persisted.claimCount + persisted.accrualSnapshotCount,
      providerAttempts: {
        moralis: 0,
        alchemyRpc: 0,
        alchemyPrices: 0,
      },
      coverageReasons: rows.length === 0 || unresolvedCandidateCount > 0 ? ["partialDecoded"] : [],
    };
  },
});