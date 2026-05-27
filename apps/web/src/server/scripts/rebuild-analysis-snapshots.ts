import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, desc, eq } from "drizzle-orm";

import { getAnalysisRunById, mergeAnalysisRunMetadata } from "@/server/analysis/analysis-run.repository";
import { listRunSlices, resolveRunSliceDayWindow } from "@/server/analysis/analysis-slice.repository";
import { computeSnapshots, type WalletTokenSnapshot } from "@/server/analysis/computeSnapshots";
import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";

function loadLocalEnvFile() {
  const envFilePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) {
    return;
  }

  for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();

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
    const walletTokens = parseWalletTokenSnapshots((row.responseJson ?? {}).tokens);
    if (walletTokens.length > 0) {
      return {
        walletTokens,
        fetchedAt: row.fetchedAt,
      };
    }
  }

  return null;
}

async function main() {
  const runId = process.env.RUN_ID ?? process.argv[2];
  if (!runId) {
    throw new Error("usage: RUN_ID=<runId> tsx src/server/scripts/rebuild-analysis-snapshots.ts");
  }

  const run = await getAnalysisRunById(runId);
  if (!run) {
    throw new Error(`run not found: ${runId}`);
  }

  const slices = await listRunSlices(runId);
  let walletTokens = parseWalletTokenSnapshots(run.metadataJson.latestWalletTokens);
  let recoveredFromRaw = false;

  if (walletTokens.length === 0) {
    const fallback = await loadFallbackWalletTokens({
      walletAddress: run.walletAddress,
      chainId: run.chainId,
      runId,
    });

    if (!fallback) {
      throw new Error("unable to recover wallet token snapshot from raw_provider_records");
    }

    walletTokens = fallback.walletTokens;
    recoveredFromRaw = true;
    await mergeAnalysisRunMetadata(runId, {
      latestWalletTokens: fallback.walletTokens,
      latestWalletTokensCapturedAt: fallback.fetchedAt.toISOString(),
      latestWalletTokensRecoveredFrom: "raw_provider_records",
    });
  }

  const sliceDayWindow = resolveRunSliceDayWindow(slices, run.utcDayBucket);
  const snapshot = await computeSnapshots({
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    startDayUtc: sliceDayWindow.startDayUtc,
    endDayUtc: sliceDayWindow.endDayUtc,
    capturedAt: new Date(),
    poolTotals: Array.isArray(run.metadataJson.latestPoolTotals)
      ? run.metadataJson.latestPoolTotals
        .filter((item): item is { poolId: string; valueUsd: number } => typeof item === "object" && item !== null)
        .map((item) => ({
          poolId: String(item.poolId),
          valueUsd: Number(item.valueUsd ?? 0),
        }))
      : [],
    walletTokens,
  });

  console.log(JSON.stringify({
    runId,
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    walletTokens: walletTokens.length,
    recoveredFromRaw,
    totalValueUsd: snapshot.totalValueUsd,
    deployedValueUsd: snapshot.deployedValueUsd,
    idleValueUsd: snapshot.idleValueUsd,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});