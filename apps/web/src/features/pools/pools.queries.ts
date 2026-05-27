import { apiClient } from "@/queries/apiClient";

import type {
  PoolDetailRange,
  PoolDetailResponse,
  PoolsListFilters,
  PoolsListResponse,
} from "@/features/pools/pools.types";

export function createDefaultPoolsListFilters(): PoolsListFilters {
  return {
    status: "all",
    exposure: "all",
    coverage: "all",
    returnBand: "all",
    search: "",
    sort: "currentValue",
    direction: "desc",
  };
}

export function buildPoolsListQueryString(input: {
  chainId: number;
  filters: PoolsListFilters;
  cursor?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  params.set("status", input.filters.status);
  params.set("exposure", input.filters.exposure);
  params.set("coverage", input.filters.coverage);
  params.set("returnBand", input.filters.returnBand);
  params.set("sort", input.filters.sort);
  params.set("direction", input.filters.direction);

  if (input.filters.search.trim().length > 0) {
    params.set("search", input.filters.search.trim());
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (typeof input.limit === "number") {
    params.set("limit", String(input.limit));
  }

  return params.toString();
}

export function buildPoolDetailQueryString(input: {
  chainId: number;
  range: PoolDetailRange;
  timelineCursor?: string | null;
  timelineLimit?: number;
}) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  params.set("range", input.range);

  if (input.timelineCursor) {
    params.set("timelineCursor", input.timelineCursor);
  }

  if (typeof input.timelineLimit === "number") {
    params.set("timelineLimit", String(input.timelineLimit));
  }

  return params.toString();
}

export function fetchPoolsList(input: {
  chainId: number;
  filters: PoolsListFilters;
  cursor?: string | null;
  limit?: number;
}) {
  return apiClient<PoolsListResponse>(`/api/pools?${buildPoolsListQueryString(input)}`);
}

export function fetchPoolDetail(input: {
  chainId: number;
  poolId: string;
  range: PoolDetailRange;
  timelineCursor?: string | null;
  timelineLimit?: number;
}) {
  return apiClient<PoolDetailResponse>(
    `/api/pools/${input.poolId}?${buildPoolDetailQueryString(input)}`,
  );
}