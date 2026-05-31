import { useMutation, useQuery } from "@tanstack/react-query";

import type { AnalysisMode, AnalysisStatus, AnalysisStatusResponse } from "@/analysis/analysisStatus";
import { getActivityQueryOptions } from "@/features/activity/activity.queries";
import type { ActivityViewModel, ActivityUrlState } from "@/features/activity/activity.types";
import type { DepositDetailResponse, DepositsListResponse } from "@/features/deposits/deposits.types";
import type {
  DepositsListUrlState,
} from "@/features/deposits/deposits.urlState";
import { buildDepositsApiQueryString, normalizeFiltersForQueryKey } from "@/features/deposits/deposits.urlState";
import type { PoolDetailRange, PoolDetailResponse, PoolsListFilters, PoolsListResponse } from "@/features/pools/pools.types";
import {
  getStrategiesListQueryOptions,
  getStrategyDetailQueryOptions,
} from "@/features/strategies/strategies.queries";
import { getRewardsQueryOptions } from "@/features/rewards/rewards.queries";
import type { RewardsResponse, RewardsUrlState } from "@/features/rewards/rewards.types";
import type { StrategiesListResponse, StrategyDetailResponse } from "@/features/strategies/strategies.types";
import type { StrategiesListUrlState } from "@/features/strategies/strategies.urlState";
import type { SettingsResponse, SettingsUpdateRequest } from "@/features/settings/settings.types";
import {
  getOverviewActivityQueryOptions,
  getOverviewChartQueryOptions,
  getOverviewProtocolPositionsQueryOptions,
  getOverviewQueryOptions,
  getOverviewShellQueryOptions,
} from "@/features/overview/overview.queries";
import { buildPoolDetailQueryString, buildPoolsListQueryString } from "@/features/pools/pools.queries";
import type {
  OverviewQueryInput,
  OverviewRange,
} from "@/features/overview/overview.types";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

type WalletScopedInput = {
  chainId: number;
  walletAddress: string;
};

type StartAnalysisResponse = {
  runId: string;
  walletAddress: string;
  chainId: number;
  status: AnalysisStatus;
  stage: string;
  progressPct: number;
  lastSuccessfulRunAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

type WarmOverviewResponse = {
  status: "queued" | "already_running";
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
};

export function useOverviewQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useOverviewShellQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewShellQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useOverviewActivityQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewActivityQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useOverviewChartQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewChartQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useOverviewProtocolPositionsQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewProtocolPositionsQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useAnalysisStatusQuery(input: WalletScopedInput, options?: { enabled?: boolean }) {
  return useQuery<AnalysisStatusResponse>({
    queryKey: queryKeys.analysisStatus(input),
    queryFn: () =>
      apiClient(
        `/api/analysis/status?walletAddress=${input.walletAddress}&chainId=${input.chainId}`,
      ),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 10_000;
      if (data.status === "queued" || data.status === "running") return 10_000;
      return false;
    },
  });
}

export function useStartAnalysisMutation() {
  return useMutation<StartAnalysisResponse, Error, WalletScopedInput & { mode?: AnalysisMode }>({
    mutationFn: (input: WalletScopedInput & { mode?: AnalysisMode }) =>
      apiClient<StartAnalysisResponse>("/api/analysis/start", {
        method: "POST",
        body: {
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          mode: input.mode ?? "full_history",
        },
      }),
  });
}

export function useWarmOverviewMutation() {
  return useMutation<WarmOverviewResponse, Error, WalletScopedInput & { range: OverviewRange }>({
    mutationFn: (input) =>
      apiClient<WarmOverviewResponse>("/api/wallet/overview/warmup", {
        method: "POST",
        body: input,
      }),
  });
}

