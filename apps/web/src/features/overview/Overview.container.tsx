"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
  useStartAnalysisMutation,
  useWarmOverviewMutation,
} from "@/queries/hooks";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

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

  const walletAddress = address?.toLowerCase() ?? null;
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = Boolean(walletAddress && isConnected && isAuthenticated && isSupportedChain);

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
    if (
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

  async function handleStartAnalysis() {
    if (!walletAddress) {
      return;
    }

    await startAnalysisMutation.mutateAsync({
      walletAddress,
      chainId: resolvedChainId,
      mode: "full_history",
    });

    await Promise.all([
      shellQuery.refetch(),
      overviewQuery.refetch(),
      chartQuery.refetch(),
      activityQuery.refetch(),
      protocolPositionsQuery.refetch(),
      analysisStatusQuery.refetch(),
      queryClient.invalidateQueries(),
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
      isActivityLoading={activityQuery.isLoading}
      isProtocolPositionsLoading={protocolPositionsQuery.isLoading}
      isRefreshing={shellQuery.isFetching || overviewQuery.isFetching || chartQuery.isFetching || activityQuery.isFetching || protocolPositionsQuery.isFetching}
      errorCode={errorCode}
      sectionsErrorCode={sectionsErrorCode}
      chartErrorCode={chartErrorCode}
      activityErrorCode={activityErrorCode}
      protocolPositionsErrorCode={protocolPositionsErrorCode}
      isStartingAnalysis={startAnalysisMutation.isPending}
      isWarmingSnapshots={warmOverviewMutation.isPending}
      onConnect={() => void connect()}
      onDisconnect={() => void disconnect()}
      onSwitchChain={() => void switchToSupportedChain()}
      onRefresh={handleRefresh}
      onRangeChange={handleRangeChange}
      onStartAnalysis={() => void handleStartAnalysis()}
      onToggleHiddenAssets={(checked) => setShowHiddenAssets(checked)}
      onToggleUnpricedAssets={(checked) => setShowUnpricedAssets(checked)}
      onToggleDustAssets={(checked) => setShowDustAssets(checked)}
    />
  );
}