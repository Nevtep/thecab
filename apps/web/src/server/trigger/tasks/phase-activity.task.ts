import { and, desc, eq } from "drizzle-orm";
import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { listRunSlices } from "@/server/analysis/analysis-slice.repository";
import { runCanonicalInference } from "@/server/analysis/canonicalInference";
import { classifyRunLedgerEvents } from "@/server/analysis/enginePersistence";
import { getDb } from "@/server/db/client";
import { processedTxs, rawProviderRecords } from "@/server/db/schema";

export type PhaseActivityTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

type WalletTokenSignal = {
  tokenAddress: string;
  possibleSpam: boolean;
  verifiedContract: boolean;
  usdPrice: number | null;
  usdValue: number | null;
};

function parseWalletTokenSignals(value: unknown): WalletTokenSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      tokenAddress: String(item.tokenAddress ?? item.token_address ?? "").toLowerCase(),
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
    .filter((item) => item.tokenAddress.length > 0);
}

async function loadFallbackWalletTokenSignals(input: {
  walletAddress: string;
  chainId: number;
  runId: string;
}) {
  const db = getDb();
  const rows = await db
    .select({
      runId: rawProviderRecords.runId,
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
    const signals = parseWalletTokenSignals((row.responseJson ?? {}).tokens);
    if (signals.length > 0) {
      return signals;
    }
  }

  return [];
}

export const phaseActivityTask = task({
  id: "phase-activity",
  run: async (payload: PhaseActivityTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.status === "cancelled") {
      return { classifiedCount: 0 };
    }

    const slices = await listRunSlices(payload.runId);
    const db = getDb();
    const txRows = slices.length === 0
      ? []
      : await db
        .select({ txHash: processedTxs.txHash })
        .from(processedTxs)
        .where(and(eq(processedTxs.firstRunId, payload.runId)));

    let walletTokenSignals = parseWalletTokenSignals(run.metadataJson.latestWalletTokens);
    if (walletTokenSignals.length === 0) {
      walletTokenSignals = await loadFallbackWalletTokenSignals({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        runId: payload.runId,
      });
    }
    const spamTokenAddresses = walletTokenSignals
      .filter((item) => item.possibleSpam || item.verifiedContract === false)
      .map((item) => item.tokenAddress);

    const classifiedCount = await classifyRunLedgerEvents({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes: txRows.map((row) => row.txHash),
      runId: payload.runId,
      spamTokenAddresses,
      walletTokenSignals,
    });

    const inference = await runCanonicalInference({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes: txRows.map((row) => row.txHash),
      runId: payload.runId,
    });

    return {
      classifiedCount,
      sourceLotCount: inference.sourceLotCount,
      residualStateCount: inference.residualStateCount,
      inferredActionCount: inference.inferredActionCount,
    };
  },
});