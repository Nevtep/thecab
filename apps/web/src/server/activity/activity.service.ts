import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import { findActivity, readActivityAnalysisContext } from "@/server/activity/activity.repository";
import type { ActivityEventRow, ActivityRequest, ActivityResponse, ActivitySummary } from "@/server/activity/activity.types";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fixed(value: number, digits = 2) {
  return value.toFixed(digits);
}

function emptySummary(): ActivitySummary {
  return {
    totalEvents: 0,
    interpretedEvents: 0,
    totalValueUsd: "0.00",
    excludedEvents: 0,
    unresolvedEvents: 0,
    coveragePercent: "100.0",
  };
}

function buildSummary(rows: ActivityEventRow[]): ActivitySummary {
  const excludedEvents = rows.filter((row) => row.coverage === "excluded").length;
  const unresolvedEvents = rows.filter((row) => row.coverage === "unresolved" || row.coverage === "unavailable").length;
  const fullEvents = rows.filter((row) => row.coverage === "full").length;
  const interpretedEvents = rows.length - excludedEvents - unresolvedEvents;
  const totalValueUsd = rows
    .filter((row) => row.coverage !== "excluded")
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);

  return {
    totalEvents: rows.length,
    interpretedEvents,
    totalValueUsd: fixed(totalValueUsd),
    excludedEvents,
    unresolvedEvents,
    coveragePercent: rows.length > 0 ? fixed((fullEvents / rows.length) * 100, 1) : "100.0",
  };
}

function buildKpis(summary: ActivitySummary): ActivityResponse["kpis"] {
  const coverage = Number(summary.coveragePercent) >= 99.9 ? "full" : "partial";
  return [
    {
      id: "totalEvents",
      labelKey: "activity:kpis.totalEvents",
      value: summary.totalEvents,
      valueKind: "count",
      contextLabelKey: "activity:kpis.allHistory",
      coverage,
    },
    {
      id: "interpretedEvents",
      labelKey: "activity:kpis.interpretedEvents",
      value: summary.interpretedEvents,
      valueKind: "count",
      contextLabelKey: "activity:kpis.excludesUnsupported",
      coverage,
    },
    {
      id: "totalValue",
      labelKey: "activity:kpis.totalValue",
      value: summary.totalValueUsd,
      valueKind: "currency",
      contextLabelKey: "activity:kpis.nonExcluded",
      coverage,
    },
    {
      id: "coverage",
      labelKey: "activity:kpis.coverage",
      value: summary.coveragePercent,
      valueKind: "percent",
      contextLabelKey: "activity:kpis.classificationCoverage",
      coverage,
    },
  ];
}

function createActiveChips(input: ActivityRequest): ActivityResponse["activeChips"] {
  const chips: ActivityResponse["activeChips"] = [];
  if (input.search) chips.push({ id: "search", labelKey: "activity:filters.search", value: input.search, removeTarget: "search" });
  if (input.surface !== "all") chips.push({ id: "surface", labelKey: "activity:filters.surface", value: input.surface, removeTarget: "surface" });
  if (input.action !== "all") chips.push({ id: "action", labelKey: "activity:filters.action", value: input.action, removeTarget: "action" });
  if (input.coverage) chips.push({ id: "coverage", labelKey: "activity:filters.coverage", value: input.coverage, removeTarget: "coverage" });
  if (input.confidence) chips.push({ id: "confidence", labelKey: "activity:filters.confidence", value: input.confidence, removeTarget: "confidence" });
  return chips;
}

function buildLockedResponse(input: ActivityRequest, analysis: ActivityResponse["analysis"]): ActivityResponse {
  return {
    screenKind: "locked",
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysis,
    summary: emptySummary(),
    kpis: buildKpis(emptySummary()),
    events: {
      rows: [],
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalRows: 0,
        totalPages: 0,
      },
    },
    selectedActivity: null,
    availableFilters: {
      actions: [],
      surfaces: [],
      tokens: [],
    },
    activeChips: createActiveChips(input),
  };
}

export async function getActivityDataView(input: ActivityRequest): Promise<ActivityResponse> {
  const { run, freshness, slices } = await readActivityAnalysisContext(input);
  const failedSlices = slices.filter((slice) => slice.status === "failed").length;
  const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
  const projectedStatus = projectAnalysisStatus({
    latestRunStatus: run?.status ?? null,
    lastSuccessfulRunAt,
    coverageReasons: run?.coverageReasonsJson ?? [],
    failedSliceCount: failedSlices,
  });
  const analysis = {
    status: projectedStatus.status,
    coverage: projectedStatus.coverage,
    coverageReasons: projectedStatus.coverageReasons,
  };

  if (projectedStatus.status !== "ready" && projectedStatus.status !== "stale") {
    return buildLockedResponse(input, analysis);
  }

  const result = await findActivity(input);
  const summary = buildSummary(result.allRows);
  const selectedActivity =
    result.rows.find((row) => row.activityId === input.selectedActivityId) ??
    result.allRows.find((row) => row.activityId === input.selectedActivityId) ??
    result.rows[0] ??
    null;

  return {
    screenKind: result.totalRows === 0 ? "empty" : "ready",
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysis,
    summary,
    kpis: buildKpis(summary),
    events: {
      rows: result.rows,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalRows: result.totalRows,
        totalPages: Math.ceil(result.totalRows / input.pageSize),
      },
    },
    selectedActivity,
    availableFilters: result.availableFilters,
    activeChips: createActiveChips(input),
  };
}