export function usePoolsQuery(
  input: WalletScopedInput & { filters: PoolsListFilters; cursor?: string | null; limit?: number },
  options?: { enabled?: boolean },
) {
  return useQuery<PoolsListResponse>({
    queryKey: queryKeys.pools({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: { ...input.filters, cursor: input.cursor ?? null, limit: input.limit ?? null },
    }),
    queryFn: () =>
      apiClient(`/api/pools?${buildPoolsListQueryString({
        chainId: input.chainId,
        filters: input.filters,
        cursor: input.cursor,
        limit: input.limit,
      })}`),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function usePoolDetailQuery(
  input: WalletScopedInput & { poolId: string; range: PoolDetailRange },
  options?: { enabled?: boolean },
) {
  return useQuery<PoolDetailResponse>({
    queryKey: queryKeys.poolDetail(input.chainId, input.poolId, input.range),
    queryFn: () =>
      apiClient(
        `/api/pools/${input.poolId}?${buildPoolDetailQueryString({ chainId: input.chainId, range: input.range })}`,
      ),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress) && Boolean(input.poolId),
  });
}

export function useDepositsQuery(input: WalletScopedInput) {
  return useQuery({
    queryKey: queryKeys.deposits(input),
    queryFn: () => apiClient(`/api/deposits?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useDepositsListQuery(
  input: WalletScopedInput & { state: DepositsListUrlState },
  options?: { enabled?: boolean },
) {
  return useQuery<DepositsListResponse>({
    queryKey: queryKeys.deposits({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: normalizeFiltersForQueryKey(input.state),
    }),
    queryFn: () =>
      apiClient<DepositsListResponse>(
        `/api/deposits?${buildDepositsApiQueryString({ chainId: input.chainId, state: input.state })}`,
      ),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useDepositDetailQuery(chainId: number, depositId: string) {
  return useQuery({
    queryKey: queryKeys.depositDetail(chainId, depositId),
    queryFn: () => apiClient(`/api/deposits/${depositId}?chainId=${chainId}`),
    enabled: false,
  });
}

export function useDepositDetailViewQuery(
  input: WalletScopedInput & { depositId: string | null },
  options?: { enabled?: boolean },
) {
  return useQuery<DepositDetailResponse>({
    queryKey: queryKeys.depositDetail(input.chainId, input.depositId ?? ""),
    queryFn: () =>
      apiClient<DepositDetailResponse>(`/api/deposits/${input.depositId}?chainId=${input.chainId}`),
    enabled:
      (options?.enabled ?? true) && Boolean(input.walletAddress) && Boolean(input.depositId),
  });
}

export function useStrategiesQuery(
  input: WalletScopedInput & { state: StrategiesListUrlState },
  options?: { enabled?: boolean },
) {
  return useQuery<StrategiesListResponse>({
    ...getStrategiesListQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useStrategyDetailQuery(
  input: WalletScopedInput & { strategyId: string | null },
  options?: { enabled?: boolean },
) {
  return useQuery<StrategyDetailResponse>({
    ...getStrategyDetailQueryOptions({
      chainId: input.chainId,
      strategyId: input.strategyId ?? "",
    }),
    enabled:
      (options?.enabled ?? true) && Boolean(input.walletAddress) && Boolean(input.strategyId),
  });
}

export function useRewardsQuery(
  input: WalletScopedInput & { state: RewardsUrlState },
  options?: { enabled?: boolean },
) {
  return useQuery<RewardsResponse>({
    ...getRewardsQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useGovernanceQuery(input: WalletScopedInput) {
  return useQuery({
    queryKey: queryKeys.governance(input),
    queryFn: () => apiClient(`/api/governance?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useActivityQuery(
  input: WalletScopedInput & { state: ActivityUrlState },
  options?: { enabled?: boolean },
) {
  return useQuery<ActivityViewModel>({
    ...getActivityQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useSettingsQuery(input: WalletScopedInput, options?: { enabled?: boolean }) {
  return useQuery<SettingsResponse>({
    queryKey: queryKeys.settings(input),
    queryFn: () =>
      apiClient<SettingsResponse>(
        `/api/settings?walletAddress=${input.walletAddress}&chainId=${input.chainId}`,
      ),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
    staleTime: 30_000,
  });
}

export function useUpdateSettingsMutation() {
  return useMutation<SettingsResponse, Error, SettingsUpdateRequest>({
    mutationFn: (payload: SettingsUpdateRequest) =>
      apiClient<SettingsResponse>("/api/settings", {
        method: "POST",
        body: payload,
      }),
  });
}
