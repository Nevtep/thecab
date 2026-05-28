import {
  DEPOSITS_RETURN_SIGN_FILTER_VALUES,
  DEPOSITS_SORT_DIRECTION_VALUES,
  DEPOSITS_SORT_FIELD_VALUES,
  DEPOSITS_STATUS_FILTER_VALUES,
  normalizeOneOf,
  parseNamedDepositsSort,
  toNamedDepositsSort,
} from "@/server/deposits/deposits.contract";
import type {
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
} from "@/features/deposits/deposits.types";

export type DepositsListUrlState = {
  status: DepositsStatusFilter;
  poolId: string | null;
  startDayUtc: string | null;
  endDayUtc: string | null;
  returnSign: DepositsReturnSignFilter;
  sort: DepositsSortField;
  direction: DepositsSortDirection;
  page: number;
  pageSize: number;
  selectedDepositId: string | null;
};

export function createDefaultDepositsListUrlState(): DepositsListUrlState {
  return {
    status: "all",
    poolId: null,
    startDayUtc: null,
    endDayUtc: null,
    returnSign: "all",
    sort: "openedAt",
    direction: "desc",
    page: 1,
    pageSize: 25,
    selectedDepositId: null,
  };
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function pickInt(value: string | null, fallback: number, { min, max }: { min: number; max: number }) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  if (truncated < min || truncated > max) return fallback;
  return truncated;
}

function pickDay(value: string | null): string | null {
  if (!value) return null;
  return DAY_PATTERN.test(value) ? value : null;
}

function pickUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : null;
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

function normalizeReturnSign(value: string | null, fallback: DepositsReturnSignFilter) {
  if (value === "any") {
    return "all" satisfies DepositsReturnSignFilter;
  }
  return normalizeOneOf(value, DEPOSITS_RETURN_SIGN_FILTER_VALUES, fallback);
}

export function parseDepositsListUrlState(searchParams: URLSearchParams): DepositsListUrlState {
  const defaults = createDefaultDepositsListUrlState();
  const namedSort = parseNamedDepositsSort(searchParams.get("sort"));
  return {
    status: normalizeOneOf(searchParams.get("status"), DEPOSITS_STATUS_FILTER_VALUES, defaults.status),
    poolId: pickUuid(pickFirst(searchParams, ["pool", "poolId"])),
    startDayUtc: pickDay(pickFirst(searchParams, ["from", "startDayUtc"])),
    endDayUtc: pickDay(pickFirst(searchParams, ["to", "endDayUtc"])),
    returnSign: normalizeReturnSign(searchParams.get("returnSign"), defaults.returnSign),
    sort: namedSort?.sort ?? normalizeOneOf(searchParams.get("sort"), DEPOSITS_SORT_FIELD_VALUES, defaults.sort),
    direction: namedSort?.direction ?? normalizeOneOf(searchParams.get("direction"), DEPOSITS_SORT_DIRECTION_VALUES, defaults.direction),
    page: pickInt(searchParams.get("page"), defaults.page, { min: 1, max: 10000 }),
    pageSize: pickInt(searchParams.get("pageSize"), defaults.pageSize, { min: 1, max: 100 }),
    selectedDepositId: pickUuid(searchParams.get("selectedDepositId")),
  };
}

export function serializeDepositsListUrlState(state: DepositsListUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultDepositsListUrlState();
  if (state.status !== defaults.status) params.set("status", state.status);
  if (state.poolId) params.set("pool", state.poolId);
  if (state.startDayUtc) params.set("from", state.startDayUtc);
  if (state.endDayUtc) params.set("to", state.endDayUtc);
  if (state.returnSign !== defaults.returnSign) params.set("returnSign", state.returnSign);
  const namedSort = toNamedDepositsSort(state.sort, state.direction);
  if (namedSort) {
    if (namedSort !== toNamedDepositsSort(defaults.sort, defaults.direction)) {
      params.set("sort", namedSort);
    }
  } else {
    if (state.sort !== defaults.sort) params.set("sort", state.sort);
    if (state.direction !== defaults.direction) params.set("direction", state.direction);
  }
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  if (state.selectedDepositId) params.set("selectedDepositId", state.selectedDepositId);
  return params.toString();
}

export function normalizeFiltersForQueryKey(state: DepositsListUrlState) {
  return {
    status: state.status,
    poolId: state.poolId,
    startDayUtc: state.startDayUtc,
    endDayUtc: state.endDayUtc,
    returnSign: state.returnSign,
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function buildDepositsApiQueryString(input: {
  chainId: number;
  state: DepositsListUrlState;
}): string {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  if (input.state.status !== "all") params.set("status", input.state.status);
  if (input.state.poolId) params.set("pool", input.state.poolId);
  if (input.state.startDayUtc) params.set("from", input.state.startDayUtc);
  if (input.state.endDayUtc) params.set("to", input.state.endDayUtc);
  if (input.state.returnSign !== "all") params.set("returnSign", input.state.returnSign);
  const namedSort = toNamedDepositsSort(input.state.sort, input.state.direction);
  if (namedSort) {
    params.set("sort", namedSort);
  } else {
    params.set("sort", input.state.sort);
    params.set("direction", input.state.direction);
  }
  params.set("page", String(input.state.page));
  params.set("pageSize", String(input.state.pageSize));
  return params.toString();
}
