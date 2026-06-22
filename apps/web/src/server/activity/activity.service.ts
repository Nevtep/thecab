import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import { findActivity, readActivityAnalysisContext } from "@/server/activity/activity.repository";
import type { ActivityEventRow, ActivityRequest, ActivityResponse, ActivitySummary } from "@/server/activity/activity.types";

const COVERAGE_ORDER = ["full", "partial", "unresolved", "excluded", "unavailable"] as const;
const PROTOCOL_VOLUME_ACTIONS = new Set(["deposit", "position_created", "withdraw", "swap", "claim", "strategy", "stake", "unstake", "governance"]);

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

export function buildEmptyActivitySummary(): ActivitySummary {
  return {
    totalEvents: 0,
    interpretedEvents: 0,
    totalValueUsd: "0.00",
    walletCapitalInUsd: "0.00",
    walletCapitalOutUsd: "0.00",
    protocolVolumeUsd: "0.00",
    excludedEvents: 0,
    unresolvedEvents: 0,
    coveragePercent: "100.0",
  };
}

export function buildActivitySummary(rows: ActivityEventRow[]): ActivitySummary {
  const excludedEvents = rows.filter((row) => row.coverage === "excluded").length;
  const unresolvedEvents = rows.filter((row) => row.coverage === "unresolved" || row.coverage === "unavailable").length;
  const fullEvents = rows.filter((row) => row.coverage === "full").length;
  const interpretedEvents = rows.length - excludedEvents - unresolvedEvents;
  const totalValueUsd = rows
    .filter((row) => row.coverage !== "excluded")
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);
  const walletCapitalInUsd = rows
    .filter((row) => row.coverage !== "excluded" && row.action === "cash_in")
    .reduce((sum, row) => sum + resolveDirectionalMovementValue(row, "in"), 0);
  const walletCapitalOutUsd = rows
    .filter((row) => row.coverage !== "excluded" && row.action === "cash_out")
    .reduce((sum, row) => sum + resolveDirectionalMovementValue(row, "out"), 0);
  const protocolVolumeUsd = rows
    .filter((row) => row.coverage !== "excluded" && PROTOCOL_VOLUME_ACTIONS.has(row.action))
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);

  return {
    totalEvents: rows.length,
    interpretedEvents,
    totalValueUsd: fixed(totalValueUsd),
    walletCapitalInUsd: fixed(walletCapitalInUsd),
    walletCapitalOutUsd: fixed(walletCapitalOutUsd),
    protocolVolumeUsd: fixed(protocolVolumeUsd),
    excludedEvents,
    unresolvedEvents,
    coveragePercent: rows.length > 0 ? fixed((fullEvents / rows.length) * 100, 1) : "100.0",
  };
}

function resolveDirectionalMovementValue(row: ActivityEventRow, direction: "in" | "out") {
  const movementValue = row.movements
    .filter((movement) => movement.direction === direction)
    .reduce((sum, movement) => sum + Math.abs(asNumber(movement.amountUsd) ?? 0), 0);
  return movementValue > 0 ? movementValue : asNumber(row.valueUsd) ?? 0;
}

export function buildActivityKpis(summary: ActivitySummary): ActivityResponse["kpis"] {
  const coverage = Number(summary.coveragePercent) >= 99.9 ? "full" : "partial";
  const kpis: ActivityResponse["kpis"] = [
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
      id: "walletCapitalIn",
      labelKey: "activity:kpis.walletCapitalIn",
      value: summary.walletCapitalInUsd,
      valueKind: "currency",
      contextLabelKey: "activity:kpis.walletOnly",
      coverage,
    },
    {
      id: "walletCapitalOut",
      labelKey: "activity:kpis.walletCapitalOut",
      value: summary.walletCapitalOutUsd,
      valueKind: "currency",
      contextLabelKey: "activity:kpis.walletOnly",
      coverage,
    },
    {
      id: "protocolVolume",
      labelKey: "activity:kpis.protocolVolume",
      value: summary.protocolVolumeUsd,
      valueKind: "currency",
      contextLabelKey: "activity:kpis.protocolOnly",
      coverage,
    },
    {
      id: "excludedEvents",
      labelKey: "activity:kpis.excludedEvents",
      value: summary.excludedEvents,
      valueKind: "count",
      contextLabelKey: "activity:kpis.spamOnly",
      coverage: summary.excludedEvents > 0 ? "partial" : "full",
    },
  ];
  return summary.excludedEvents > 0 ? kpis : kpis.filter((kpi) => kpi.id !== "excludedEvents");
}

