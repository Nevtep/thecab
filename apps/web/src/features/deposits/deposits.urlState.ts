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

const STATUS_VALUES: DepositsStatusFilter[] = ["all", "open_active", "open_out_of_range", "closed"];
const RETURN_SIGN_VALUES: DepositsReturnSignFilter[] = ["all", "positive", "negative"];
const SORT_VALUES: DepositsSortField[] = ["openedAt", "currentValue", "totalReturn", "totalRewards", "estApr"];
const DIRECTION_VALUES: DepositsSortDirection[] = ["asc", "desc"];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function pickEnum<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

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

export function parseDepositsListUrlState(searchParams: URLSearchParams): DepositsListUrlState {
  const defaults = createDefaultDepositsListUrlState();
  return {
    status: pickEnum(searchParams.get("status"), STATUS_VALUES, defaults.status),
    poolId: pickUuid(searchParams.get("poolId")),
    startDayUtc: pickDay(searchParams.get("startDayUtc")),
    endDayUtc: pickDay(searchParams.get("endDayUtc")),
    returnSign: pickEnum(searchParams.get("returnSign"), RETURN_SIGN_VALUES, defaults.returnSign),
    sort: pickEnum(searchParams.get("sort"), SORT_VALUES, defaults.sort),
    direction: pickEnum(searchParams.get("direction"), DIRECTION_VALUES, defaults.direction),
    page: pickInt(searchParams.get("page"), defaults.page, { min: 1, max: 10000 }),
    pageSize: pickInt(searchParams.get("pageSize"), defaults.pageSize, { min: 1, max: 100 }),
    selectedDepositId: pickUuid(searchParams.get("selectedDepositId")),
  };
}

export function serializeDepositsListUrlState(state: DepositsListUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultDepositsListUrlState();
  if (state.status !== defaults.status) params.set("status", state.status);
  if (state.poolId) params.set("poolId", state.poolId);
  if (state.startDayUtc) params.set("startDayUtc", state.startDayUtc);
  if (state.endDayUtc) params.set("endDayUtc", state.endDayUtc);
  if (state.returnSign !== defaults.returnSign) params.set("returnSign", state.returnSign);
  if (state.sort !== defaults.sort) params.set("sort", state.sort);
  if (state.direction !== defaults.direction) params.set("direction", state.direction);
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  if (state.selectedDepositId) params.set("selectedDepositId", state.selectedDepositId);
  return params.toString();
}

export function buildDepositsApiQueryString(input: {
  chainId: number;
  state: DepositsListUrlState;
}): string {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  if (input.state.status !== "all") params.set("status", input.state.status);
  if (input.state.poolId) params.set("poolId", input.state.poolId);
  if (input.state.startDayUtc) params.set("startDayUtc", input.state.startDayUtc);
  if (input.state.endDayUtc) params.set("endDayUtc", input.state.endDayUtc);
  if (input.state.returnSign !== "all") params.set("returnSign", input.state.returnSign);
  params.set("sort", input.state.sort);
  params.set("direction", input.state.direction);
  params.set("page", String(input.state.page));
  params.set("pageSize", String(input.state.pageSize));
  return params.toString();
}
