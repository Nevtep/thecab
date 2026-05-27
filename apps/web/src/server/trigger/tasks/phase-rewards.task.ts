import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getAnalysisSlice } from "@/server/analysis/analysis-slice.repository";
import { persistResolvedRewardEvents } from "@/server/analysis/enginePersistence";
import { getDb } from "@/server/db/client";
import { deposits, ledgerEvents, rawProviderRecords, strategies, strategyExposures } from "@/server/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

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

type RewardDepositTarget = {
  id: string;
  tokenId: string | null;
  protocol: string;
};

type RewardStrategyTarget = {
  id: string;
  wrapperAddress: string;
  protocol: string | null;
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

export function isGovernanceRewardCandidate(input: {
  classification: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
}) {
  const text = [input.classification, input.category, input.methodLabel, input.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const touchesVotingEscrow =
    text.includes("voting escrow") ||
    text.includes("veaero") ||
    (text.includes("escrow") && text.includes("aerodrome"));

  if (!touchesVotingEscrow) {
    return input.classification === "governance";
  }

  return true;
}

export function resolveRewardClaimTarget(input: {
  candidate: RewardCandidate;
  depositTargets: RewardDepositTarget[];
  strategyTargets: RewardStrategyTarget[];
}) {
  const matchingDeposit = input.candidate.targetTokenId
    ? input.depositTargets.find((target) => target.tokenId === input.candidate.targetTokenId)
    : null;
  const matchingStrategy = input.candidate.targetWrapperAddress
    ? input.strategyTargets.find((target) => target.wrapperAddress === input.candidate.targetWrapperAddress)
    : null;

  return {
    depositOrStrategyId: matchingDeposit?.id ?? matchingStrategy?.id ?? null,
    targetType: matchingDeposit ? "deposit" : matchingStrategy ? "strategy" : input.candidate.targetType,
  };
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

    const latestRewardCandidates = Array.isArray(run.metadataJson.latestRewardCandidates)
      ? run.metadataJson.latestRewardCandidates.map(asRewardCandidate).filter((candidate): candidate is RewardCandidate => Boolean(candidate))
      : Array.isArray(rows[0]?.responseJson.rewardCandidates)
        ? rows[0]?.responseJson.rewardCandidates.map(asRewardCandidate).filter((candidate): candidate is RewardCandidate => Boolean(candidate))
        : [];
    const normalizedCandidateTxHashes = [...new Set(latestRewardCandidates.map((candidate) => candidate.txHash.toLowerCase()))];
    const ledgerRows = normalizedCandidateTxHashes.length === 0
      ? []
      : await db
        .select({
          txHash: ledgerEvents.txHash,
          classification: ledgerEvents.classification,
          metadataJson: ledgerEvents.metadataJson,
        })
        .from(ledgerEvents)
        .where(
          and(
            eq(ledgerEvents.walletAddress, payload.walletAddress.toLowerCase()),
            eq(ledgerEvents.chainId, payload.chainId),
            inArray(ledgerEvents.txHash, normalizedCandidateTxHashes),
          ),
        );
    const governanceCandidateTxHashes = new Set(
      ledgerRows
        .filter((row) => isGovernanceRewardCandidate({
          classification: row.classification,
          category: typeof row.metadataJson.category === "string" ? row.metadataJson.category : null,
          methodLabel: typeof row.metadataJson.methodLabel === "string" ? row.metadataJson.methodLabel : null,
          summary: typeof row.metadataJson.summary === "string" ? row.metadataJson.summary : null,
        }))
        .map((row) => row.txHash.toLowerCase()),
    );
    const filteredRewardCandidates = latestRewardCandidates.filter((candidate) =>
      !governanceCandidateTxHashes.has(candidate.txHash.toLowerCase()),
    );

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

    const resolvedClaims = filteredRewardCandidates.map((candidate, index) => {
      const resolution = resolveRewardClaimTarget({
        candidate,
        depositTargets,
        strategyTargets,
      });

      return {
        txHash: candidate.txHash,
        logIndex: index,
        rewardType: inferRewardType(candidate),
        depositOrStrategyId: resolution.depositOrStrategyId,
        occurredAt: candidate.occurredAt,
        category: candidate.category,
        summary: candidate.summary,
        protocol: candidate.protocol,
        targetType: resolution.targetType,
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