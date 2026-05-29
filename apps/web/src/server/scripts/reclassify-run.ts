import "dotenv/config";
import { type WalletTokenSnapshot } from "@/server/analysis/computeSnapshots";
import { reclassifyAnalysisRun } from "@/server/analysis/reclassify-run";
import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";

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
    const tokens = parseWalletTokenSnapshots((row.responseJson ?? {}).tokens);
    if (tokens.length > 0) {
      return tokens;
    }
  }

  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const regenerate = args.includes("--regenerate");
  const runId = process.env.RUN_ID ?? args.find((arg) => !arg.startsWith("--"));
  if (!runId) {
    console.error("usage: RUN_ID=<runId> tsx reclassify-run.ts [--regenerate]");
    process.exit(1);
  }

  const run = await getAnalysisRunById(runId);
  if (!run) {
    throw new Error(`run not found: ${runId}`);
  }

  let walletTokens = parseWalletTokenSnapshots(run.metadataJson.latestWalletTokens);
  if (walletTokens.length === 0) {
    walletTokens = await loadFallbackWalletTokenSignals({
      walletAddress: run.walletAddress,
      chainId: run.chainId,
      runId,
    });
  }

  const result = await reclassifyAnalysisRun({
    runId,
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    capturedAt: new Date(),
    walletTokens,
    regenerateCandidates: regenerate,
  });

  console.log(JSON.stringify({
    runId,
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    txCount: result.txCount,
    walletTokens: result.walletTokenCount,
    regeneratedRewardCandidateCount: result.regeneratedRewardCandidateCount,
    rewardResolution: result.rewardResolution,
    classified: result.classified,
    canonical: result.canonical,
    totalValueUsd: result.snapshot.totalValueUsd,
    poolReadModels: result.poolReadModels,
    depositReadModels: result.depositReadModels,
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
