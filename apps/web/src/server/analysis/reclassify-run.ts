import { and, desc, eq, inArray } from "drizzle-orm";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { mergeAnalysisRunMetadata } from "@/server/analysis/analysis-run.repository";
import { listRunSlices, resolveRunSliceDayWindow } from "@/server/analysis/analysis-slice.repository";
import { runCanonicalInference } from "@/server/analysis/canonicalInference";
import { computeSnapshots, type WalletTokenSnapshot } from "@/server/analysis/computeSnapshots";
import {
  classifyRunLedgerEvents,
  persistResolvedRewardEvents,
} from "@/server/analysis/enginePersistence";
import {
  resolveRewardOwnership,
  type RewardCandidateInput,
  type RewardDepositTarget,
  type RewardStrategyTarget,
} from "@/server/analysis/rewardResolution";
import { materializeDepositReadModels } from "@/server/analysis/deposit-read-models";
import { materializePoolReadModels } from "@/server/analysis/pool-read-models";
import { CANDIDATE_SCHEMA_VERSION, parseSurfaceKind } from "@/server/analysis/txClassification";
import { getDb } from "@/server/db/client";
import { getWalletHistory } from "@/server/providers/moralis";
import { readKnownProtocolContracts } from "@/server/overview/overview.repository";
import { decodeAerodromeDepositLifecycle } from "@/server/protocols/aerodrome/decodeDepositLifecycle";
import { computeMellowShareLevelAccounting } from "@/server/protocols/mellow/computeShareLevelAccounting";
import {
  deposits,
  ledgerEvents,
  processedTxs,
  rawProviderRecords,
  strategies,
  strategyExposures,
} from "@/server/db/schema";

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
    targetType:
      candidate.targetType === "deposit" || candidate.targetType === "strategy"
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
    targetWrapperAddress:
      typeof candidate.targetWrapperAddress === "string"
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

function isGovernanceRewardCandidate(input: {
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

function parsePoolTotals(value: unknown): Array<{ poolId: string; valueUsd: number }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is { poolId: unknown; valueUsd: unknown } => typeof item === "object" && item !== null)
    .map((item) => ({
      poolId: String(item.poolId),
      valueUsd: Number(item.valueUsd ?? 0),
    }))
    .filter((item) => item.poolId.length > 0 && Number.isFinite(item.valueUsd));
}

