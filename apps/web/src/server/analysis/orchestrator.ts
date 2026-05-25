import { findLatestCompletedAnalysisRun } from "@/server/analysis/analysis-run.repository";
import { getProcessingCursor } from "@/server/analysis/processing-cursor.repository";
import { getEnv } from "@/server/env";

export type AnalysisMode = "full_history" | "incremental";

export type PlannedAnalysisSlice = {
  sliceIndex: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  isFullyCached: boolean;
};

function startOfUtcDay(input: Date) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function addUtcDays(input: Date, days: number) {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveAnalysisMode(input: {
  requestedMode?: AnalysisMode | null;
  hasCompletedRun: boolean;
}) : AnalysisMode {
  if (input.requestedMode) {
    return input.requestedMode;
  }

  return input.hasCompletedRun ? "incremental" : "full_history";
}

export function planAnalysisSlices(input: {
  triggeredAtUtc: Date;
  mode: AnalysisMode;
  lastProcessedDayUtc?: string | null;
}) : PlannedAnalysisSlice[] {
  const env = getEnv();
  const sliceDays = env.ANALYSIS_SLICE_DAYS;
  const horizonStart = addUtcDays(startOfUtcDay(input.triggeredAtUtc), -env.ANALYSIS_HISTORY_DAYS);
  const latestBoundary = addUtcDays(startOfUtcDay(input.triggeredAtUtc), 1);
  const cursorBoundary = input.lastProcessedDayUtc
    ? addUtcDays(new Date(`${input.lastProcessedDayUtc}T00:00:00.000Z`), 1)
    : null;

  let currentEnd = latestBoundary;
  let sliceIndex = 0;
  const slices: PlannedAnalysisSlice[] = [];

  while (currentEnd > horizonStart) {
    const currentStart = currentEnd > horizonStart ? addUtcDays(currentEnd, -sliceDays) : horizonStart;
    const boundedStart = currentStart < horizonStart ? horizonStart : currentStart;
    const isFullyCached = Boolean(cursorBoundary && currentEnd <= cursorBoundary);

    slices.push({
      sliceIndex,
      sliceStartUtc: boundedStart,
      sliceEndUtc: currentEnd,
      isFullyCached,
    });

    if (input.mode === "incremental" && cursorBoundary && boundedStart <= cursorBoundary) {
      break;
    }

    currentEnd = boundedStart;
    sliceIndex += 1;

    if (sliceIndex > Math.ceil(env.ANALYSIS_HISTORY_DAYS / sliceDays) + 1) {
      break;
    }
  }

  return slices;
}

export async function prepareAnalysisRunContext(input: {
  walletAddress: string;
  chainId: number;
  requestedMode?: AnalysisMode | null;
  triggeredAtUtc?: Date;
}) {
  const triggeredAtUtc = input.triggeredAtUtc ?? new Date();
  const [latestCompletedRun, cursor] = await Promise.all([
    findLatestCompletedAnalysisRun(input.walletAddress, input.chainId),
    getProcessingCursor(input.walletAddress, input.chainId),
  ]);
  const mode = resolveAnalysisMode({
    requestedMode: input.requestedMode,
    hasCompletedRun: Boolean(latestCompletedRun),
  });

  return {
    triggeredAtUtc,
    latestCompletedRun,
    cursor,
    mode,
    slices: planAnalysisSlices({
      triggeredAtUtc,
      mode,
      lastProcessedDayUtc: cursor?.lastProcessedDayUtc ?? null,
    }),
  };
}