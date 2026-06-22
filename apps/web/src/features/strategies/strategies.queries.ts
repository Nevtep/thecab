import type { StrategiesListResponse, StrategyDetailResponse } from "@/features/strategies/strategies.types";
import type { StrategiesListUrlState } from "@/features/strategies/strategies.urlState";
import {
  buildStrategiesApiQueryString,
  normalizeStrategiesFiltersForQueryKey,
} from "@/features/strategies/strategies.urlState";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

export function getStrategiesListQueryOptions(input: {
  chainId: number;
  walletAddress: string;
  state: StrategiesListUrlState;
}) {
  return {
    queryKey: queryKeys.strategies({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: normalizeStrategiesFiltersForQueryKey(input.state),
    }),
    queryFn: () =>
      apiClient<StrategiesListResponse>(
        `/api/strategies?${buildStrategiesApiQueryString({ chainId: input.chainId, state: input.state })}`,
      ),
  };
}

export function getStrategyDetailQueryOptions(input: {
  chainId: number;
  strategyId: string;
}) {
  return {
    queryKey: queryKeys.strategyDetail(input.chainId, input.strategyId),
    queryFn: () =>
      apiClient<StrategyDetailResponse>(`/api/strategies/${encodeURIComponent(input.strategyId)}?chainId=${input.chainId}`),
  };
}
