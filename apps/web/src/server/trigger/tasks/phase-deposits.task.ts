import { task } from "@trigger.dev/sdk/v3";

import {
  getAnalysisRunById,
  mergeAnalysisRunMetadata,
} from "@/server/analysis/analysis-run.repository";
import { getAnalysisSlice } from "@/server/analysis/analysis-slice.repository";
import {
  persistProtocolPositions,
  persistRawProviderSnapshots,
  persistSliceHistory,
} from "@/server/analysis/enginePersistence";
import { listSoftReorgProcessedTxs } from "@/server/analysis/processed-tx.repository";
import { getEnv } from "@/server/env";
import { alchemyRpc, getAlchemyCoverageReason } from "@/server/providers/alchemy";
import { decodeAerodromeDepositLifecycle } from "@/server/protocols/aerodrome/decodeDepositLifecycle";
import { computeMellowShareLevelAccounting } from "@/server/protocols/mellow/computeShareLevelAccounting";
import { detectProtocolPositions } from "@/server/protocol-positions/detectProtocolPositions";
import { readKnownProtocolContracts } from "@/server/overview/overview.repository";
import { getWalletDefiPositions, getWalletHistory, getWalletTokens, getMoralisCoverageReason } from "@/server/providers/moralis";
import { buildAnalysisProviderFailureError } from "@/server/providers/providerErrors";
import { CANDIDATE_SCHEMA_VERSION } from "@/server/analysis/txClassification";

export type PhaseDepositsTaskPayload = {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
};

type WalletHistoryPageResponse = {
  result?: unknown;
  cursor?: string | null;
};

export type SliceHistoryLoadResult = {
  records: Array<Record<string, unknown>>;
  paginationTruncated: boolean;
};

type PersistedRewardCandidate = {
  txHash: string;
  occurredAt: Date;
  category: string | null;
  summary: string | null;
  protocol?: string | null;
  targetType?: "deposit" | "strategy" | null;
  targetTokenId?: string | null;
  targetWrapperAddress?: string | null;
  targetStakingRewardsAddress?: string | null;
  sameTxTokenId?: string | null;
  shareLifecycleWrapperAddress?: string | null;
  /**
   * On-chain surface this candidate originated from. Drives ownership
   * resolution branching in phase-rewards. See
   * docs/spec/the-cab-aerodrome-claim-surfaces-research.md.
   */
  surfaceKind?: import("@/server/analysis/txClassification").SurfaceKind | null;
  /**
   * Stamped so reclassify can detect stale candidate shapes and regenerate
   * them from history. See txClassification.CANDIDATE_SCHEMA_VERSION.
   */
  candidateSchemaVersion?: number;
};

function resolveHistoryWindowDurationMs(sliceStartUtc: Date, sliceEndUtc: Date) {
  return Math.max(0, sliceEndUtc.getTime() - sliceStartUtc.getTime());
}

function splitHistoryWindow(sliceStartUtc: Date, sliceEndUtc: Date) {
  const midpointMs = sliceStartUtc.getTime() + Math.floor((sliceEndUtc.getTime() - sliceStartUtc.getTime()) / 2);
  const midpoint = new Date(midpointMs);

  if (midpoint.getTime() <= sliceStartUtc.getTime() || midpoint.getTime() >= sliceEndUtc.getTime()) {
    return null;
  }

  return {
    left: {
      sliceStartUtc,
      sliceEndUtc: midpoint,
    },
    right: {
      sliceStartUtc: midpoint,
      sliceEndUtc,
    },
  };
}

const MORALIS_HISTORY_PAGE_LIMIT = 100;
const MORALIS_HISTORY_MAX_PAGES_PER_SLICE = 20;

