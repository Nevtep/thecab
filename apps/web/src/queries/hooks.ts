import { useMutation, useQuery } from "@tanstack/react-query";

import { getOverviewQueryOptions } from "@/features/overview/overview.queries";
import type {
  OverviewAnalysisStatus,
  OverviewQueryInput,
} from "@/features/overview/overview.types";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

type WalletScopedInput = {
  chainId: number;
  walletAddress: string;
};

type AnalysisStatusResponse = {
  walletAddress: string;
  chainId: number;
  status: OverviewAnalysisStatus;
  runId: string | null;
  stage: string;
  progressPct: number;
  lastSuccessfulRunAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

type StartAnalysisResponse = {
  runId: string;
  walletAddress: string;
  chainId: number;
  status: OverviewAnalysisStatus;
  stage: string;
  progressPct: number;
  lastSuccessfulRunAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

export function useOverviewQuery(input: OverviewQueryInput, options?: { enabled?: boolean }) {
  return useQuery({
    ...getOverviewQueryOptions(input),
    enabled: (options?.enabled ?? true) && Boolean(input.walletAddress),
  });
}

export function useAnalysisStatusQuery(input: WalletScopedInput) {
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
  return useMutation<StartAnalysisResponse, Error, WalletScopedInput & { mode?: "full_history" | "incremental" }>({
    mutationFn: (input: WalletScopedInput & { mode?: "full_history" | "incremental" }) =>
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

export function usePoolsQuery(input: WalletScopedInput) {
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

export function useDepositsQuery(input: WalletScopedInput) {
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

export function useStrategiesQuery(input: WalletScopedInput) {
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

export function useRewardsQuery(input: WalletScopedInput) {
  return useQuery({
    queryKey: queryKeys.rewards(input),
    queryFn: () => apiClient(`/api/rewards?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useGovernanceQuery(input: WalletScopedInput) {
  return useQuery({
    queryKey: queryKeys.governance(input),
    queryFn: () => apiClient(`/api/governance?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useActivityQuery(input: WalletScopedInput) {
  return useQuery({
    queryKey: queryKeys.activity(input),
    queryFn: () => apiClient(`/api/activity?chainId=${input.chainId}`),
    enabled: false,
  });
}

export function useSettingsQuery(input: WalletScopedInput) {
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
