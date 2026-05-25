import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { shouldEnforceCompletedRunDailyGate } from "@/server/analysis/start-policy";
import { closeDb, getDb } from "@/server/db/client";
import {
  analysisRuns,
  analysisSlices,
  deposits,
  performanceSnapshots,
  portfolioSnapshots,
  processingCursors,
  protocolContracts,
  rawProviderRecords,
  rewardEvents,
  strategyExposures,
} from "@/server/db/schema";

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

function getRequiredAddress(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }

  return value.toLowerCase();
}

function getBaseUrl() {
  return (process.env.ANALYSIS_BASE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/$/, "");
}

function getTimeoutMs() {
  const parsed = Number(process.env.ANALYSIS_SMOKE_TIMEOUT_MS ?? "900000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900_000;
}

function getPollMs() {
  const parsed = Number(process.env.ANALYSIS_SMOKE_POLL_MS ?? "5000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function fetchJson<T>(input: string, init: RequestInit & { walletAddress: string }) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `cab_authenticated_address=${init.walletAddress}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}:${JSON.stringify(payload)}`);
  }

  return payload as T;
}

async function fetchJsonAllowing<T>(
  input: string,
  init: RequestInit & { walletAddress: string },
  allowedStatuses: number[],
) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `cab_authenticated_address=${init.walletAddress}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(`HTTP_${response.status}:${JSON.stringify(payload)}`);
  }

  return {
    status: response.status,
    payload: payload as T,
  };
}

type StartAnalysisResponse = {
  runId: string;
  status: string;
  mode: string;
  isExistingRun: boolean;
};

type AnalysisStatusResponse = {
  status: string;
  runId: string | null;
  coverage: string;
  coverageReasons: string[];
  slices: Array<{
    status: string;
  }>;
};

async function waitForRunCompletion(baseUrl: string, walletAddress: string) {
  const timeoutAt = Date.now() + getTimeoutMs();
  let latestStatus: AnalysisStatusResponse | null = null;

  while (Date.now() < timeoutAt) {
    latestStatus = await fetchJson<AnalysisStatusResponse>(
      `${baseUrl}/api/analysis/status?walletAddress=${walletAddress}&chainId=${SUPPORTED_CHAIN_ID}`,
      {
        method: "GET",
        walletAddress,
      },
    );

    if (["ready", "stale", "failed"].includes(latestStatus.status)) {
      return latestStatus;
    }

    await delay(getPollMs());
  }

  throw new Error(`ANALYSIS_SMOKE_TIMEOUT:${JSON.stringify(latestStatus)}`);
}

async function readLatestRunSummary(walletAddress: string) {
  const db = getDb();
  const [latestRun] = await db
    .select({
      id: analysisRuns.id,
      status: analysisRuns.status,
      coverage: analysisRuns.coverage,
      completedAt: analysisRuns.completedAt,
      triggeredAtUtc: analysisRuns.triggeredAtUtc,
      utcDayBucket: analysisRuns.utcDayBucket,
    })
    .from(analysisRuns)
    .where(and(eq(analysisRuns.walletAddress, walletAddress), eq(analysisRuns.chainId, SUPPORTED_CHAIN_ID)))
    .orderBy(desc(analysisRuns.triggeredAtUtc))
    .limit(1);

  if (!latestRun) {
    throw new Error("ANALYSIS_RUN_NOT_FOUND");
  }

  const [sliceRows, rawProviderCountRow, depositCountRow, strategyExposureCountRow, rewardCountRow, performanceCountRow, portfolioCountRow, protocolContractCountRow, cursorRows] = await Promise.all([
    db
      .select({ status: analysisSlices.status })
      .from(analysisSlices)
      .where(eq(analysisSlices.runId, latestRun.id)),
    db
      .select({ value: count() })
      .from(rawProviderRecords)
      .where(eq(rawProviderRecords.runId, latestRun.id)),
    db
      .select({ value: count() })
      .from(deposits)
      .where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, SUPPORTED_CHAIN_ID))),
    db
      .select({ value: count() })
      .from(strategyExposures)
      .where(and(eq(strategyExposures.walletAddress, walletAddress), eq(strategyExposures.chainId, SUPPORTED_CHAIN_ID))),
    db
      .select({ value: count() })
      .from(rewardEvents)
      .where(and(eq(rewardEvents.walletAddress, walletAddress), eq(rewardEvents.chainId, SUPPORTED_CHAIN_ID))),
    db
      .select({ value: count() })
      .from(performanceSnapshots)
      .where(and(eq(performanceSnapshots.walletAddress, walletAddress), eq(performanceSnapshots.chainId, SUPPORTED_CHAIN_ID))),
    db
      .select({ value: count() })
      .from(portfolioSnapshots)
      .where(and(eq(portfolioSnapshots.walletAddress, walletAddress), eq(portfolioSnapshots.chainId, SUPPORTED_CHAIN_ID))),
    db
      .select({ value: count() })
      .from(protocolContracts)
      .where(and(eq(protocolContracts.chainId, SUPPORTED_CHAIN_ID), inArray(protocolContracts.protocol, ["aerodrome", "mellow"]))),
    db
      .select({
        lastProcessedDayUtc: processingCursors.lastProcessedDayUtc,
        lastSuccessfulRunId: processingCursors.lastSuccessfulRunId,
      })
      .from(processingCursors)
      .where(and(eq(processingCursors.walletAddress, walletAddress), eq(processingCursors.chainId, SUPPORTED_CHAIN_ID))),
  ]);

  return {
    latestRun,
    slices: {
      total: sliceRows.length,
      complete: sliceRows.filter((row) => row.status === "complete").length,
      skippedCached: sliceRows.filter((row) => row.status === "skipped_cached").length,
      failed: sliceRows.filter((row) => row.status === "failed").length,
    },
    rawProviderCount: rawProviderCountRow[0]?.value ?? 0,
    depositCount: depositCountRow[0]?.value ?? 0,
    strategyExposureCount: strategyExposureCountRow[0]?.value ?? 0,
    rewardCount: rewardCountRow[0]?.value ?? 0,
    performanceSnapshotCount: performanceCountRow[0]?.value ?? 0,
    portfolioSnapshotCount: portfolioCountRow[0]?.value ?? 0,
    protocolContractCount: protocolContractCountRow[0]?.value ?? 0,
    cursor: cursorRows[0] ?? null,
  };
}

function assertMeaningfulResults(summary: Awaited<ReturnType<typeof readLatestRunSummary>>) {
  if (summary.latestRun.status !== "complete") {
    throw new Error(`LATEST_RUN_NOT_COMPLETE:${summary.latestRun.status}`);
  }

  if (summary.slices.total === 0) {
    throw new Error("NO_SLICES_PERSISTED");
  }

  if (summary.rawProviderCount === 0) {
    throw new Error("NO_PROVIDER_RECORDS_PERSISTED");
  }

  if (summary.performanceSnapshotCount === 0 || summary.portfolioSnapshotCount === 0) {
    throw new Error("NO_DAILY_SNAPSHOTS_PERSISTED");
  }

  if (summary.depositCount + summary.strategyExposureCount + summary.rewardCount === 0) {
    throw new Error("NO_MEANINGFUL_DOMAIN_OUTPUT");
  }
}

async function main() {
  const walletAddress = getRequiredAddress("TEST_ADDRESS");
  const baseUrl = getBaseUrl();
  const enforceDailyGate = shouldEnforceCompletedRunDailyGate();

  try {
    const startedResponse = await fetchJsonAllowing<
      StartAnalysisResponse | { error: { code: string; details?: { run?: StartAnalysisResponse } } }
    >(`${baseUrl}/api/analysis/start`, {
      method: "POST",
      walletAddress,
      body: JSON.stringify({
        walletAddress,
        chainId: SUPPORTED_CHAIN_ID,
      }),
    }, [409]);

    const started = startedResponse.status === 409
      ? ("error" in startedResponse.payload ? startedResponse.payload.error.details?.run ?? null : null)
      : startedResponse.payload as StartAnalysisResponse;

    if (!started) {
      throw new Error(`ANALYSIS_START_FAILED:${JSON.stringify(startedResponse.payload)}`);
    }

    const completedStatus = await waitForRunCompletion(baseUrl, walletAddress);
    const firstSummary = await readLatestRunSummary(walletAddress);
    assertMeaningfulResults(firstSummary);

    const secondStart = await fetchJson<StartAnalysisResponse>(`${baseUrl}/api/analysis/start`, {
      method: "POST",
      walletAddress,
      body: JSON.stringify({
        walletAddress,
        chainId: SUPPORTED_CHAIN_ID,
      }),
    });

    let secondSummary = await readLatestRunSummary(walletAddress);
    let sameDayRetry: Record<string, unknown>;

    if (enforceDailyGate) {
      if (!secondStart.isExistingRun || secondStart.runId !== firstSummary.latestRun.id) {
        throw new Error(`SAME_DAY_RERUN_NOT_REUSED:${JSON.stringify(secondStart)}`);
      }

      if (secondSummary.rawProviderCount !== firstSummary.rawProviderCount) {
        throw new Error(
          `SAME_DAY_RERUN_INCREASED_PROVIDER_TRAFFIC:${firstSummary.rawProviderCount}->${secondSummary.rawProviderCount}`,
        );
      }

      sameDayRetry = {
        reusedRunId: secondStart.runId,
        rawProviderRecordsUnchanged: true,
      };
    } else {
      if (secondStart.isExistingRun || secondStart.runId === firstSummary.latestRun.id) {
        throw new Error(`DEVELOPMENT_RERUN_NOT_STARTED:${JSON.stringify(secondStart)}`);
      }

      if (secondStart.mode !== "incremental") {
        throw new Error(`DEVELOPMENT_RERUN_NOT_INCREMENTAL:${JSON.stringify(secondStart)}`);
      }

      await waitForRunCompletion(baseUrl, walletAddress);
      secondSummary = await readLatestRunSummary(walletAddress);
      assertMeaningfulResults(secondSummary);

      sameDayRetry = {
        rerunId: secondStart.runId,
        rerunMode: secondStart.mode,
        rerunSlices: secondSummary.slices,
      };
    }

    console.log(JSON.stringify({
      ok: true,
      walletAddress,
      initialStart: started,
      completedStatus,
      latestRun: firstSummary.latestRun,
      slices: firstSummary.slices,
      counts: {
        rawProviderRecords: firstSummary.rawProviderCount,
        deposits: firstSummary.depositCount,
        strategyExposures: firstSummary.strategyExposureCount,
        rewardEvents: firstSummary.rewardCount,
        performanceSnapshots: firstSummary.performanceSnapshotCount,
        portfolioSnapshots: firstSummary.portfolioSnapshotCount,
        protocolContracts: firstSummary.protocolContractCount,
      },
      cursor: firstSummary.cursor,
      sameDayRetry,
    }, null, 2));
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});