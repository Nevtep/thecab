import { task } from "@trigger.dev/sdk/v3";
import { and, desc, eq } from "drizzle-orm";

import {
  finalizeAnalysisRun,
  getAnalysisRunById,
  mergeAnalysisRunMetadata,
  readRunSliceCoverage,
} from "@/server/analysis/analysis-run.repository";
import { type WalletTokenSnapshot } from "@/server/analysis/computeSnapshots";
import { reclassifyAnalysisRun } from "@/server/analysis/reclassify-run";
import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";
import { upsertProcessingCursor } from "@/server/analysis/processing-cursor.repository";
import { upsertOverviewFreshness } from "@/server/overview/overview.repository";

export type PhaseFinalizeTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

function parseWalletTokenSnapshots(value: unknown): WalletTokenSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      tokenAddress: String(item.tokenAddress ?? item.token_address ?? "").toLowerCase(),
      balanceRaw: String(item.balanceRaw ?? item.balance ?? "0"),
      decimals: typeof item.decimals === "number"
        ? item.decimals
        : typeof item.decimals === "string"
          ? Number(item.decimals)
          : null,
      symbol: typeof item.symbol === "string" ? item.symbol : null,
      name: typeof item.name === "string" ? item.name : null,
      nativeToken: item.nativeToken === true || item.native_token === true,
      possibleSpam: item.possibleSpam === true || item.possible_spam === true,
      verifiedContract: item.verifiedContract === true || item.verified_contract === true,
      usdPrice: typeof item.usdPrice === "number"
        ? item.usdPrice
        : typeof item.usd_price === "number"
          ? item.usd_price
          : typeof item.usdPrice === "string" && item.usdPrice.trim().length > 0
            ? Number(item.usdPrice)
            : typeof item.usd_price === "string" && item.usd_price.trim().length > 0
              ? Number(item.usd_price)
              : null,
      usdValue: typeof item.usdValue === "number"
        ? item.usdValue
        : typeof item.usd_value === "number"
          ? item.usd_value
          : typeof item.usdValue === "string" && item.usdValue.trim().length > 0
            ? Number(item.usdValue)
            : typeof item.usd_value === "string" && item.usd_value.trim().length > 0
              ? Number(item.usd_value)
              : null,
    }))
    .filter((token) => token.tokenAddress.length > 0);
}

async function loadFallbackWalletTokens(input: {
  walletAddress: string;
  chainId: number;
  runId: string;
}) {
  const db = getDb();
  const rows = await db
    .select({
      runId: rawProviderRecords.runId,
      fetchedAt: rawProviderRecords.fetchedAt,
      responseJson: rawProviderRecords.responseJson,
    })
    .from(rawProviderRecords)
    .where(
      and(
        eq(rawProviderRecords.provider, "moralis"),
        eq(rawProviderRecords.endpoint, "/wallets/:walletAddress/tokens"),
        eq(rawProviderRecords.chainId, input.chainId),
        eq(rawProviderRecords.walletAddress, input.walletAddress.toLowerCase()),
      ),
    )
    .orderBy(desc(rawProviderRecords.fetchedAt), desc(rawProviderRecords.createdAt))
    .limit(20);

  const preferredRows = [
    ...rows.filter((row) => row.runId === input.runId),
    ...rows.filter((row) => row.runId !== input.runId),
  ];

  for (const row of preferredRows) {
    const tokens = parseWalletTokenSnapshots((row.responseJson ?? {}).tokens);
    if (tokens.length > 0) {
      return {
        walletTokens: tokens,
        fetchedAt: row.fetchedAt,
      };
    }
  }

  return null;
}

export const phaseFinalizeTask = task({
  id: "phase-finalize",
  run: async (payload: PhaseFinalizeTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run) {
      throw new Error(`ANALYSIS_RUN_NOT_FOUND:${payload.runId}`);
    }

    if (run.status === "cancelled") {
      return { cancelled: true };
    }

    const capturedAt = new Date();
    let walletTokens = parseWalletTokenSnapshots(run.metadataJson.latestWalletTokens);

    if (walletTokens.length === 0) {
      const fallback = await loadFallbackWalletTokens({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        runId: payload.runId,
      });

      if (fallback) {
        walletTokens = fallback.walletTokens;
        await mergeAnalysisRunMetadata(payload.runId, {
          latestWalletTokens: fallback.walletTokens,
          latestWalletTokensCapturedAt: fallback.fetchedAt.toISOString(),
          latestWalletTokensRecoveredFrom: "raw_provider_records",
        });
      }
    }

    const reclassification = await reclassifyAnalysisRun({
      runId: payload.runId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      capturedAt,
      walletTokens,
    });
    const sliceCoverage = await readRunSliceCoverage(payload.runId);

    await upsertProcessingCursor({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      lastProcessedDayUtc: run.utcDayBucket,
      lastSuccessfulRunId: payload.runId,
      lastAdvancedAt: capturedAt,
      metadataJson: {
        totalValueUsd: reclassification.snapshot.totalValueUsd,
      },
    });

    await upsertOverviewFreshness({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      lastAnalyzedAt: capturedAt,
      lastSuccessfulRunId: payload.runId,
      metadataJson: {
        coverage: sliceCoverage.coverage,
        coverageReasons: sliceCoverage.coverageReasons,
        totalValueUsd: reclassification.snapshot.totalValueUsd,
      },
    });

    const finalizedRun = await finalizeAnalysisRun({
      runId: payload.runId,
      coverage: sliceCoverage.coverage,
      coverageReasonsJson: sliceCoverage.coverageReasons,
    });

    return {
      runId: payload.runId,
      status: finalizedRun.status,
      coverage: finalizedRun.coverage,
      coverageReasons: finalizedRun.coverageReasonsJson,
      totalValueUsd: reclassification.snapshot.totalValueUsd,
      strategyReadModels: reclassification.strategyReadModels,
      poolReadModels: reclassification.poolReadModels,
    };
  },
});
