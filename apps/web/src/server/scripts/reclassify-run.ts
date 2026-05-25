import "dotenv/config";
import { classifyRunLedgerEvents } from "@/server/analysis/enginePersistence";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import { processedTxs } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  const runId = process.env.RUN_ID ?? process.argv[2];
  if (!runId) {
    console.error("usage: RUN_ID=<runId> tsx reclassify-run.ts");
    process.exit(1);
  }

  const run = await getAnalysisRunById(runId);
  if (!run) {
    throw new Error(`run not found: ${runId}`);
  }

  // For reclassification we want ALL processed tx for this wallet, not just those tied to this run.
  const db = getDb();
  const txRows = await db
    .select({ txHash: processedTxs.txHash })
    .from(processedTxs)
    .where(and(eq(processedTxs.walletAddress, run.walletAddress), eq(processedTxs.chainId, run.chainId)));

  const walletTokensRaw = Array.isArray(run.metadataJson.latestWalletTokens)
    ? (run.metadataJson.latestWalletTokens as unknown[])
    : [];
  const spamTokenAddresses = walletTokensRaw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => item.possibleSpam === true || item.verifiedContract === false)
    .map((item) => String(item.tokenAddress ?? "").toLowerCase())
    .filter((address) => address.length > 0);

  const updated = await classifyRunLedgerEvents({
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    txHashes: txRows.map((row) => row.txHash),
    runId,
    spamTokenAddresses,
  });

  console.log(JSON.stringify({ runId, walletAddress: run.walletAddress, chainId: run.chainId, txCount: txRows.length, updated, spamTokens: spamTokenAddresses.length }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
