"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingsComponent } from "@/features/settings/Settings.component";
import { mapSettingsResponseToViewModel } from "@/features/settings/settings.mappers";
import { buildSettingsUpdateRequest } from "@/features/settings/settings.queries";
import type { SettingsResponse } from "@/features/settings/settings.types";
import { queryKeys } from "@/queries/keys";
import { useAnalysisStatusQuery, useSettingsQuery, useStartAnalysisMutation, useUpdateSettingsMutation, useWarmOverviewMutation } from "@/queries/hooks";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function SettingsContainer() {
  const { t, i18n } = useTranslation(["settings", "navigation", "wallet", "analysis", "overview"]);
  const queryClient = useQueryClient();
  const [pendingPreferenceKey, setPendingPreferenceKey] = useState<"languagePreference" | "defaultOverviewRange" | null>(null);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const {
    address,
    chainId,
    status,
    isConnected,
    isAuthenticated,
    isAuthReady,
    isSupportedChain,
    switchToSupportedChain,
    disconnect,
  } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const settingsQuery = useSettingsQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
    },
    {
      enabled: isWalletReady,
    },
  );
  const analysisStatusQuery = useAnalysisStatusQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
    },
    {
      enabled: isWalletReady,
    },
  );
  const startAnalysisMutation = useStartAnalysisMutation();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const warmOverviewMutation = useWarmOverviewMutation();

  const settingsResponse = useMemo<SettingsResponse | null>(() => {
    if (!settingsQuery.data) {
      return null;
    }

    if (!analysisStatusQuery.data) {
      return settingsQuery.data;
    }

    const liveAnalysis = analysisStatusQuery.data;

    return {
      ...settingsQuery.data,
      diagnostics: {
        ...settingsQuery.data.diagnostics,
        analysis: {
          status: liveAnalysis.status,
          runId: liveAnalysis.runId,
          lastSuccessfulRunAt: liveAnalysis.lastSuccessfulRunAt,
          lastUpdatedAt: liveAnalysis.lastUpdatedAt,
          lastError: liveAnalysis.lastError,
        },
        overviewFreshness: {
          label:
            liveAnalysis.status === "ready" || liveAnalysis.status === "stale"
              ? "analyzed_view"
              : "recent_view",
          lastAnalyzedAt: liveAnalysis.lastSuccessfulRunAt,
        },
      },
    };
  }, [analysisStatusQuery.data, settingsQuery.data]);

  useEffect(() => {
    const nextStatus = analysisStatusQuery.data?.status ?? null;
    const previousStatus = previousAnalysisStatusRef.current;

    previousAnalysisStatusRef.current = nextStatus;

    if (!walletAddress || !previousStatus || previousStatus === nextStatus) {
      return;
    }

    if (!isPendingAnalysisStatus(previousStatus) || !isSettledAnalysisStatus(nextStatus)) {
      return;
    }

    void Promise.all([
      ...queryKeys.overviewScope({ chainId: resolvedChainId, walletAddress })
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }) }),
    ]);
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, walletAddress]);

  async function invalidateConnectedOverviewSlices() {
    if (!walletAddress) {
      return;
    }

    await Promise.all([
      ...queryKeys.overviewScope({ chainId: resolvedChainId, walletAddress })
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ]);
  }

  async function handleStartAnalysis(mode: "full_history" | "incremental") {
    if (!walletAddress) {
      return;
    }

    await startAnalysisMutation.mutateAsync({
      walletAddress,
      chainId: resolvedChainId,
      mode,
    });

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysisStatus({ chainId: resolvedChainId, walletAddress }),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
      }),
      invalidateConnectedOverviewSlices(),
    ]);
  }

  async function handleRefreshOverview() {
    if (!walletAddress || !settingsResponse) {
      return;
    }

    await warmOverviewMutation.mutateAsync({
      walletAddress,
      chainId: resolvedChainId,
      range: settingsResponse.preferences.defaultOverviewRange,
    });

    await Promise.all([
      invalidateConnectedOverviewSlices(),
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
      }),
    ]);
  }

  async function handleLanguagePreferenceChange(nextLanguage: "en" | "es") {
    if (!walletAddress || !settingsResponse || nextLanguage === settingsResponse.preferences.languagePreference) {
      return;
    }

    setPendingPreferenceKey("languagePreference");

    try {
      const response = await updateSettingsMutation.mutateAsync(
        buildSettingsUpdateRequest({
          walletAddress,
          chainId: resolvedChainId,
          preferences: {
            languagePreference: nextLanguage,
          },
        }),
      );

      queryClient.setQueryData(
        queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
        response,
      );
      await i18n.changeLanguage(nextLanguage);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
      });
    } finally {
      setPendingPreferenceKey(null);
    }
  }

  async function handleOverviewRangeChange(nextRange: "24h" | "7d" | "30d") {
    if (!walletAddress || !settingsResponse || nextRange === settingsResponse.preferences.defaultOverviewRange) {
      return;
    }

    setPendingPreferenceKey("defaultOverviewRange");

    try {
      const response = await updateSettingsMutation.mutateAsync(
        buildSettingsUpdateRequest({
          walletAddress,
          chainId: resolvedChainId,
          preferences: {
            defaultOverviewRange: nextRange,
          },
        }),
      );

      queryClient.setQueryData(
        queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
        response,
      );
      await Promise.all([
        invalidateConnectedOverviewSlices(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }),
        }),
      ]);
    } finally {
      setPendingPreferenceKey(null);
    }
  }

  const viewModel = useMemo(
    () =>
      settingsResponse
        ? mapSettingsResponseToViewModel(settingsResponse, {
            locale: i18n.language,
            t,
            isRefreshingOverview: warmOverviewMutation.isPending,
            isStartingAnalysis: startAnalysisMutation.isPending,
            pendingPreferenceKey,
          })
        : null,
    [
      i18n.language,
      pendingPreferenceKey,
      settingsResponse,
      startAnalysisMutation.isPending,
      t,
      warmOverviewMutation.isPending,
    ],
  );

  return (
    <SettingsComponent
      walletStatus={status}
      isConnected={isConnected && isAuthenticated}
      isSupportedChain={isSupportedChain}
      viewModel={viewModel}
      isLoading={settingsQuery.isLoading}
      errorCode={settingsQuery.error instanceof Error ? settingsQuery.error.message : null}
      isRefreshingOverview={warmOverviewMutation.isPending}
      isStartingAnalysis={startAnalysisMutation.isPending}
      onRetry={() => void settingsQuery.refetch()}
      onLanguageChange={(language) => void handleLanguagePreferenceChange(language)}
      onDefaultOverviewRangeChange={(range) => void handleOverviewRangeChange(range)}
      onRefreshOverview={() => void handleRefreshOverview()}
      onDisconnect={() => void disconnect()}
      onStartAnalysis={(mode) => void handleStartAnalysis(mode)}
      onSwitchChain={() => void switchToSupportedChain()}
    />
  );
}
