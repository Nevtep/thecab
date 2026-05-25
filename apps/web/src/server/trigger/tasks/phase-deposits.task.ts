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

export type PhaseDepositsTaskPayload = {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
};

export const phaseDepositsTask = task({
  id: "phase-deposits",
  run: async (payload: PhaseDepositsTaskPayload) => {
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
      getWalletHistory(payload.walletAddress, payload.chainId, {
        limit: 200,
      })
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
    const history = historyResult.ok ? (historyResult.value.result ?? []) : [];
    const defiPositions = defiPositionsResult.ok ? defiPositionsResult.value : [];
    const coverageReasons = new Set<string>();

    if (!tokensResult.ok) {
      coverageReasons.add(tokensResult.coverageReason);
    }
    if (!historyResult.ok) {
      coverageReasons.add(historyResult.coverageReason);
    }
    if (!defiPositionsResult.ok) {
      coverageReasons.add(defiPositionsResult.coverageReason);
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

    const mergedProtocolRows = [
      ...protocolPositions.block.rows.filter((row) => !(
        (row.protocol === "aerodrome" && (row.family === "manual_deposit" || row.family === "staked_lp")) ||
        (row.protocol === "mellow" && row.family === "strategy_exposure")
      )),
      ...aerodromeLifecycle.rows,
      ...mellowAccounting.rows,
    ];

    if (protocolPositions.providerPartial || aerodromeLifecycle.providerPartial || mellowAccounting.providerPartial) {
      coverageReasons.add("providerError");
    }
    if (mergedProtocolRows.some((row) => row.valueStatus !== "current")) {
      coverageReasons.add("pricingPartial");
    }

    const rewardCandidatesByHash = new Map<string, {
      txHash: string;
      occurredAt: Date;
      category: string | null;
      summary: string | null;
      protocol?: string | null;
      targetType?: "deposit" | "strategy" | null;
      targetTokenId?: string | null;
      targetWrapperAddress?: string | null;
    }>();

    for (const candidate of [...aerodromeLifecycle.rewardCandidates, ...mellowAccounting.rewardCandidates]) {
      rewardCandidatesByHash.set(candidate.txHash.toLowerCase(), candidate);
    }

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
          responseJson: { resultCount: tokens.length },
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
      });
    }

    await mergeAnalysisRunMetadata(payload.runId, {
      latestPoolTotals: persistedPositions.poolTotals,
      latestRewardCandidates: Array.from(rewardCandidatesByHash.values()),
    });

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
  },
});