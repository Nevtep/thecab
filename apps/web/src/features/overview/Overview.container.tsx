"use client";

import { startTransition, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { OverviewComponent } from "@/features/overview/Overview.component";
import {
  createInitialOverviewScreenState,
  normalizeOverviewRange,
  partitionOverviewAssetRows,
} from "@/features/overview/overview.mappers";
import type { OverviewRange } from "@/features/overview/overview.types";
import { useAnalysisStatusQuery, useOverviewQuery, useStartAnalysisMutation } from "@/queries/hooks";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

export function OverviewContainer() {
  const queryClient = useQueryClient();
  const { address, chainId, isConnected, isSupportedChain, connect, switchToSupportedChain } = useCabWallet();
  const [screenState, setScreenState] = useState(() =>
    createInitialOverviewScreenState(address?.toLowerCase() ?? null, chainId ?? null),
  );
  const [showHiddenAssets, setShowHiddenAssets] = useState(false);
  const [showUnpricedAssets, setShowUnpricedAssets] = useState(false);
  const [showDustAssets, setShowDustAssets] = useState(false);

  const walletAddress = address?.toLowerCase() ?? null;
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const overviewQuery = useOverviewQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
      range: screenState.range,
    },
    {
      enabled: Boolean(walletAddress && isConnected && isSupportedChain),
    },
  );
  const analysisStatusQuery = useAnalysisStatusQuery(
    {
      walletAddress: walletAddress ?? "",
      chainId: resolvedChainId,
    },
  );
  const startAnalysisMutation = useStartAnalysisMutation();

  const viewModel = useMemo(() => overviewQuery.data ?? null, [overviewQuery.data]);
  const errorCode = overviewQuery.error instanceof Error ? overviewQuery.error.message : null;
  const analysis = analysisStatusQuery.data ?? viewModel?.analysis ?? null;
  const { visibleRows, hiddenRows } = useMemo(
    () => partitionOverviewAssetRows(viewModel?.assets.rows ?? []),
    [viewModel?.assets.rows],
  );

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
    void overviewQuery.refetch();
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
      overviewQuery.refetch(),
      analysisStatusQuery.refetch(),
      queryClient.invalidateQueries(),
    ]);
  }

  return (
    <OverviewComponent
      chainId={resolvedChainId}
      walletAddress={walletAddress}
      isConnected={isConnected}
      isSupportedChain={isSupportedChain}
      range={screenState.range}
      viewModel={viewModel}
      visibleAssetRows={visibleRows}
      hiddenAssetRows={hiddenRows}
      showHiddenAssets={showHiddenAssets}
      showUnpricedAssets={showUnpricedAssets}
      showDustAssets={showDustAssets}
      analysis={analysis}
      isLoading={overviewQuery.isLoading}
      isRefreshing={overviewQuery.isFetching}
      errorCode={errorCode}
      isStartingAnalysis={startAnalysisMutation.isPending}
      onConnect={() => void connect()}
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