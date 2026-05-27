import type {
  PoolDetailRange,
  PoolDetailResponse,
  PoolsCoverageFilter,
  PoolsExposureFilter,
  PoolsListResponse,
  PoolsReturnBandFilter,
  PoolsSortDirection,
  PoolsSortField,
  PoolsStatusFilter,
} from "@/server/pools/pools.types";

export type PoolsScreenState = "loading" | "ready" | "empty" | "error" | "locked";

export type PoolsListFilters = {
  status: PoolsStatusFilter;
  exposure: PoolsExposureFilter;
  coverage: PoolsCoverageFilter;
  returnBand: PoolsReturnBandFilter;
  search: string;
  sort: PoolsSortField;
  direction: PoolsSortDirection;
};

export type PoolsListViewModel = ReturnType<typeof import("@/features/pools/pools.mappers").mapPoolsListResponseToViewModel>;
export type PoolDetailViewModel = ReturnType<typeof import("@/features/pools/pools.mappers").mapPoolDetailResponseToViewModel>;

export type { PoolDetailRange, PoolDetailResponse, PoolsListResponse };