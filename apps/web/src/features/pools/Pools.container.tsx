"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { PoolsComponent } from "@/features/pools/Pools.component";
import { mapPoolDetailResponseToViewModel, mapPoolsListResponseToViewModel } from "@/features/pools/pools.mappers";
import { createDefaultPoolsListFilters } from "@/features/pools/pools.queries";
import type { PoolDetailRange } from "@/features/pools/pools.types";
import { useAnalysisStatusQuery, usePoolDetailQuery, usePoolsQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function PoolsContainer({ selectedPoolId = null }: { selectedPoolId?: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation(["pools", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();
  const [filters, setFilters] = useState(() => createDefaultPoolsListFilters());
  const [detailRange, setDetailRange] = useState<PoolDetailRange>("90d");

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const analysisStatusQuery = useAnalysisStatusQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
    },
    {
      enabled: isWalletReady,
    },
  );
  const poolsQuery = usePoolsQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
      filters,
    },
    {
      enabled: isWalletReady,
    },
  );
  const detailQuery = usePoolDetailQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
      poolId: selectedPoolId ?? "",
      range: detailRange,
    },
    {
      enabled: isWalletReady && Boolean(selectedPoolId),
    },
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
      queryKey: queryKeys.pools({ chainId: resolvedChainId, walletAddress, filters }),
    });

    if (selectedPoolId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.poolDetail(resolvedChainId, selectedPoolId, detailRange),
      });
    }
  }, [analysisStatusQuery.data?.status, detailRange, filters, queryClient, resolvedChainId, selectedPoolId, walletAddress]);

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (poolsQuery.data ? mapPoolsListResponseToViewModel(poolsQuery.data, i18n.language) : null),
    [i18n.language, poolsQuery.data],
  );
  const detailViewModel = useMemo(
    () => (detailQuery.data ? mapPoolDetailResponseToViewModel(detailQuery.data, i18n.language) : null),
    [detailQuery.data, i18n.language],
  );
  const screenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || poolsQuery.isLoading) {
      return "loading" as const;
    }

    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }

    if (poolsQuery.error) {
      return poolsQuery.error instanceof Error && poolsQuery.error.message === "analysis_required"
        ? "locked"
        : "error" as const;
    }

    if (!poolsQuery.data || poolsQuery.data.items.length === 0) {
      return "empty" as const;
    }

    return "ready" as const;
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, isWalletReady, poolsQuery.data, poolsQuery.error, poolsQuery.isLoading]);
  const detailScreenState = useMemo(() => {
    if (!selectedPoolId) {
      return null;
    }

    if (!isWalletReady || analysisStatusQuery.isLoading || detailQuery.isLoading) {
      return "loading" as const;
    }

    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }

    if (detailQuery.error) {
      return detailQuery.error instanceof Error && detailQuery.error.message === "analysis_required"
        ? "locked"
        : "error" as const;
    }

    return "ready" as const;
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, detailQuery.error, detailQuery.isLoading, isWalletReady, selectedPoolId]);

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("pools:title")}</CabText>}>
          <CabStack gap="$2">
            {navigationItems.map((item) => (
              (() => {
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
              })()
            ))}
          </CabStack>
        </CabSidebar>
      }
      topBar={<CabTopNav title={t("pools:title")} />}
    >
      <PoolsComponent
        screenState={screenState}
        viewModel={viewModel}
        filters={filters}
        selectedPoolId={selectedPoolId}
        errorCode={poolsQuery.error instanceof Error ? poolsQuery.error.message : null}
        detailPanel={selectedPoolId && detailScreenState ? {
          poolId: selectedPoolId,
          screenState: detailScreenState,
          viewModel: detailViewModel,
          errorCode: detailQuery.error instanceof Error ? detailQuery.error.message : null,
          range: detailRange,
          onRangeChange: setDetailRange,
          onRetry: () => void detailQuery.refetch(),
          onClose: () => router.push("/pools"),
        } : null}
        onRetry={() => void poolsQuery.refetch()}
        onSearchChange={(value) => {
          startTransition(() => {
            setFilters((current) => ({ ...current, search: value }));
          });
        }}
        onStatusChange={(value) => {
          startTransition(() => {
            setFilters((current) => ({ ...current, status: value }));
          });
        }}
        onSelectPool={(poolId) => router.push(`/pools/${poolId}`)}
      />
    </ConnectedShell>
  );
}