async function rerunRewardResolution(input: {
  runId: string;
  walletAddress: string;
  chainId: number;
  sliceEndUtc: Date;
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const run = await getAnalysisRunById(input.runId);
  if (!run) {
    throw new Error(`ANALYSIS_RUN_NOT_FOUND:${input.runId}`);
  }

  const [rows, depositRows, strategyRows] = await Promise.all([
    db
      .select({ responseJson: rawProviderRecords.responseJson })
      .from(rawProviderRecords)
      .where(
        and(
          eq(rawProviderRecords.runId, input.runId),
          eq(rawProviderRecords.provider, "analysis-engine"),
          eq(rawProviderRecords.endpoint, "/protocols/reward-candidates"),
        ),
      )
      .orderBy(desc(rawProviderRecords.createdAt))
      .limit(1),
    db
      .select({
        id: deposits.id,
        poolId: deposits.poolId,
        tokenId: deposits.tokenId,
        protocol: deposits.metadataJson,
      })
      .from(deposits)
      .where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, input.chainId))),
    db
      .select({
        strategyId: strategies.id,
        strategyExposureId: strategyExposures.id,
        wrapperAddress: strategyExposures.wrapperAddress,
        protocol: strategies.protocol,
        primaryPoolId: strategies.primaryPoolId,
        metadataJson: strategyExposures.metadataJson,
      })
      .from(strategyExposures)
      .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
      .where(
        and(
          eq(strategyExposures.walletAddress, walletAddress),
          eq(strategyExposures.chainId, input.chainId),
        ),
      ),
  ]);

  const latestRewardCandidates = Array.isArray(run.metadataJson.latestRewardCandidates)
    ? run.metadataJson.latestRewardCandidates
      .map(asRewardCandidate)
      .filter((candidate): candidate is RewardCandidateInput => Boolean(candidate))
    : Array.isArray(rows[0]?.responseJson.rewardCandidates)
      ? rows[0]?.responseJson.rewardCandidates
          .map(asRewardCandidate)
        .filter((candidate): candidate is RewardCandidateInput => Boolean(candidate))
      : [];

  const normalizedCandidateTxHashes = [
    ...new Set(latestRewardCandidates.map((candidate) => candidate.txHash.toLowerCase())),
  ];
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
            eq(ledgerEvents.walletAddress, walletAddress),
            eq(ledgerEvents.chainId, input.chainId),
            inArray(ledgerEvents.txHash, normalizedCandidateTxHashes),
          ),
        );

  const governanceCandidateTxHashes = new Set(
    ledgerRows
      .filter((row) =>
        isGovernanceRewardCandidate({
          classification: row.classification,
          category: typeof row.metadataJson.category === "string" ? row.metadataJson.category : null,
          methodLabel: typeof row.metadataJson.methodLabel === "string" ? row.metadataJson.methodLabel : null,
          summary: typeof row.metadataJson.summary === "string" ? row.metadataJson.summary : null,
        }),
      )
      .map((row) => row.txHash.toLowerCase()),
  );

  const filteredRewardCandidates = latestRewardCandidates.filter(
    (candidate) => !governanceCandidateTxHashes.has(candidate.txHash.toLowerCase()),
  );

  const depositTargets: RewardDepositTarget[] = depositRows.map((row) => ({
    depositId: row.id,
    poolId: row.poolId,
    tokenId: row.tokenId,
    protocol: typeof row.protocol.protocol === "string" ? row.protocol.protocol : "aerodrome",
  }));
  const strategyTargets: RewardStrategyTarget[] = strategyRows.map((row) => {
    const metadata = row.metadataJson ?? {};
    return {
      strategyId: row.strategyId,
      strategyExposureId: row.strategyExposureId,
      primaryPoolId: row.primaryPoolId,
      wrapperAddress: row.wrapperAddress.toLowerCase(),
      stakingRewardsAddress:
        typeof metadata.stakingRewardsAddress === "string"
          ? metadata.stakingRewardsAddress.toLowerCase()
          : null,
      protocol: row.protocol,
      externalStrategyPositionReference:
        typeof metadata.externalDepositReference === "string" ? metadata.externalDepositReference : null,
    };
  });

  const resolvedClaims = filteredRewardCandidates.map((candidate, index) => {
    const resolution = resolveRewardOwnership({
      candidate,
      depositTargets,
      strategyTargets,
    });

    return {
      txHash: candidate.txHash,
      logIndex: index,
      rewardType: inferRewardType(candidate),
      depositOrStrategyId: resolution.depositId ?? resolution.strategyId,
      strategyExposureId: resolution.strategyExposureId,
      resolvedPoolId: resolution.resolvedPoolId,
      occurredAt: candidate.occurredAt,
      resolutionBasis: resolution.resolutionBasis,
      resolutionReasonCodes: resolution.resolutionReasonCodes,
      category: candidate.category,
      summary: candidate.summary,
      protocol: candidate.protocol,
      targetType: resolution.ownerType ?? candidate.targetType,
      targetTokenId: candidate.targetTokenId,
      targetWrapperAddress: candidate.targetWrapperAddress,
      externalStrategyPositionReference: resolution.externalStrategyPositionReference,
      externalStrategyPositionReferenceStatus: resolution.externalStrategyPositionReferenceStatus,
    };
  });

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
    walletAddress,
    chainId: input.chainId,
    sliceEndUtc: input.sliceEndUtc,
    claims: resolvedClaims,
    accrualSnapshots,
  });

  return {
    claimCount: persisted.claimCount,
    accrualSnapshotCount: persisted.accrualSnapshotCount,
    unresolvedCandidateCount: resolvedClaims.filter((claim) => !claim.depositOrStrategyId).length,
  };
}

function candidatesNeedRegeneration(value: unknown) {
  if (!Array.isArray(value)) {
    return true;
  }
  return value.some((candidate) =>
    !candidate ||
    typeof candidate !== "object" ||
    (candidate as Record<string, unknown>).candidateSchemaVersion !== CANDIDATE_SCHEMA_VERSION
  );
}

