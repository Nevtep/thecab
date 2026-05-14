import type { UseQueryOptions } from "@tanstack/react-query";

import { mapOverviewResponseToViewModel } from "@/features/overview/overview.mappers";
import type { OverviewQueryInput, OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

export type OverviewQueryParams = {
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
};

export function buildOverviewPath({ walletAddress, chainId, range }: OverviewQueryParams) {
  const searchParams = new URLSearchParams({
    walletAddress,
    chainId: String(chainId),
    range,
  });

  return `/api/wallet/overview?${searchParams.toString()}`;
}

export async function fetchOverview(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewPath(input));

  return mapOverviewResponseToViewModel(response);
}

export function getOverviewQueryKey({ walletAddress, chainId, range }: OverviewQueryParams) {
  return ["overview", chainId, walletAddress, range] as const;
}

export function getOverviewQueryOptions(
  input: OverviewQueryInput,
): UseQueryOptions<OverviewViewModel, Error, OverviewViewModel, ReturnType<typeof queryKeys.overview>> {
  return {
    queryKey: queryKeys.overview(input),
    queryFn: () => fetchOverview(input),
    staleTime: 30_000,
  };
}