import "dotenv/config";
import { classifyRunLedgerEvents } from "@/server/analysis/enginePersistence";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import { processedTxs, rawProviderRecords } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

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

  let walletTokenSignals = parseWalletTokenSignals(run.metadataJson.latestWalletTokens);
  if (walletTokenSignals.length === 0) {
    walletTokenSignals = await loadFallbackWalletTokenSignals({
      walletAddress: run.walletAddress,
      chainId: run.chainId,
      runId,
    });
  }
  const spamTokenAddresses = walletTokenSignals
    .filter((item) => item.possibleSpam || item.verifiedContract === false)
    .map((item) => item.tokenAddress);

  const updated = await classifyRunLedgerEvents({
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    txHashes: txRows.map((row) => row.txHash),
    runId,
    spamTokenAddresses,
    walletTokenSignals,
  });

  console.log(JSON.stringify({ runId, walletAddress: run.walletAddress, chainId: run.chainId, txCount: txRows.length, updated, spamTokens: spamTokenAddresses.length, walletTokens: walletTokenSignals.length }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
