import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

type ScopedInput = {
  chainId: number;
  walletAddress: string;
};

type AnalysisStatusResponse = {
  walletAddress: string;
  chainId: number;
  status: string;
  stage: string;
  progressPct: number;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

export function useOverviewQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.overview(input),
    queryFn: () => apiClient(`/api/wallet/overview?chainId=${input.chainId}`),
    enabled: Boolean(input.walletAddress),
  });
}

export function useAnalysisStatusQuery(input: ScopedInput) {
  return useQuery<AnalysisStatusResponse>({
    queryKey: queryKeys.analysisStatus(input),
    queryFn: () =>
      apiClient(
        `/api/analysis/status?walletAddress=${input.walletAddress}&chainId=${input.chainId}`,
      ),
    enabled: Boolean(input.walletAddress),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 10_000;
      if (data.status === "queued" || data.status === "running") return 10_000;
      return false;
    },
  });
}

export function useStartAnalysisMutation() {
  return useMutation({
    mutationFn: (input: ScopedInput & { mode?: "full_history" | "incremental" }) =>
      apiClient("/api/analysis/start", {
        method: "POST",
        body: {
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          mode: input.mode ?? "full_history",
        },
      }),
  });
}

export function usePoolsQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.pools(input),
    queryFn: () => apiClient(`/api/pools?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function usePoolDetailQuery(chainId: number, poolId: string) {
  return useQuery({
    queryKey: queryKeys.poolDetail(chainId, poolId),
    queryFn: () => apiClient(`/api/pools/${poolId}?chainId=${chainId}`),
    enabled: false,
  });
}

export function useDepositsQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.deposits(input),
    queryFn: () => apiClient(`/api/deposits?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useDepositDetailQuery(chainId: number, depositId: string) {
  return useQuery({
    queryKey: queryKeys.depositDetail(chainId, depositId),
    queryFn: () => apiClient(`/api/deposits/${depositId}?chainId=${chainId}`),
    enabled: false,
  });
}

export function useStrategiesQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.strategies(input),
    queryFn: () => apiClient(`/api/strategies?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useStrategyDetailQuery(chainId: number, strategyId: string) {
  return useQuery({
    queryKey: queryKeys.strategyDetail(chainId, strategyId),
    queryFn: () => apiClient(`/api/strategies/${strategyId}?chainId=${chainId}`),
    enabled: false,
  });
}

export function useRewardsQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.rewards(input),
    queryFn: () => apiClient(`/api/rewards?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useGovernanceQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.governance(input),
    queryFn: () => apiClient(`/api/governance?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useActivityQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.activity(input),
    queryFn: () => apiClient(`/api/activity?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useSettingsQuery(input: ScopedInput) {
  return useQuery({
    queryKey: queryKeys.settings(input),
    queryFn: () => apiClient(`/api/settings?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useUpdateSettingsMutation() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient("/api/settings", {
        method: "POST",
        body: payload,
      }),
  });
}