export function buildActivityCharts(rows: ActivityEventRow[]): ActivityResponse["charts"] {
  const dayMap = new Map<string, ActivityResponse["charts"]["timeline"][number]>();
  const actionMap = new Map<string, number>();
  const coverageMap = new Map<string, number>();
  const surfaceMap = new Map<string, number>();
  const movementMap = new Map<"in" | "out" | "none", { count: number; valueUsd: number }>();

  for (const row of rows) {
    const day = row.occurredAt.slice(0, 10);
    const existingDay = dayMap.get(day) ?? {
      day,
      label: day.slice(5),
      total: 0,
      walletCashflow: 0,
      protocolActivity: 0,
      approvals: 0,
      other: 0,
    };
    existingDay.total += 1;
    if (row.action === "cash_in" || row.action === "cash_out") existingDay.walletCashflow += 1;
    else if (PROTOCOL_VOLUME_ACTIONS.has(row.action)) existingDay.protocolActivity += 1;
    else if (row.action === "approval") existingDay.approvals += 1;
    else existingDay.other += 1;
    dayMap.set(day, existingDay);
    actionMap.set(row.action, (actionMap.get(row.action) ?? 0) + 1);
    coverageMap.set(row.coverage, (coverageMap.get(row.coverage) ?? 0) + 1);
    surfaceMap.set(row.surface, (surfaceMap.get(row.surface) ?? 0) + 1);
    if (row.movements.length === 0) {
      const existing = movementMap.get("none") ?? { count: 0, valueUsd: 0 };
      existing.count += 1;
      existing.valueUsd += asNumber(row.valueUsd) ?? 0;
      movementMap.set("none", existing);
    } else {
      for (const movement of row.movements) {
        const existing = movementMap.get(movement.direction) ?? { count: 0, valueUsd: 0 };
        existing.count += 1;
        existing.valueUsd += Math.abs(asNumber(movement.amountUsd) ?? 0);
        movementMap.set(movement.direction, existing);
      }
    }
  }

  return {
    timeline: [...dayMap.values()].sort((left, right) => left.day.localeCompare(right.day)).slice(-30),
    actionBreakdown: [...actionMap.entries()]
      .map(([action, value]) => ({
        id: action as ActivityResponse["charts"]["actionBreakdown"][number]["id"],
        labelKey: `activity:actions.${action}`,
        value,
      }))
      .sort((left, right) => right.value - left.value),
    coverageBreakdown: COVERAGE_ORDER
      .map((coverage) => ({
        id: coverage,
        labelKey: `coverage:level.${coverage}`,
        value: coverageMap.get(coverage) ?? 0,
      }))
      .filter((entry) => entry.value > 0),
    surfaceBreakdown: [...surfaceMap.entries()]
      .map(([surface, value]) => ({
        id: surface as ActivityResponse["charts"]["surfaceBreakdown"][number]["id"],
        labelKey: `activity:surfaces.${surface}`,
        value,
      }))
      .sort((left, right) => right.value - left.value),
    movementBreakdown: [...movementMap.entries()]
      .map(([direction, value]) => ({
        id: direction,
        labelKey: `activity:movements.${direction}`,
        value: value.count,
        valueUsd: fixed(value.valueUsd),
      }))
      .sort((left, right) => right.value - left.value),
  };
}

export function createActivityActiveChips(input: ActivityRequest): ActivityResponse["activeChips"] {
  const chips: ActivityResponse["activeChips"] = [];
  if (input.search) chips.push({ id: "search", labelKey: "activity:filters.search", value: input.search, removeTarget: "search" });
  if (input.surface !== "all") chips.push({ id: "surface", labelKey: "activity:filters.surface", value: input.surface, removeTarget: "surface" });
  if (input.action !== "all") chips.push({ id: "action", labelKey: "activity:filters.action", value: input.action, removeTarget: "action" });
  if (input.coverage) chips.push({ id: "coverage", labelKey: "activity:filters.coverage", value: input.coverage, removeTarget: "coverage" });
  if (input.confidence) chips.push({ id: "confidence", labelKey: "activity:filters.confidence", value: input.confidence, removeTarget: "confidence" });
  if (input.poolId) chips.push({ id: "poolId", labelKey: "activity:filters.pool", value: input.poolId, removeTarget: "poolId" });
  if (input.depositId) chips.push({ id: "depositId", labelKey: "activity:filters.deposit", value: input.depositId, removeTarget: "depositId" });
  if (input.strategyId) chips.push({ id: "strategyId", labelKey: "activity:filters.strategy", value: input.strategyId, removeTarget: "strategyId" });
  if (input.rewardEventId) chips.push({ id: "rewardEventId", labelKey: "activity:filters.reward", value: input.rewardEventId, removeTarget: "rewardEventId" });
  if (input.governanceEventId) chips.push({ id: "governanceEventId", labelKey: "activity:filters.governance", value: input.governanceEventId, removeTarget: "governanceEventId" });
  return chips;
}

export function buildLockedActivityResponse(input: ActivityRequest, analysis: ActivityResponse["analysis"]): ActivityResponse {
  return {
    screenKind: "locked",
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysis,
    summary: buildEmptyActivitySummary(),
    kpis: buildActivityKpis(buildEmptyActivitySummary()),
    charts: buildActivityCharts([]),
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
    activeChips: createActivityActiveChips(input),
  };
}

export function buildReadyActivityResponse(input: {
  request: ActivityRequest;
  repository: {
    allRows: ActivityEventRow[];
    rows: ActivityEventRow[];
    totalRows: number;
    availableFilters: ActivityResponse["availableFilters"];
  };
  analysis: ActivityResponse["analysis"];
}): ActivityResponse {
  const summary = buildActivitySummary(input.repository.allRows);
  const charts = buildActivityCharts(input.repository.allRows);
  const selectedActivity =
    input.repository.rows.find((row) => row.activityId === input.request.selectedActivityId) ??
    input.repository.allRows.find((row) => row.activityId === input.request.selectedActivityId) ??
    input.repository.rows[0] ??
    null;

  return {
    screenKind: input.repository.totalRows === 0 ? "empty" : "ready",
    walletAddress: input.request.walletAddress,
    chainId: input.request.chainId,
    analysis: input.analysis,
    summary,
    kpis: buildActivityKpis(summary),
    charts,
    events: {
      rows: input.repository.rows,
      pagination: {
        page: input.request.page,
        pageSize: input.request.pageSize,
        totalRows: input.repository.totalRows,
        totalPages: Math.ceil(input.repository.totalRows / input.request.pageSize),
      },
    },
    selectedActivity,
    availableFilters: input.repository.availableFilters,
    activeChips: createActivityActiveChips(input.request),
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
    return buildLockedActivityResponse(input, analysis);
  }

  const result = await findActivity(input);
  return buildReadyActivityResponse({ request: input, repository: result, analysis });
}
