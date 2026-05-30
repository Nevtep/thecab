import type {
  StrategiesCoverageFilter,
  StrategiesPageSize,
  StrategiesProtocolFilter,
  StrategiesReturnSignFilter,
  StrategiesSort,
  StrategiesStatusFilter,
} from "@/features/strategies/strategies.types";
import {
  normalizeStrategiesCoverageFilter,
  normalizeStrategiesPage,
  normalizeStrategiesPageSize,
  normalizeStrategiesProtocolFilter,
  normalizeStrategiesReturnSignFilter,
  normalizeStrategiesSearch,
  normalizeStrategiesSort,
  normalizeStrategiesStatusFilter,
  normalizeStrategiesUuid,
} from "@/features/strategies/strategies.validation";

export type StrategiesListUrlState = {
  status: StrategiesStatusFilter;
  protocol: StrategiesProtocolFilter;
  poolId: string | null;
  coverage: StrategiesCoverageFilter;
  returnSign: StrategiesReturnSignFilter;
  search: string;
  sort: StrategiesSort;
  page: number;
  pageSize: StrategiesPageSize;
  selectedStrategyId: string | null;
};

export function createDefaultStrategiesListUrlState(): StrategiesListUrlState {
  return {
    status: "active",
    protocol: "mellow",
    poolId: null,
    coverage: "all",
    returnSign: "any",
    search: "",
    sort: "current_value_desc",
    page: 1,
    pageSize: 10,
    selectedStrategyId: null,
  };
}

function pickFirst(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function parseStrategiesListUrlState(searchParams: URLSearchParams): StrategiesListUrlState {
  return {
    status: normalizeStrategiesStatusFilter(searchParams.get("status")),
    protocol: normalizeStrategiesProtocolFilter(searchParams.get("protocol")),
    poolId: normalizeStrategiesUuid(pickFirst(searchParams, ["pool", "poolId"])),
    coverage: normalizeStrategiesCoverageFilter(searchParams.get("coverage")),
    returnSign: normalizeStrategiesReturnSignFilter(searchParams.get("returnSign")),
    search: normalizeStrategiesSearch(searchParams.get("search")),
    sort: normalizeStrategiesSort(searchParams.get("sort")),
    page: normalizeStrategiesPage(searchParams.get("page")),
    pageSize: normalizeStrategiesPageSize(searchParams.get("pageSize")),
    selectedStrategyId: normalizeStrategiesUuid(searchParams.get("selectedStrategyId")),
  };
}

export function serializeStrategiesListUrlState(state: StrategiesListUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultStrategiesListUrlState();
  if (state.status !== defaults.status) params.set("status", state.status);
  if (state.protocol !== defaults.protocol) params.set("protocol", state.protocol);
  if (state.poolId) params.set("pool", state.poolId);
  if (state.coverage !== defaults.coverage) params.set("coverage", state.coverage);
  if (state.returnSign !== defaults.returnSign) params.set("returnSign", state.returnSign);
  if (state.search) params.set("search", state.search);
  if (state.sort !== defaults.sort) params.set("sort", state.sort);
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  if (state.selectedStrategyId) params.set("selectedStrategyId", state.selectedStrategyId);
  return params.toString();
}

export function normalizeStrategiesFiltersForQueryKey(state: StrategiesListUrlState) {
  return {
    status: state.status,
    protocol: state.protocol,
    poolId: state.poolId,
    coverage: state.coverage,
    returnSign: state.returnSign,
    search: state.search,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
    selectedStrategyId: state.selectedStrategyId,
  };
}

export function buildStrategiesApiQueryString(input: {
  chainId: number;
  state: StrategiesListUrlState;
}): string {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  if (input.state.status !== "active") params.set("status", input.state.status);
  if (input.state.protocol !== "mellow") params.set("protocol", input.state.protocol);
  if (input.state.poolId) params.set("pool", input.state.poolId);
  if (input.state.coverage !== "all") params.set("coverage", input.state.coverage);
  if (input.state.returnSign !== "any") params.set("returnSign", input.state.returnSign);
  if (input.state.search) params.set("search", input.state.search);
  params.set("sort", input.state.sort);
  params.set("page", String(input.state.page));
  params.set("pageSize", String(input.state.pageSize));
  if (input.state.selectedStrategyId) params.set("selectedStrategyId", input.state.selectedStrategyId);
  return params.toString();
}
