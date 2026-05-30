import {
  normalizeOneOf,
  STRATEGIES_COVERAGE_FILTER_VALUES,
  STRATEGIES_PAGE_SIZE_VALUES,
  STRATEGIES_PROTOCOL_FILTER_VALUES,
  STRATEGIES_RETURN_SIGN_FILTER_VALUES,
  STRATEGIES_SORT_VALUES,
  STRATEGIES_STATUS_FILTER_VALUES,
} from "@/server/strategies/strategies.contract";
import type {
  StrategiesCoverageFilter,
  StrategiesPageSize,
  StrategiesProtocolFilter,
  StrategiesReturnSignFilter,
  StrategiesSort,
  StrategiesStatusFilter,
} from "@/features/strategies/strategies.types";

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

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const SEARCH_MAX_LENGTH = 64;

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

function pickUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : null;
}

function pickInt(value: string | null, fallback: number, { min, max }: { min: number; max: number }) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  if (truncated < min || truncated > max) return fallback;
  return truncated;
}

function pickPageSize(value: string | null, fallback: StrategiesPageSize): StrategiesPageSize {
  const parsed = pickInt(value, fallback, { min: 1, max: 50 });
  return (STRATEGIES_PAGE_SIZE_VALUES as readonly number[]).includes(parsed)
    ? (parsed as StrategiesPageSize)
    : fallback;
}

function pickSearch(value: string | null) {
  return (value ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
}

export function parseStrategiesListUrlState(searchParams: URLSearchParams): StrategiesListUrlState {
  const defaults = createDefaultStrategiesListUrlState();
  return {
    status: normalizeOneOf(searchParams.get("status"), STRATEGIES_STATUS_FILTER_VALUES, defaults.status),
    protocol: normalizeOneOf(searchParams.get("protocol"), STRATEGIES_PROTOCOL_FILTER_VALUES, defaults.protocol),
    poolId: pickUuid(pickFirst(searchParams, ["pool", "poolId"])),
    coverage: normalizeOneOf(searchParams.get("coverage"), STRATEGIES_COVERAGE_FILTER_VALUES, defaults.coverage),
    returnSign: normalizeOneOf(searchParams.get("returnSign"), STRATEGIES_RETURN_SIGN_FILTER_VALUES, defaults.returnSign),
    search: pickSearch(searchParams.get("search")),
    sort: normalizeOneOf(searchParams.get("sort"), STRATEGIES_SORT_VALUES, defaults.sort),
    page: pickInt(searchParams.get("page"), defaults.page, { min: 1, max: 10000 }),
    pageSize: pickPageSize(searchParams.get("pageSize"), defaults.pageSize),
    selectedStrategyId: pickUuid(searchParams.get("selectedStrategyId")),
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

