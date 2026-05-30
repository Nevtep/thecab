"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { StrategiesComponent } from "@/features/strategies/Strategies.component";
import { mapStrategiesListResponseToViewModel } from "@/features/strategies/strategies.mappers";
import {
  createDefaultStrategiesListUrlState,
  parseStrategiesListUrlState,
  serializeStrategiesListUrlState,
} from "@/features/strategies/strategies.urlState";
import { useAnalysisStatusQuery, useStrategiesQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function StrategiesContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["strategies", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const urlState = useMemo(
    () => parseStrategiesListUrlState(searchParams),
    [searchParams],
  );

  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const strategiesQuery = useStrategiesQuery(
    { walletAddress, chainId: resolvedChainId, state: urlState },
    { enabled: isWalletReady },
  );

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

    void queryClient.invalidateQueries({
      queryKey: queryKeys.strategies({
        chainId: resolvedChainId,
        walletAddress,
      }),
    });
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, walletAddress]);

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (strategiesQuery.data ? mapStrategiesListResponseToViewModel(strategiesQuery.data) : null),
    [strategiesQuery.data],
  );
  const screenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || strategiesQuery.isLoading) {
      return "loading" as const;
    }

    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }

    if (strategiesQuery.error) {
      return strategiesQuery.error instanceof Error && strategiesQuery.error.message === "analysis_not_ready"
        ? "locked"
        : "error";
    }

    if (!strategiesQuery.data || strategiesQuery.data.strategies.length === 0) {
      return "empty" as const;
    }

    return "ready" as const;
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, isWalletReady, strategiesQuery.data, strategiesQuery.error, strategiesQuery.isLoading]);

  function updateUrl(nextState: typeof urlState) {
    const query = serializeStrategiesListUrlState(nextState);
    router.replace(query ? `/strategies?${query}` : "/strategies");
  }

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("strategies:title")}</CabText>}>
          <CabStack gap="$2">
            {navigationItems.map((item) => {
              const href = item.href;
              return (
                <CabSidebarNavItem
                  key={item.key}
                  iconName={item.iconName}
                  label={t(item.labelKey)}
                  state={item.stateKey}
                  stateLabel={item.stateKey === "active" ? undefined : t(`navigation:states.${item.stateKey}`)}
                  disabled={item.disabled}
                  onPress={href ? () => router.push(href) : undefined}
                />
              );
            })}
          </CabStack>
        </CabSidebar>
      }
      topBar={<CabTopNav title={t("strategies:title")} />}
    >
      <StrategiesComponent
        screenState={screenState}
        viewModel={viewModel}
        urlState={urlState}
        errorCode={strategiesQuery.error instanceof Error ? strategiesQuery.error.message : null}
        onRetry={() => void strategiesQuery.refetch()}
        onSearchChange={(value) => {
          startTransition(() => updateUrl({ ...urlState, search: value, page: 1 }));
        }}
        onStatusChange={(status) => {
          startTransition(() => updateUrl({ ...urlState, status, page: 1 }));
        }}
        onProtocolChange={(protocol) => {
          startTransition(() => updateUrl({ ...urlState, protocol, page: 1 }));
        }}
        onCoverageChange={(coverage) => {
          startTransition(() => updateUrl({ ...urlState, coverage, page: 1 }));
        }}
        onReturnSignChange={(returnSign) => {
          startTransition(() => updateUrl({ ...urlState, returnSign, page: 1 }));
        }}
        onSortChange={(sort) => {
          startTransition(() => updateUrl({ ...urlState, sort, page: 1 }));
        }}
        onClearPool={() => {
          startTransition(() => updateUrl({ ...urlState, poolId: null, page: 1 }));
        }}
        onClearFilters={() => {
          const defaults = createDefaultStrategiesListUrlState();
          startTransition(() => updateUrl({
            ...defaults,
            selectedStrategyId: urlState.selectedStrategyId,
          }));
        }}
        onSelectStrategy={(strategyExposureId) => {
          startTransition(() => updateUrl({ ...urlState, selectedStrategyId: strategyExposureId }));
        }}
        onOpenPool={(poolId) => {
          router.push(`/pools/${poolId}`);
        }}
      />
    </ConnectedShell>
  );
}