function toLatestWalletTokenSnapshot(token: Record<string, unknown>) {
  const tokenAddress = typeof token.token_address === "string"
    ? token.token_address.toLowerCase()
    : typeof token.tokenAddress === "string"
      ? token.tokenAddress.toLowerCase()
      : null;
  const balanceRaw = typeof token.balance === "string"
    ? token.balance
    : typeof token.balanceRaw === "string"
      ? token.balanceRaw
      : null;
  const decimals = typeof token.decimals === "number"
    ? token.decimals
    : typeof token.decimals === "string"
      ? Number(token.decimals)
      : null;

  if (!tokenAddress || !balanceRaw) {
    return null;
  }

  return {
    tokenAddress,
    balanceRaw,
    decimals: Number.isFinite(decimals) ? decimals : null,
    symbol: typeof token.symbol === "string" ? token.symbol : null,
    name: typeof token.name === "string" ? token.name : null,
    nativeToken: token.native_token === true || token.nativeToken === true,
    possibleSpam: token.possible_spam === true || token.possibleSpam === true,
    verifiedContract: token.verified_contract === true || token.verifiedContract === true,
    usdPrice: typeof token.usd_price === "number"
      ? token.usd_price
      : typeof token.usd_price === "string" && token.usd_price.trim().length > 0
        ? Number(token.usd_price)
        : typeof token.usdPrice === "number"
          ? token.usdPrice
          : null,
    usdValue: typeof token.usd_value === "number"
      ? token.usd_value
      : typeof token.usd_value === "string" && token.usd_value.trim().length > 0
        ? Number(token.usd_value)
        : typeof token.usdValue === "number"
          ? token.usdValue
          : null,
  };
}

export function normalizeAerodromeLifecycleForPersistence(input: {
  lifecycle: Awaited<ReturnType<typeof decodeAerodromeDepositLifecycle>>["lifecycle"];
  rewardCandidatesByHash: Map<string, { targetTokenId?: string | null }>;
}) {
  return input.lifecycle.map((record) => {
    if (record.action !== "collect" || record.tokenId) {
      return record;
    }

    const resolvedTokenId = input.rewardCandidatesByHash.get(record.txHash.toLowerCase())?.targetTokenId ?? null;
    return resolvedTokenId ? { ...record, tokenId: resolvedTokenId } : record;
  });
}

function scoreProtocolRowForPersistence(row: Awaited<ReturnType<typeof detectProtocolPositions>>["block"]["rows"][number]) {
  const metadata = row.metadata ?? {};
  let score = 0;

  if (row.valueStatus === "current") score += 8;
  if (row.valueUsd !== null) score += 4;
  if (row.coverageStatus === "full") score += 3;
  if (row.coverageStatus === "partial") score += 1;

  for (const value of [
    row.primaryTokenSymbol,
    row.secondaryTokenSymbol,
    row.poolLabel,
    metadata.poolAddress,
    metadata.feeTierLabel,
    metadata.rangeLowerTick,
    metadata.rangeUpperTick,
    metadata.currentTick,
    metadata.isInRange,
    metadata.rangeLowerPrice,
    metadata.rangeUpperPrice,
    metadata.rangeQuoteTokenSymbol,
    metadata.rangeDisplayFractionDigits,
  ]) {
    if (value !== null && value !== undefined) {
      score += 1;
    }
  }

  return score;
}

export function mergeProtocolRowsForPersistence(input: {
  baseRows: Awaited<ReturnType<typeof detectProtocolPositions>>["block"]["rows"];
  supplementalRows: Array<Awaited<ReturnType<typeof detectProtocolPositions>>["block"]["rows"]>;
}) {
  const rowsByKey = new Map(input.baseRows.map((row) => [row.positionKey, row] as const));

  for (const supplementalGroup of input.supplementalRows) {
    for (const row of supplementalGroup) {
      const existing = rowsByKey.get(row.positionKey) ?? null;
      if (!existing) {
        rowsByKey.set(row.positionKey, row);
        continue;
      }

      const existingScore = scoreProtocolRowForPersistence(existing);
      const candidateScore = scoreProtocolRowForPersistence(row);
      if (candidateScore > existingScore) {
        rowsByKey.set(row.positionKey, row);
      }
    }
  }

  return Array.from(rowsByKey.values());
}

