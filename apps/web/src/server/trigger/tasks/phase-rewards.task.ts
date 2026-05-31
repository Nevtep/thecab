import { task } from "@trigger.dev/sdk/v3";

import { mapRewardResolutionReasonCodesToCoverageReasons } from "@/server/analysis/coverage";
import {
  resolveRewardOwnership,
  type RewardCandidateInput,
  type RewardDepositTarget,
  type RewardStrategyTarget,
} from "@/server/analysis/rewardResolution";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getAnalysisSlice } from "@/server/analysis/analysis-slice.repository";
import { persistResolvedRewardEvents } from "@/server/analysis/enginePersistence";
import { parseSurfaceKind } from "@/server/analysis/txClassification";
import { getDb } from "@/server/db/client";
import { deposits, ledgerEvents, pools, rawProviderRecords, strategies, strategyExposures } from "@/server/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

function asRewardCandidate(value: unknown): RewardCandidateInput | null {
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
    targetStakingRewardsAddress: typeof candidate.targetStakingRewardsAddress === "string"
      ? candidate.targetStakingRewardsAddress.toLowerCase()
      : null,
    targetPoolAddress: typeof candidate.targetPoolAddress === "string"
      ? candidate.targetPoolAddress.toLowerCase()
      : null,
    sameTxTokenId: typeof candidate.sameTxTokenId === "string" ? candidate.sameTxTokenId : null,
    shareLifecycleWrapperAddress: typeof candidate.shareLifecycleWrapperAddress === "string"
      ? candidate.shareLifecycleWrapperAddress.toLowerCase()
      : null,
    targetWrapperAddress: typeof candidate.targetWrapperAddress === "string"
      ? candidate.targetWrapperAddress.toLowerCase()
      : null,
    surfaceKind: parseSurfaceKind(candidate.surfaceKind),
    componentKey: typeof candidate.componentKey === "string" ? candidate.componentKey : null,
    economicComponentKind: typeof candidate.economicComponentKind === "string"
      ? candidate.economicComponentKind
      : null,
    movementLogIndexes: Array.isArray(candidate.movementLogIndexes)
      ? candidate.movementLogIndexes.filter((value): value is number => typeof value === "number")
      : [],
  };
}

