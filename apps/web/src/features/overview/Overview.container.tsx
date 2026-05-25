"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { OverviewComponent } from "@/features/overview/Overview.component";
import {
  createInitialOverviewScreenState,
  normalizeOverviewRange,
  partitionOverviewAssetRows,
} from "@/features/overview/overview.mappers";
import type { OverviewRange } from "@/features/overview/overview.types";
import {
  useAnalysisStatusQuery,
  useOverviewActivityQuery,
  useOverviewChartQuery,
  useOverviewProtocolPositionsQuery,
  useOverviewQuery,
  useOverviewShellQuery,
  useSettingsQuery,
  useStartAnalysisMutation,
  useWarmOverviewMutation,
} from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

const ENABLE_OVERVIEW_WARMUP = false;

export function OverviewContainer() {
  const queryClient = useQueryClient();
  const { address, chainId, status, isConnected, isAuthenticated, isSupportedChain, connect, disconnect, switchToSupportedChain } = useCabWallet();
  const [screenState, setScreenState] = useState(() =>
    createInitialOverviewScreenState(address?.toLowerCase() ?? null, chainId ?? null),
  );
  const [showHiddenAssets, setShowHiddenAssets] = useState(false);
  const [showUnpricedAssets, setShowUnpricedAssets] = useState(false);
  const [showDustAssets, setShowDustAssets] = useState(false);
  const warmedSnapshotKeysRef = useRef<Set<string>>(new Set());
  const appliedPreferredRangeScopeRef = useRef<string | null>(null);

  const walletAddress = address?.toLowerCase() ?? null;
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = Boolean(walletAddress && isConnected && isAuthenticated && isSupportedChain);
  const settingsQuery = useSettingsQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
    },
    {
      enabled: isWalletReady,
    },
  );

  const shellQuery = useOverviewShellQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: isWalletReady,
    },
  );

  const enableSecondarySlices = isWalletReady && shellQuery.isSuccess;
  const enableTertiarySlices = enableSecondarySlices;

  const overviewQuery = useOverviewQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: enableSecondarySlices,
    },
  );
  const chartQuery = useOverviewChartQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: enableSecondarySlices,
    },
  );
  const activityQuery = useOverviewActivityQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: enableTertiarySlices,
    },
  );
  const protocolPositionsQuery = useOverviewProtocolPositionsQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: enableTertiarySlices,
    },
  );
  const analysisStatusQuery = useAnalysisStatusQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
    },
  );
  const startAnalysisMutation = useStartAnalysisMutation();
  const warmOverviewMutation = useWarmOverviewMutation();

  const shellViewModel = useMemo(
    () => shellQuery.data ?? overviewQuery.data ?? null,
    [overviewQuery.data, shellQuery.data],
  );
  const overviewViewModel = useMemo(() => overviewQuery.data ?? null, [overviewQuery.data]);
  const chartViewModel = useMemo(
    () => chartQuery.data ?? null,
    [chartQuery.data],
  );
  const isChartRefreshing =
    chartQuery.fetchStatus === "fetching" &&
    chartViewModel !== null &&
    chartViewModel.chart.range !== screenState.range;
  const activityViewModel = useMemo(
    () => activityQuery.data?.activity ?? overviewQuery.data?.activity ?? null,
    [activityQuery.data, overviewQuery.data],
  );
  const protocolPositionsViewModel = useMemo(
    () => protocolPositionsQuery.data ?? null,
    [protocolPositionsQuery.data],
  );
  const errorCode =
    shellQuery.error instanceof Error
      ? shellQuery.error.message
      : overviewQuery.error instanceof Error
        ? overviewQuery.error.message
        : null;
  const sectionsErrorCode = overviewQuery.error instanceof Error ? overviewQuery.error.message : null;
  const chartErrorCode = chartQuery.error instanceof Error ? chartQuery.error.message : null;
  const activityErrorCode = activityQuery.error instanceof Error ? activityQuery.error.message : null;
  const protocolPositionsErrorCode =
    protocolPositionsQuery.error instanceof Error ? protocolPositionsQuery.error.message : null;
  const analysis = analysisStatusQuery.data ?? shellViewModel?.analysis ?? null;
  const { visibleRows, hiddenRows } = useMemo(
    () => partitionOverviewAssetRows(overviewViewModel?.assets.rows ?? []),
    [overviewViewModel?.assets.rows],
  );

  useEffect(() => {
    if (!walletAddress || !settingsQuery.data) {
      return;
    }

    const scopeKey = `${walletAddress}:${resolvedChainId}`;

    if (appliedPreferredRangeScopeRef.current === scopeKey) {
      return;
    }

    appliedPreferredRangeScopeRef.current = scopeKey;
    startTransition(() => {
      setScreenState({
        walletAddress,
        chainId: resolvedChainId,
        range: normalizeOverviewRange(settingsQuery.data.preferences.defaultOverviewRange),
      });
    });
  }, [resolvedChainId, settingsQuery.data, walletAddress]);

  useEffect(() => {
    if (
      !ENABLE_OVERVIEW_WARMUP ||
      !walletAddress ||
      !isConnected ||
      !isSupportedChain ||
      !chartViewModel ||
      screenState.range !== "7d"
    ) {
      return;
    }

    for (const range of ["24h", "30d"] as const) {
      const warmupKey = `${walletAddress}:${resolvedChainId}:${range}`;
      if (warmedSnapshotKeysRef.current.has(warmupKey)) {
        continue;
      }

      warmedSnapshotKeysRef.current.add(warmupKey);
      warmOverviewMutation.mutate(
        {
          walletAddress,
          chainId: resolvedChainId,
          range,
        },
        {
          onError: () => {
            warmedSnapshotKeysRef.current.delete(warmupKey);
          },
        },
      );
    }
  }, [
    walletAddress,
    isConnected,
    isSupportedChain,
    chartViewModel,
    screenState.range,
    resolvedChainId,
    warmOverviewMutation,
  ]);

  function handleRangeChange(nextRange: OverviewRange) {
    startTransition(() => {
      setScreenState(() => ({
        walletAddress,
        chainId: resolvedChainId,
        range: normalizeOverviewRange(nextRange),
      }));
    });
  }

  function handleRefresh() {
    void shellQuery.refetch();
    void overviewQuery.refetch();
    void chartQuery.refetch();
    void activityQuery.refetch();
    void protocolPositionsQuery.refetch();
    void analysisStatusQuery.refetch();
  }

  async function invalidateOverviewSlices() {
    if (!walletAddress) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["overview", resolvedChainId, walletAddress] }),
      queryClient.invalidateQueries({ queryKey: ["overview-shell", resolvedChainId, walletAddress] }),
      queryClient.invalidateQueries({ queryKey: ["overview-activity", resolvedChainId, walletAddress] }),
      queryClient.invalidateQueries({ queryKey: ["overview-chart", resolvedChainId, walletAddress] }),
      queryClient.invalidateQueries({ queryKey: ["overview-protocol-positions", resolvedChainId, walletAddress] }),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.analysisStatus({ chainId: resolvedChainId, walletAddress }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings({ chainId: resolvedChainId, walletAddress }) }),
      invalidateOverviewSlices(),
    ]);
  }

  return (
    <OverviewComponent
      chainId={resolvedChainId}
      walletAddress={walletAddress}
      walletStatus={status}
      isConnected={isConnected && isAuthenticated}
      isSupportedChain={isSupportedChain}
      range={screenState.range}
      shellViewModel={shellViewModel}
      overviewViewModel={overviewViewModel}
      chartViewModel={chartViewModel}
      activityViewModel={activityViewModel}
      protocolPositionsViewModel={protocolPositionsViewModel}
      visibleAssetRows={visibleRows}
      hiddenAssetRows={hiddenRows}
      showHiddenAssets={showHiddenAssets}
      showUnpricedAssets={showUnpricedAssets}
      showDustAssets={showDustAssets}
      analysis={analysis}
      isShellLoading={shellQuery.isLoading}
      isOverviewSectionsLoading={overviewQuery.isLoading}
      isChartLoading={chartQuery.isLoading}
      isChartRefreshing={isChartRefreshing}
      isActivityLoading={activityQuery.isLoading}
      isProtocolPositionsLoading={protocolPositionsQuery.isLoading}
      isRefreshing={shellQuery.isFetching || overviewQuery.isFetching || chartQuery.isFetching || activityQuery.isFetching || protocolPositionsQuery.isFetching}
      isStartingAnalysis={startAnalysisMutation.isPending}
      errorCode={errorCode}
      sectionsErrorCode={sectionsErrorCode}
      chartErrorCode={chartErrorCode}
      activityErrorCode={activityErrorCode}
      protocolPositionsErrorCode={protocolPositionsErrorCode}
      isWarmingSnapshots={warmOverviewMutation.isPending}
      onConnect={() => void connect()}
      onDisconnect={() => void disconnect()}
      onSwitchChain={() => void switchToSupportedChain()}
      onRefresh={handleRefresh}
      onStartAnalysis={(mode) => void handleStartAnalysis(mode)}
      onRangeChange={handleRangeChange}
      onToggleHiddenAssets={(checked) => setShowHiddenAssets(checked)}
      onToggleUnpricedAssets={(checked) => setShowUnpricedAssets(checked)}
      onToggleDustAssets={(checked) => setShowDustAssets(checked)}
    />
  );
}