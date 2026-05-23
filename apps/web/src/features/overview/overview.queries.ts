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
  return buildOverviewScopedPath("", { walletAddress, chainId, range });
}

export function buildOverviewShellPath({ walletAddress, chainId, range }: OverviewQueryParams) {
  return buildOverviewScopedPath("/shell", { walletAddress, chainId, range });
}

export function buildOverviewActivityPath({ walletAddress, chainId, range }: OverviewQueryParams) {
  return buildOverviewScopedPath("/activity", { walletAddress, chainId, range });
}

export function buildOverviewChartPath({ walletAddress, chainId, range }: OverviewQueryParams) {
  return buildOverviewScopedPath("/chart", { walletAddress, chainId, range });
}

export function buildOverviewProtocolPositionsPath({ walletAddress, chainId, range }: OverviewQueryParams) {
  return buildOverviewScopedPath("/protocol-positions", { walletAddress, chainId, range });
}

function buildOverviewScopedPath(
  suffix: string,
  { walletAddress, chainId, range }: OverviewQueryParams,
) {
  const searchParams = new URLSearchParams({
    walletAddress,
    chainId: String(chainId),
    range,
  });

  return `/api/wallet/overview${suffix}?${searchParams.toString()}`;
}

export async function fetchOverview(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewPath(input));

  return mapOverviewResponseToViewModel(response);
}

export async function fetchOverviewShell(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewShellPath(input));

  return mapOverviewResponseToViewModel(response);
}

export async function fetchOverviewActivity(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewActivityPath(input));

  return mapOverviewResponseToViewModel(response);
}

export async function fetchOverviewChart(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewChartPath(input));

  return mapOverviewResponseToViewModel(response);
}

export async function fetchOverviewProtocolPositions(input: OverviewQueryInput) {
  const response = await apiClient<OverviewViewModel>(buildOverviewProtocolPositionsPath(input));

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
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  };
}

export function getOverviewShellQueryOptions(
  input: OverviewQueryInput,
): UseQueryOptions<OverviewViewModel, Error, OverviewViewModel, ReturnType<typeof queryKeys.overviewShell>> {
  return {
    queryKey: queryKeys.overviewShell(input),
    queryFn: () => fetchOverviewShell(input),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  };
}

export function getOverviewActivityQueryOptions(
  input: OverviewQueryInput,
): UseQueryOptions<OverviewViewModel, Error, OverviewViewModel, ReturnType<typeof queryKeys.overviewActivity>> {
  return {
    queryKey: queryKeys.overviewActivity(input),
    queryFn: () => fetchOverviewActivity(input),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  };
}

export function getOverviewChartQueryOptions(
  input: OverviewQueryInput,
): UseQueryOptions<OverviewViewModel, Error, OverviewViewModel, ReturnType<typeof queryKeys.overviewChart>> {
  return {
    queryKey: queryKeys.overviewChart(input),
    queryFn: () => fetchOverviewChart(input),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  };
}

export function getOverviewProtocolPositionsQueryOptions(
  input: OverviewQueryInput,
): UseQueryOptions<OverviewViewModel, Error, OverviewViewModel, ReturnType<typeof queryKeys.overviewProtocolPositions>> {
  return {
    queryKey: queryKeys.overviewProtocolPositions(input),
    queryFn: () => fetchOverviewProtocolPositions(input),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  };
}