function inferRewardType(candidate: RewardCandidateInput) {
  if (candidate.economicComponentKind === "fee_claim" || candidate.surfaceKind?.startsWith("pool_fee_claim")) {
    return "fee_claim";
  }
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

export function isExcludedAirdropRewardLedgerRow(input: {
  classification: string | null;
  metadataJson: Record<string, unknown>;
}) {
  return input.classification === "airdrop" || input.metadataJson.economicExclusionReason === "airdrop_spam";
}

export function resolveRewardClaimTarget(input: {
  candidate: RewardCandidateInput;
  depositTargets: RewardDepositTarget[];
  strategyTargets: RewardStrategyTarget[];
}) {
  const resolution = resolveRewardOwnership(input);
  return {
    depositOrStrategyId: resolution.depositId ?? resolution.strategyId,
    strategyExposureId: resolution.strategyExposureId,
    resolvedPoolId: resolution.resolvedPoolId,
    targetType: resolution.ownerType ?? input.candidate.targetType,
    resolutionBasis: resolution.resolutionBasis,
    resolutionReasonCodes: resolution.resolutionReasonCodes,
    resolutionStatus: resolution.resolutionStatus,
    feeAttributionBasis: resolution.feeAttributionBasis ?? null,
    externalStrategyPositionReference: resolution.externalStrategyPositionReference,
    externalStrategyPositionReferenceStatus: resolution.externalStrategyPositionReferenceStatus,
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
    const [rows, depositRows, strategyRows, poolRows] = await Promise.all([
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
          depositId: deposits.id,
          poolId: deposits.poolId,
          tokenId: deposits.tokenId,
          createdAt: deposits.createdAt,
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
          strategyId: strategies.id,
          strategyExposureId: strategyExposures.id,
          wrapperAddress: strategyExposures.wrapperAddress,
          stakingRewardsAddress: strategies.stakingRewardsAddress,
          protocol: strategies.protocol,
          primaryPoolId: strategies.primaryPoolId,
          createdAt: strategyExposures.createdAt,
          metadataJson: strategyExposures.metadataJson,
        })
        .from(strategyExposures)
        .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
        .where(
          and(
            eq(strategyExposures.walletAddress, payload.walletAddress.toLowerCase()),
            eq(strategyExposures.chainId, payload.chainId),
          ),
        ),
      db
        .select({
          poolId: pools.id,
          poolAddress: pools.poolAddress,
        })
        .from(pools)
        .where(eq(pools.chainId, payload.chainId)),
    ]);

    const latestRewardCandidates = Array.isArray(run.metadataJson.latestRewardCandidates)
      ? run.metadataJson.latestRewardCandidates.map(asRewardCandidate).filter((candidate): candidate is RewardCandidateInput => Boolean(candidate))
      : Array.isArray(rows[0]?.responseJson.rewardCandidates)
        ? rows[0]?.responseJson.rewardCandidates.map(asRewardCandidate).filter((candidate): candidate is RewardCandidateInput => Boolean(candidate))
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
    const excludedAirdropTxHashes = new Set(
      ledgerRows
        .filter((row) => isExcludedAirdropRewardLedgerRow({
          classification: row.classification,
          metadataJson: row.metadataJson,
        }))
        .map((row) => row.txHash.toLowerCase()),
    );
    const depositTargets = depositRows.map((row) => ({
      depositId: row.depositId,
      poolId: row.poolId,
      tokenId: row.tokenId,
      protocol: typeof row.protocol.protocol === "string" ? row.protocol.protocol : "aerodrome",
      createdAt: row.createdAt,
    }));
    const poolIdByAddress = new Map(poolRows.map((row) => [row.poolAddress.toLowerCase(), row.poolId] as const));
    const strategyTargets = strategyRows.map((row) => ({
      strategyId: row.strategyId,
      strategyExposureId: row.strategyExposureId,
      primaryPoolId: row.primaryPoolId,
      wrapperAddress: row.wrapperAddress.toLowerCase(),
      stakingRewardsAddress: row.stakingRewardsAddress?.toLowerCase() ?? null,
      protocol: row.protocol,
      externalStrategyPositionReference:
        typeof row.metadataJson.externalDepositReference === "string" ? row.metadataJson.externalDepositReference : null,
      createdAt: row.createdAt,
    }));

    const resolvedClaims = latestRewardCandidates.map((candidate, index) => {
      const governanceCandidate = governanceCandidateTxHashes.has(candidate.txHash.toLowerCase());
      const excludedAirdropCandidate = excludedAirdropTxHashes.has(candidate.txHash.toLowerCase());
      const candidateWithGovernanceSurface = governanceCandidate
        ? { ...candidate, surfaceKind: "governance_voter_claim" as const, economicComponentKind: candidate.economicComponentKind ?? "reward_claim" }
        : candidate;
      const candidateWithPool = candidate.targetPoolAddress && !candidate.targetPoolId
        ? { ...candidateWithGovernanceSurface, targetPoolId: poolIdByAddress.get(candidate.targetPoolAddress) ?? null }
        : candidateWithGovernanceSurface;
      const resolution = resolveRewardClaimTarget({
        candidate: candidateWithPool,
        depositTargets,
        strategyTargets,
      });
      const resolvedTarget = excludedAirdropCandidate
        ? {
            depositOrStrategyId: null,
            strategyExposureId: null,
            resolvedPoolId: null,
            targetType: candidateWithPool.targetType,
            resolutionBasis: "excluded_airdrop_spam",
            resolutionReasonCodes: ["excludedAirdrop", "airdrop_spam"],
            resolutionStatus: "excluded" as const,
          }
        : resolution;

      return {
        txHash: candidateWithPool.txHash,
        logIndex: index,
        rewardType: excludedAirdropCandidate ? "excluded_airdrop" : governanceCandidate ? "governance_reward" : inferRewardType(candidateWithPool),
        depositOrStrategyId: resolvedTarget.depositOrStrategyId,
        strategyExposureId: resolvedTarget.strategyExposureId,
        resolvedPoolId: resolvedTarget.resolvedPoolId,
        occurredAt: candidateWithPool.occurredAt,
        resolutionBasis: resolvedTarget.resolutionBasis,
        category: candidateWithPool.category,
        summary: candidateWithPool.summary,
        protocol: candidateWithPool.protocol,
        targetType: resolvedTarget.targetType,
        resolutionReasonCodes: resolvedTarget.resolutionReasonCodes,
        resolutionStatus: resolvedTarget.resolutionStatus,
        targetTokenId: candidateWithPool.targetTokenId,
        targetWrapperAddress: candidateWithPool.targetWrapperAddress,
        surfaceKind: excludedAirdropCandidate ? "airdrop_spam" : candidateWithPool.surfaceKind,
        componentKey: candidateWithPool.componentKey,
        economicComponentKind: candidateWithPool.economicComponentKind,
        movementLogIndexes: candidateWithPool.movementLogIndexes,
        feeAttributionBasis: excludedAirdropCandidate ? null : resolution.feeAttributionBasis,
        externalStrategyPositionReference: excludedAirdropCandidate ? null : resolution.externalStrategyPositionReference,
        externalStrategyPositionReferenceStatus: excludedAirdropCandidate ? "unresolved" as const : resolution.externalStrategyPositionReferenceStatus,
      };
    });

    const unresolvedCoverageReasons = mapRewardResolutionReasonCodesToCoverageReasons(
      resolvedClaims.flatMap((claim) => claim.resolutionReasonCodes ?? []),
    );
    const accrualSnapshots = [
      ...depositTargets.map((target) => ({
        depositOrStrategyId: target.depositId,
        resolvedPoolId: target.poolId,
        rewardType: "reward_accrual_snapshot",
        protocol: target.protocol,
        targetType: "deposit" as const,
        resolutionBasis: target.tokenId ? "explicit_token_id" : "unresolved",
        resolutionReasonCodes: target.tokenId ? [] : ["missingTokenId"],
        targetTokenId: target.tokenId,
      })),
      ...strategyTargets.map((target) => ({
        depositOrStrategyId: target.strategyId,
        strategyExposureId: target.strategyExposureId,
        resolvedPoolId: target.primaryPoolId,
        rewardType: "reward_accrual_snapshot",
        protocol: target.protocol,
        targetType: "strategy" as const,
        resolutionBasis: "strategy_wrapper_pair",
        resolutionReasonCodes: [] as string[],
        targetWrapperAddress: target.wrapperAddress,
        externalStrategyPositionReference: target.externalStrategyPositionReference,
        externalStrategyPositionReferenceStatus: target.externalStrategyPositionReference
          ? ("resolved" as const)
          : ("unresolved" as const),
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
      coverageReasons:
        rows.length === 0
          ? ["partialDecoded"]
          : unresolvedCoverageReasons,
    };
  },
});
