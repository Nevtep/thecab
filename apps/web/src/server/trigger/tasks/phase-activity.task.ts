import { performance } from "node:perf_hooks";

import { and, desc, eq } from "drizzle-orm";
import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { listRunSlices } from "@/server/analysis/analysis-slice.repository";
import { runCanonicalInference } from "@/server/analysis/canonicalInference";
import { classifyRunLedgerEvents } from "@/server/analysis/enginePersistence";
import { getDb } from "@/server/db/client";
import { processedTxs, rawProviderRecords } from "@/server/db/schema";
import {
  fetchExplorerTransactionEvidence,
  type ExplorerEvidence,
} from "@/server/providers/explorer";

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

type PhaseActivityPerfEvent = Record<string, unknown> & {
  event: string;
  runId: string;
  chainId: number;
  walletAddress: string;
};

function elapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

function logPhaseActivityPerf(event: PhaseActivityPerfEvent) {
  console.info(JSON.stringify({
    phase: "phase-activity",
    ...event,
  }));
}

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

export function buildSupplementalExplorerEvidenceMetadata(evidence: ExplorerEvidence): Record<string, unknown> {
  return {
    txHash: evidence.txHash,
    provider: evidence.provider,
    sourceRefs: evidence.sourceRefs,
    evidenceGapReasonCodes: evidence.evidenceGapReasonCodes,
    receiptPresent: evidence.receipt !== null,
    logCount: evidence.logs.length,
    internalTransferCount: evidence.internalTransfers.length,
  };
}

async function collectSupplementalExplorerEvidence(input: {
  runId: string;
  walletAddress: string;
  chainId: number;
  txHashes: string[];
}) {
  const startedAt = performance.now();
  logPhaseActivityPerf({
    event: "supplemental_evidence_started",
    runId: input.runId,
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txCount: input.txHashes.length,
  });
  const evidenceByTxHash: Record<string, ExplorerEvidence> = {};
  const slowestTxs: Array<{
    txHash: string;
    totalMs: number;
    fetchMs: number;
    gapReasons: string[];
  }> = [];

  for (const [index, txHash] of input.txHashes.entries()) {
    const txStartedAt = performance.now();
    const fetchStartedAt = performance.now();
    const evidence = await fetchExplorerTransactionEvidence({
      chainId: input.chainId,
      txHash,
    });
    const fetchMs = elapsedMs(fetchStartedAt);
    evidenceByTxHash[txHash.toLowerCase()] = evidence;
    const totalMs = elapsedMs(txStartedAt);
    slowestTxs.push({
      txHash: txHash.toLowerCase(),
      totalMs,
      fetchMs,
      gapReasons: evidence.evidenceGapReasonCodes,
    });
    slowestTxs.sort((left, right) => right.totalMs - left.totalMs);
    slowestTxs.splice(5);

    if (totalMs >= 1_000 || (index + 1) % 25 === 0 || index === input.txHashes.length - 1) {
      logPhaseActivityPerf({
        event: "supplemental_evidence_progress",
        runId: input.runId,
        chainId: input.chainId,
        walletAddress: input.walletAddress.toLowerCase(),
        completedTxCount: index + 1,
        totalTxCount: input.txHashes.length,
        lastTxHash: txHash.toLowerCase(),
        lastTxElapsedMs: totalMs,
        lastFetchMs: fetchMs,
        lastGapReasons: evidence.evidenceGapReasonCodes,
      });
    }
  }
  logPhaseActivityPerf({
    event: "supplemental_evidence_completed",
    runId: input.runId,
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txCount: input.txHashes.length,
    elapsedMs: elapsedMs(startedAt),
    slowestTxs,
  });
  return evidenceByTxHash;
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
    const phaseStartedAt = performance.now();
    const walletAddress = payload.walletAddress.toLowerCase();
    logPhaseActivityPerf({
      event: "started",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
    });

    const loadRunStartedAt = performance.now();
    const run = await getAnalysisRunById(payload.runId);
    logPhaseActivityPerf({
      event: "run_loaded",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(loadRunStartedAt),
      runFound: Boolean(run),
      runStatus: run?.status ?? null,
    });
    if (!run || run.status === "cancelled") {
      logPhaseActivityPerf({
        event: "skipped",
        runId: payload.runId,
        chainId: payload.chainId,
        walletAddress,
        reason: !run ? "run_not_found" : "run_cancelled",
        elapsedMs: elapsedMs(phaseStartedAt),
      });
      return { classifiedCount: 0 };
    }

    const loadSlicesStartedAt = performance.now();
    const slices = await listRunSlices(payload.runId);
    const db = getDb();
    const txRows = slices.length === 0
      ? []
      : await db
        .select({ txHash: processedTxs.txHash })
        .from(processedTxs)
        .where(and(eq(processedTxs.firstRunId, payload.runId)));
    logPhaseActivityPerf({
      event: "tx_scope_loaded",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(loadSlicesStartedAt),
      sliceCount: slices.length,
      txCount: txRows.length,
    });

    const tokenSignalsStartedAt = performance.now();
    let walletTokenSignals = parseWalletTokenSignals(run.metadataJson.latestWalletTokens);
    const tokenSignalSource = walletTokenSignals.length === 0 ? "raw_provider_fallback" : "run_metadata";
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
    logPhaseActivityPerf({
      event: "wallet_token_signals_loaded",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(tokenSignalsStartedAt),
      source: tokenSignalSource,
      signalCount: walletTokenSignals.length,
      spamTokenCount: spamTokenAddresses.length,
    });

    const txHashes = txRows.map((row) => row.txHash);
    const supplementalEvidenceByTxHash = await collectSupplementalExplorerEvidence({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      runId: payload.runId,
      txHashes,
    });

    const classifyStartedAt = performance.now();
    const classifiedCount = await classifyRunLedgerEvents({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes,
      runId: payload.runId,
      supplementalEvidenceByTxHash,
      spamTokenAddresses,
      walletTokenSignals,
    });
    logPhaseActivityPerf({
      event: "classification_completed",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(classifyStartedAt),
      classifiedCount,
      txCount: txHashes.length,
      supplementalEvidenceCount: Object.keys(supplementalEvidenceByTxHash).length,
    });

    const inferenceStartedAt = performance.now();
    const inference = await runCanonicalInference({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes,
      runId: payload.runId,
    });
    logPhaseActivityPerf({
      event: "canonical_inference_completed",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(inferenceStartedAt),
      sourceLotCount: inference.sourceLotCount,
      residualStateCount: inference.residualStateCount,
      inferredActionCount: inference.inferredActionCount,
    });

    logPhaseActivityPerf({
      event: "completed",
      runId: payload.runId,
      chainId: payload.chainId,
      walletAddress,
      elapsedMs: elapsedMs(phaseStartedAt),
      classifiedCount,
      txCount: txHashes.length,
      sourceLotCount: inference.sourceLotCount,
      residualStateCount: inference.residualStateCount,
      inferredActionCount: inference.inferredActionCount,
    });

    return {
      classifiedCount,
      sourceLotCount: inference.sourceLotCount,
      residualStateCount: inference.residualStateCount,
      inferredActionCount: inference.inferredActionCount,
    };
  },
});
