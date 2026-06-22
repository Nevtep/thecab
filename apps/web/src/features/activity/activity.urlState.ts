import type { ActivityUrlState } from "@/features/activity/activity.types";
import {
  normalizeActivityAction,
  normalizeActivityConfidence,
  normalizeActivityCoverage,
  normalizeActivityPage,
  normalizeActivityPageSize,
  normalizeActivitySearch,
  normalizeActivitySortDirection,
  normalizeActivitySortKey,
  normalizeActivitySurface,
  normalizeActivityUuid,
} from "@/features/activity/activity.validation";

export function createDefaultActivityUrlState(): ActivityUrlState {
  return {
    search: "",
    surface: "all",
    action: "all",
    coverage: null,
    confidence: null,
    poolId: null,
    depositId: null,
    strategyId: null,
    rewardEventId: null,
    governanceEventId: null,
    selectedActivityId: null,
    sort: {
      key: "occurredAt",
      direction: "desc",
    },
    page: 1,
    pageSize: 10,
  };
}

function pickFirst(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) return value;
  }
  return null;
}

export function parseActivityUrlState(searchParams: URLSearchParams): ActivityUrlState {
  return {
    search: normalizeActivitySearch(searchParams.get("search")),
    surface: normalizeActivitySurface(searchParams.get("surface")),
    action: normalizeActivityAction(searchParams.get("action")),
    coverage: normalizeActivityCoverage(searchParams.get("coverage")),
    confidence: normalizeActivityConfidence(searchParams.get("confidence")),
    poolId: normalizeActivityUuid(searchParams.get("poolId")),
    depositId: normalizeActivityUuid(searchParams.get("depositId")),
    strategyId: normalizeActivityUuid(searchParams.get("strategyId")),
    rewardEventId: normalizeActivityUuid(searchParams.get("rewardEventId")),
    governanceEventId: normalizeActivityUuid(searchParams.get("governanceEventId")),
    selectedActivityId: normalizeActivityUuid(pickFirst(searchParams, ["selectedActivityId", "selected"])),
    sort: {
      key: normalizeActivitySortKey(searchParams.get("sort")),
      direction: normalizeActivitySortDirection(searchParams.get("direction")),
    },
    page: normalizeActivityPage(searchParams.get("page")),
    pageSize: normalizeActivityPageSize(searchParams.get("pageSize")),
  };
}

export function serializeActivityUrlState(state: ActivityUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultActivityUrlState();
  if (state.search) params.set("search", state.search);
  if (state.surface !== defaults.surface) params.set("surface", state.surface);
  if (state.action !== defaults.action) params.set("action", state.action);
  if (state.coverage) params.set("coverage", state.coverage);
  if (state.confidence) params.set("confidence", state.confidence);
  if (state.poolId) params.set("poolId", state.poolId);
  if (state.depositId) params.set("depositId", state.depositId);
  if (state.strategyId) params.set("strategyId", state.strategyId);
  if (state.rewardEventId) params.set("rewardEventId", state.rewardEventId);
  if (state.governanceEventId) params.set("governanceEventId", state.governanceEventId);
  if (state.selectedActivityId) params.set("selected", state.selectedActivityId);
  if (state.sort.key !== defaults.sort.key) params.set("sort", state.sort.key);
  if (state.sort.direction !== defaults.sort.direction) params.set("direction", state.sort.direction);
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function normalizeActivityFiltersForQueryKey(state: ActivityUrlState) {
  return {
    search: state.search,
    surface: state.surface,
    action: state.action,
    coverage: state.coverage,
    confidence: state.confidence,
    poolId: state.poolId,
    depositId: state.depositId,
    strategyId: state.strategyId,
    rewardEventId: state.rewardEventId,
    governanceEventId: state.governanceEventId,
    selectedActivityId: state.selectedActivityId,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function buildActivityApiQueryString(input: { chainId: number; state: ActivityUrlState }) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  const serialized = serializeActivityUrlState(input.state);
  if (serialized) {
    const stateParams = new URLSearchParams(serialized);
    for (const [key, value] of stateParams.entries()) params.set(key, value);
  }
  return params.toString();
}

export function resetActivityFilter(state: ActivityUrlState, target: string): ActivityUrlState {
  return {
    ...state,
    search: target === "search" ? "" : state.search,
    surface: target === "surface" ? "all" : state.surface,
    action: target === "action" ? "all" : state.action,
    coverage: target === "coverage" ? null : state.coverage,
    confidence: target === "confidence" ? null : state.confidence,
    poolId: target === "poolId" ? null : state.poolId,
    depositId: target === "depositId" ? null : state.depositId,
    strategyId: target === "strategyId" ? null : state.strategyId,
    rewardEventId: target === "rewardEventId" ? null : state.rewardEventId,
    governanceEventId: target === "governanceEventId" ? null : state.governanceEventId,
    selectedActivityId: null,
    page: 1,
  };
}