async function regenerateRewardCandidates(input: {
  runId: string;
  walletAddress: string;
  chainId: number;
  slices: Awaited<ReturnType<typeof listRunSlices>>;
  walletTokens: WalletTokenSnapshot[];
}) {
  const protocolContracts = await readKnownProtocolContracts({ chainId: input.chainId });
  const rewardCandidates = [];
  for (const slice of input.slices) {
    const history: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
      const historyPage = await getWalletHistory(input.walletAddress, input.chainId, {
        fromDate: slice.sliceStartUtc.toISOString(),
        toDate: slice.sliceEndUtc.toISOString(),
        limit: 100,
        cursor,
      });
      const pageRecords = Array.isArray(historyPage.result)
        ? historyPage.result.filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null)
        : [];
      history.push(...pageRecords);
      if (pageRecords.length < 100 || typeof historyPage.cursor !== "string" || historyPage.cursor.length === 0) {
        break;
      }
      cursor = historyPage.cursor;
    }
    const [aerodromeLifecycle, mellowAccounting] = await Promise.all([
      decodeAerodromeDepositLifecycle({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        history,
        protocolContracts,
        now: new Date(),
      }),
      computeMellowShareLevelAccounting({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        walletTokens: input.walletTokens,
        history,
        protocolContracts,
        now: new Date(),
      }),
    ]);
    rewardCandidates.push(
      ...[...aerodromeLifecycle.rewardCandidates, ...mellowAccounting.rewardCandidates].map((candidate) => ({
        ...candidate,
        componentKey: candidate.componentKey ?? `${candidate.txHash.toLowerCase()}:${candidate.economicComponentKind ?? "reward_claim"}`,
        occurredAt: candidate.occurredAt.toISOString(),
        candidateSchemaVersion: CANDIDATE_SCHEMA_VERSION,
      })),
    );
  }

  await mergeAnalysisRunMetadata(input.runId, {
    latestRewardCandidates: rewardCandidates,
    latestRewardCandidateSchemaVersion: CANDIDATE_SCHEMA_VERSION,
  });

  return rewardCandidates.length;
}

export async function reclassifyAnalysisRun(input: {
  runId: string;
  walletAddress: string;
  chainId: number;
  capturedAt: Date;
  walletTokens: WalletTokenSnapshot[];
  regenerateCandidates?: boolean;
}) {
  const run = await getAnalysisRunById(input.runId);
  if (!run) {
    throw new Error(`ANALYSIS_RUN_NOT_FOUND:${input.runId}`);
  }

  const slices = await listRunSlices(input.runId);
  const sliceDayWindow = resolveRunSliceDayWindow(slices, run.utcDayBucket);
  const latestSliceEndUtc =
    slices.length > 0 ? slices[slices.length - 1]?.sliceEndUtc ?? input.capturedAt : input.capturedAt;

  const db = getDb();
  const txRows = await db
    .select({ txHash: processedTxs.txHash })
    .from(processedTxs)
    .where(and(eq(processedTxs.walletAddress, input.walletAddress), eq(processedTxs.chainId, input.chainId)));

  const spamTokenAddresses = input.walletTokens
    .filter((item) => item.possibleSpam || item.verifiedContract === false)
    .map((item) => item.tokenAddress.toLowerCase());

  let regeneratedRewardCandidateCount = 0;
  if (
    input.regenerateCandidates ||
    run.metadataJson.latestRewardCandidateSchemaVersion !== CANDIDATE_SCHEMA_VERSION ||
    candidatesNeedRegeneration(run.metadataJson.latestRewardCandidates)
  ) {
    regeneratedRewardCandidateCount = await regenerateRewardCandidates({
      runId: input.runId,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      slices,
      walletTokens: input.walletTokens,
    });
  }

  const rewardResolution = await rerunRewardResolution({
    runId: input.runId,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    sliceEndUtc: latestSliceEndUtc,
  });
  const classified = await classifyRunLedgerEvents({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    txHashes: txRows.map((row) => row.txHash),
    runId: input.runId,
    spamTokenAddresses,
    walletTokenSignals: input.walletTokens.map((token) => ({
      tokenAddress: token.tokenAddress.toLowerCase(),
      possibleSpam: token.possibleSpam,
      verifiedContract: token.verifiedContract,
      usdPrice: token.usdPrice,
      usdValue: token.usdValue,
    })),
  });
  const canonical = await runCanonicalInference({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    txHashes: txRows.map((row) => row.txHash),
    runId: input.runId,
  });
  const snapshot = await computeSnapshots({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    startDayUtc: sliceDayWindow.startDayUtc,
    endDayUtc: sliceDayWindow.endDayUtc,
    capturedAt: input.capturedAt,
    poolTotals: parsePoolTotals(run.metadataJson.latestPoolTotals),
    walletTokens: input.walletTokens,
  });
  const poolReadModels = await materializePoolReadModels({
    runId: input.runId,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    startDayUtc: sliceDayWindow.startDayUtc,
    endDayUtc: sliceDayWindow.endDayUtc,
    capturedAt: input.capturedAt,
  });
  const depositReadModels = await materializeDepositReadModels({
    runId: input.runId,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    startDayUtc: sliceDayWindow.startDayUtc,
    endDayUtc: sliceDayWindow.endDayUtc,
    capturedAt: input.capturedAt,
  });

  return {
    txCount: txRows.length,
    walletTokenCount: input.walletTokens.length,
    rewardResolution,
    regeneratedRewardCandidateCount,
    classified,
    canonical,
    snapshot,
    poolReadModels,
    depositReadModels,
    sliceDayWindow,
  };
}
