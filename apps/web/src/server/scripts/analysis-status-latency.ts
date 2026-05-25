import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  readAnalysisStatusContext,
} from "@/server/analysis/analysis-run.repository";
import { projectAnalysisProgress, projectAnalysisStatus } from "@/server/analysis/status-projection";
import { closeDb } from "@/server/db/client";

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

function getRequiredAddress(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }

  return value.toLowerCase();
}

function getSampleCount() {
  const parsed = Number(process.env.ANALYSIS_STATUS_LATENCY_SAMPLES ?? "25");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
}

function getP95TargetMs() {
  return 200;
}

function quantile(values: number[], percentile: number) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return sorted[index] ?? 0;
}

async function sampleStatusProjection(walletAddress: string, chainId: number, runId?: string) {
  const startedAt = performance.now();
  const { run, freshness, slices } = await readAnalysisStatusContext({
    walletAddress,
    chainId,
    runId,
  });
  const progress = {
    totalSlices: slices.length,
    completedSlices: slices.filter((slice) => slice.status === "complete" || slice.status === "skipped_cached").length,
    failedSlices: slices.filter((slice) => slice.status === "failed").length,
  };
  const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;

  projectAnalysisStatus({
    latestRunStatus: run?.status ?? null,
    lastSuccessfulRunAt,
    coverageReasons: run?.coverageReasonsJson ?? [],
    failedSliceCount: progress.failedSlices,
  });
  projectAnalysisProgress({
    latestRunStatus: run?.status ?? null,
    currentStage: run?.stage ?? null,
    totalSlices: progress.totalSlices,
    completedSlices: progress.completedSlices,
    failedSlices: progress.failedSlices,
    slices,
  });

  return performance.now() - startedAt;
}

async function main() {
  loadLocalEnvFile();

  const walletAddress = getRequiredAddress("TEST_ADDRESS");
  const chainId = SUPPORTED_CHAIN_ID;
  const sampleCount = getSampleCount();
  const durations: number[] = [];

  try {
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      durations.push(await sampleStatusProjection(walletAddress, chainId, process.env.ANALYSIS_STATUS_RUN_ID));
    }

    const p50Ms = quantile(durations, 0.5);
    const p95Ms = quantile(durations, 0.95);
    const result = {
      ok: p95Ms <= getP95TargetMs(),
      walletAddress,
      chainId,
      sampleCount,
      minMs: Math.min(...durations),
      p50Ms,
      p95Ms,
      maxMs: Math.max(...durations),
      targetMs: getP95TargetMs(),
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      process.exit(1);
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});