export async function collectSliceHistoryPages(input: {
  walletAddress: string;
  chainId: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  fetchPage: (args: {
    walletAddress: string;
    chainId: number;
    cursor?: string;
    fromDate: string;
    toDate: string;
    limit: number;
  }) => Promise<WalletHistoryPageResponse>;
}): Promise<SliceHistoryLoadResult> {
  const records: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  let paginationTruncated = false;

  for (let pageIndex = 0; pageIndex < MORALIS_HISTORY_MAX_PAGES_PER_SLICE; pageIndex += 1) {
    const response = await input.fetchPage({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      limit: MORALIS_HISTORY_PAGE_LIMIT,
      cursor,
      fromDate: input.sliceStartUtc.toISOString(),
      toDate: input.sliceEndUtc.toISOString(),
    });

    const pageRecords = Array.isArray(response.result) ? response.result : [];
    records.push(...pageRecords);

    if (pageRecords.length < MORALIS_HISTORY_PAGE_LIMIT || typeof response.cursor !== "string" || response.cursor.length === 0) {
      break;
    }

    if (pageIndex === MORALIS_HISTORY_MAX_PAGES_PER_SLICE - 1) {
      paginationTruncated = true;
      break;
    }

    cursor = response.cursor;
  }

  return {
    records,
    paginationTruncated,
  };
}

export async function loadSliceHistoryWithAdaptiveSplitting(input: {
  walletAddress: string;
  chainId: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  fetchPage: (args: {
    walletAddress: string;
    chainId: number;
    cursor?: string;
    fromDate: string;
    toDate: string;
    limit: number;
  }) => Promise<WalletHistoryPageResponse>;
  minimumWindowMs?: number;
}): Promise<SliceHistoryLoadResult> {
  const minimumWindowMs = input.minimumWindowMs ?? getEnv().ANALYSIS_MIN_HISTORY_WINDOW_HOURS * 60 * 60 * 1000;
  const initialLoad = await collectSliceHistoryPages(input);

  if (!initialLoad.paginationTruncated) {
    return initialLoad;
  }

  if (resolveHistoryWindowDurationMs(input.sliceStartUtc, input.sliceEndUtc) <= minimumWindowMs) {
    return initialLoad;
  }

  const splitWindow = splitHistoryWindow(input.sliceStartUtc, input.sliceEndUtc);
  if (!splitWindow) {
    return initialLoad;
  }

  const [leftLoad, rightLoad] = await Promise.all([
    loadSliceHistoryWithAdaptiveSplitting({
      ...input,
      sliceStartUtc: splitWindow.left.sliceStartUtc,
      sliceEndUtc: splitWindow.left.sliceEndUtc,
      minimumWindowMs,
    }),
    loadSliceHistoryWithAdaptiveSplitting({
      ...input,
      sliceStartUtc: splitWindow.right.sliceStartUtc,
      sliceEndUtc: splitWindow.right.sliceEndUtc,
      minimumWindowMs,
    }),
  ]);

  return {
    records: [...leftLoad.records, ...rightLoad.records],
    paginationTruncated: leftLoad.paginationTruncated || rightLoad.paginationTruncated,
  };
}

async function loadSliceHistory(
  walletAddress: string,
  chainId: number,
  sliceStartUtc: Date,
  sliceEndUtc: Date,
) {
  return loadSliceHistoryWithAdaptiveSplitting({
    walletAddress,
    chainId,
    sliceStartUtc,
    sliceEndUtc,
    fetchPage: ({ walletAddress: nextWalletAddress, chainId: nextChainId, ...params }) =>
      getWalletHistory(nextWalletAddress, nextChainId, params),
  });
}

