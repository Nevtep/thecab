import { and, eq } from "drizzle-orm";
import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { listRunSlices } from "@/server/analysis/analysis-slice.repository";
import { classifyRunLedgerEvents } from "@/server/analysis/enginePersistence";
import { classifyResidualAttribution } from "@/server/protocols/aerodrome/classifyResidualAttribution";
import { getDb } from "@/server/db/client";
import { processedTxs } from "@/server/db/schema";

export type PhaseActivityTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

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

    const classifiedCount = await classifyRunLedgerEvents({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes: txRows.map((row) => row.txHash),
      runId: payload.runId,
    });

    const attribution = await classifyResidualAttribution({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      txHashes: txRows.map((row) => row.txHash),
    });

    return {
      classifiedCount,
      sourceLotCount: attribution.sourceLotCount,
      residualStateCount: attribution.residualStateCount,
    };
  },
});