export async function runPhaseDepositsTask(payload: PhaseDepositsTaskPayload) {
    const [run, slice] = await Promise.all([
      getAnalysisRunById(payload.runId),
      getAnalysisSlice(payload.sliceId),
    ]);
    if (!run || !slice) {
      throw new Error("ANALYSIS_SLICE_CONTEXT_NOT_FOUND");
    }

    if (run.status === "cancelled") {
      return {
        cancelled: true,
        txCountSeen: slice.txCountSeen,
        txCountProcessed: slice.txCountProcessed,
        coverageReasons: [],
      };
    }

    const [tokensResult, historyResult, defiPositionsResult, protocolContracts] = await Promise.all([
      getWalletTokens(payload.walletAddress, payload.chainId)
        .then((value) => ({ ok: true as const, value }))
        .catch((error) => ({ ok: false as const, error, coverageReason: getMoralisCoverageReason(error) })),
      loadSliceHistory(
        payload.walletAddress,
        payload.chainId,
        slice.sliceStartUtc,
        slice.sliceEndUtc,
      )
        .then((value) => ({ ok: true as const, value }))
        .catch((error) => ({ ok: false as const, error, coverageReason: getMoralisCoverageReason(error) })),
      getWalletDefiPositions(payload.walletAddress, payload.chainId)
        .then((value) => ({ ok: true as const, value }))
        .catch((error) => ({ ok: false as const, error, coverageReason: getMoralisCoverageReason(error) })),
      readKnownProtocolContracts({ chainId: payload.chainId }),
    ]);

    if (!tokensResult.ok && !historyResult.ok && !defiPositionsResult.ok) {
      throw buildAnalysisProviderFailureError([
        tokensResult.coverageReason,
        historyResult.coverageReason,
        defiPositionsResult.coverageReason,
      ]);
    }

    const tokens = tokensResult.ok ? (tokensResult.value.result ?? []) : [];
    const history = historyResult.ok ? historyResult.value.records : [];
    const defiPositions = defiPositionsResult.ok ? defiPositionsResult.value : [];
    const coverageReasons = new Set<string>();

    if (!tokensResult.ok) {
      coverageReasons.add(tokensResult.coverageReason);
    }
    if (!historyResult.ok) {
      coverageReasons.add(historyResult.coverageReason);
    } else if (historyResult.value.paginationTruncated) {
      coverageReasons.add("historyPaginationExceeded");
    }
    if (!defiPositionsResult.ok) {
      coverageReasons.add(defiPositionsResult.coverageReason);
    }

    if (historyResult.ok && historyResult.value.paginationTruncated) {
      throw buildAnalysisProviderFailureError(["historyPaginationExceeded"]);
    }

    const now = new Date();
    const softReorgTxHashes = await alchemyRpc<`0x${string}`>("eth_blockNumber", [], { chainId: payload.chainId })
      .then(async (headBlockHex) => {
        const headBlockNumber = BigInt(headBlockHex);
        const minimumBlockNumberExclusive = headBlockNumber > BigInt(getEnv().ANALYSIS_REORG_SOFT_BLOCKS)
          ? (headBlockNumber - BigInt(getEnv().ANALYSIS_REORG_SOFT_BLOCKS)).toString()
          : "0";

        const recentProcessedTxs = await listSoftReorgProcessedTxs({
          chainId: payload.chainId,
          walletAddress: payload.walletAddress,
          minimumBlockNumberExclusive,
        });

        return recentProcessedTxs.map((row) => row.txHash.toLowerCase());
      })
      .catch((error) => {
        coverageReasons.add(getAlchemyCoverageReason(error));
        return [] as string[];
      });

    const [protocolPositions, aerodromeLifecycle, mellowAccounting] = await Promise.all([
      detectProtocolPositions({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        protocolContracts,
        walletTokens: tokens,
        defiPositions,
        history,
        now,
      }),
      decodeAerodromeDepositLifecycle({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        history,
        protocolContracts,
        now,
      }),
      computeMellowShareLevelAccounting({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        walletTokens: tokens,
        history,
        protocolContracts,
        now,
      }),
    ]);

    const mergedProtocolRows = mergeProtocolRowsForPersistence({
      baseRows: protocolPositions.block.rows,
      supplementalRows: [aerodromeLifecycle.rows, mellowAccounting.rows],
    });

    if (protocolPositions.providerPartial || aerodromeLifecycle.providerPartial || mellowAccounting.providerPartial) {
      coverageReasons.add("providerError");
    }
    if (mergedProtocolRows.some((row) => row.valueStatus !== "current")) {
      coverageReasons.add("pricingPartial");
    }

    const rewardCandidatesByHash = new Map<string, PersistedRewardCandidate>();

    for (const candidate of [...aerodromeLifecycle.rewardCandidates, ...mellowAccounting.rewardCandidates]) {
      rewardCandidatesByHash.set(candidate.txHash.toLowerCase(), {
        ...candidate,
        candidateSchemaVersion: CANDIDATE_SCHEMA_VERSION,
      });
    }

    const normalizedAerodromeLifecycle = normalizeAerodromeLifecycleForPersistence({
      lifecycle: aerodromeLifecycle.lifecycle,
      rewardCandidatesByHash,
    });

    const latestWalletTokens = tokens
      .map((token) => toLatestWalletTokenSnapshot(token))
      .filter((token): token is NonNullable<typeof token> => token !== null);

    await persistRawProviderSnapshots({
      runId: payload.runId,
      sliceId: payload.sliceId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      records: [
        {
          provider: "moralis",
          endpoint: "/wallets/:walletAddress/tokens",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: {
            resultCount: tokens.length,
            tokens: latestWalletTokens,
          },
        },
        {
          provider: "moralis",
          endpoint: "/wallets/:walletAddress/history",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId, limit: 200 },
          responseJson: { resultCount: history.length },
        },
        {
          provider: "moralis",
          endpoint: "/wallets/:walletAddress/defi/positions",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: { resultCount: defiPositions.length },
        },
        {
          provider: "analysis-engine",
          endpoint: "/protocol-positions/current-state",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: {
            rowCount: mergedProtocolRows.length,
            source: protocolPositions.block.source,
            coverageStatus: protocolPositions.block.coverageStatus,
          },
        },
        {
          provider: "analysis-engine",
          endpoint: "/protocols/aerodrome/deposit-lifecycle",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: {
            lifecycleCount: aerodromeLifecycle.lifecycle.length,
            failedTokenIds: aerodromeLifecycle.failedTokenIds,
          },
        },
        {
          provider: "analysis-engine",
          endpoint: "/protocols/mellow/share-accounting",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: {
            rowCount: mellowAccounting.rows.length,
            providerPartial: mellowAccounting.providerPartial,
          },
        },
        {
          provider: "analysis-engine",
          endpoint: "/protocols/reward-candidates",
          requestJson: { walletAddress: payload.walletAddress, chainId: payload.chainId },
          responseJson: {
            rewardCandidates: Array.from(rewardCandidatesByHash.values()).map((candidate) => ({
              ...candidate,
              occurredAt: candidate.occurredAt.toISOString(),
            })),
          },
        },
      ],
    });

    const persistedPositions = await persistProtocolPositions({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      positions: mergedProtocolRows,
      manualArtifacts: aerodromeLifecycle.artifacts,
      manualLifecycle: normalizedAerodromeLifecycle,
      mellowArtifacts: mellowAccounting.artifacts,
    });
    const persistedHistory = await persistSliceHistory({
      runId: payload.runId,
      sliceId: payload.sliceId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      sliceStartUtc: slice.sliceStartUtc,
      sliceEndUtc: slice.sliceEndUtc,
      history,
      forceReprocessTxHashes: softReorgTxHashes,
    });

    for (const candidate of persistedHistory.rewardCandidates) {
      const existing = rewardCandidatesByHash.get(candidate.txHash.toLowerCase());
      rewardCandidatesByHash.set(candidate.txHash.toLowerCase(), {
        ...candidate,
        protocol: existing?.protocol ?? null,
        targetType: existing?.targetType ?? null,
        targetTokenId: existing?.targetTokenId ?? null,
        targetWrapperAddress: existing?.targetWrapperAddress ?? null,
        targetStakingRewardsAddress: existing?.targetStakingRewardsAddress ?? null,
        sameTxTokenId: existing?.sameTxTokenId ?? null,
        shareLifecycleWrapperAddress: existing?.shareLifecycleWrapperAddress ?? null,
        surfaceKind: existing?.surfaceKind ?? null,
        candidateSchemaVersion: CANDIDATE_SCHEMA_VERSION,
      });
    }

    const metadataPatch: Record<string, unknown> = {
      latestPoolTotals: persistedPositions.poolTotals,
      latestRewardCandidates: Array.from(rewardCandidatesByHash.values()),
    };

    if (tokensResult.ok) {
      metadataPatch.latestWalletTokens = latestWalletTokens;
      metadataPatch.latestWalletTokensCapturedAt = now.toISOString();
    }

    await mergeAnalysisRunMetadata(payload.runId, metadataPatch);

    return {
      txCountSeen: persistedHistory.txCountSeen,
      txCountProcessed: persistedHistory.txCountProcessed,
      assetMovementCount: persistedHistory.assetMovementCount,
      softReorgTxCount: softReorgTxHashes.length,
      rewardCandidateCount: rewardCandidatesByHash.size,
      positionCount: mergedProtocolRows.length,
      providerAttempts: {
        moralis: 3,
        alchemyRpc: 1,
        alchemyPrices: mergedProtocolRows.length > 0 ? 1 : 0,
      },
      coverageReasons: Array.from(coverageReasons),
    };
}

export const phaseDepositsTask = task({
  id: "phase-deposits",
  run: async (payload: PhaseDepositsTaskPayload) => runPhaseDepositsTask(payload),
});