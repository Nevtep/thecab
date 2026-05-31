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
import { buildDepositsPoolHref } from "@/features/deposits/deposits.navigation";
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
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(selectedPoolId);
  const [collapsedSelectedPoolId, setCollapsedSelectedPoolId] = useState<string | null>(null);
  const [poolPageSize, setPoolPageSize] = useState(20);
  const [poolCursorStack, setPoolCursorStack] = useState<Array<string | null>>([null]);

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
      cursor: poolCursorStack[poolCursorStack.length - 1] ?? null,
      limit: poolPageSize,
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
  const expandedDetailQuery = usePoolDetailQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
      poolId: (selectedPoolId
        ? collapsedSelectedPoolId === selectedPoolId
          ? null
          : selectedPoolId
        : expandedPoolId) ?? "",
      range: detailRange,
    },
    {
      enabled: isWalletReady && Boolean(selectedPoolId
        ? collapsedSelectedPoolId === selectedPoolId
          ? null
          : selectedPoolId
        : expandedPoolId),
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
      queryKey: queryKeys.pools({
        chainId: resolvedChainId,
        walletAddress,
        filters: {
          ...filters,
          cursor: poolCursorStack[poolCursorStack.length - 1] ?? null,
          limit: poolPageSize,
        },
      }),
    });

    if (selectedPoolId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.poolDetail(resolvedChainId, selectedPoolId, detailRange),
      });
    }
  }, [analysisStatusQuery.data?.status, detailRange, filters, poolCursorStack, poolPageSize, queryClient, resolvedChainId, selectedPoolId, walletAddress]);

  const resolvedExpandedPoolId = selectedPoolId
    ? collapsedSelectedPoolId === selectedPoolId
      ? null
      : selectedPoolId
    : expandedPoolId;

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (poolsQuery.data ? mapPoolsListResponseToViewModel(poolsQuery.data, i18n.language) : null),
    [i18n.language, poolsQuery.data],
  );
  const poolsPagination = useMemo(() => {
    const page = poolCursorStack.length;
    const rowCountOnPage = viewModel?.items.length ?? 0;
    const hasMore = poolsQuery.data?.page.hasMore ?? false;

    return {
      page,
      pageSize: poolPageSize,
      totalRows: (page - 1) * poolPageSize + rowCountOnPage + (hasMore ? poolPageSize : 0),
      totalPages: hasMore ? page + 1 : Math.max(1, page),
      pageSizeOptions: [10, 20, 50],
    };
  }, [poolCursorStack.length, poolPageSize, poolsQuery.data?.page.hasMore, viewModel?.items.length]);
  const detailViewModel = useMemo(
    () => (detailQuery.data ? mapPoolDetailResponseToViewModel(detailQuery.data, i18n.language) : null),
    [detailQuery.data, i18n.language],
  );
  const expandedComposition = useMemo(() => {
    if (!resolvedExpandedPoolId || !expandedDetailQuery.data) {
      return null;
    }

    const vm = mapPoolDetailResponseToViewModel(expandedDetailQuery.data, i18n.language);
    return {
      poolId: resolvedExpandedPoolId,
      ...vm.composition,
    };
  }, [expandedDetailQuery.data, i18n.language, resolvedExpandedPoolId]);
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
        isRefreshing={poolsQuery.isFetching && !poolsQuery.isLoading}
        pagination={poolsPagination}
        detailPanel={selectedPoolId && detailScreenState ? {
          poolId: selectedPoolId,
          screenState: detailScreenState,
          viewModel: detailViewModel,
          errorCode: detailQuery.error instanceof Error ? detailQuery.error.message : null,
          range: detailRange,
          onRangeChange: setDetailRange,
          onOpenDeposits: () => router.push(buildDepositsPoolHref({ chainId: resolvedChainId, poolId: selectedPoolId })),
          onRetry: () => void detailQuery.refetch(),
          onClose: () => router.push("/pools"),
        } : null}
        onRetry={() => void poolsQuery.refetch()}
        onSearchChange={(value) => {
          startTransition(() => {
            setFilters((current) => ({ ...current, search: value }));
            setPoolCursorStack([null]);
          });
        }}
        onStatusChange={(value) => {
          startTransition(() => {
            setFilters((current) => ({ ...current, status: value }));
            setPoolCursorStack([null]);
          });
        }}
        onPageChange={(page) => {
          startTransition(() => {
            setPoolCursorStack((current) => {
              if (page <= 1) return [null];
              if (page < current.length) return current.slice(0, page);
              if (page === current.length + 1 && poolsQuery.data?.page.nextCursor) {
                return [...current, poolsQuery.data.page.nextCursor];
              }
              return current;
            });
          });
        }}
        onPageSizeChange={(pageSize) => {
          startTransition(() => {
            setPoolPageSize(pageSize);
            setPoolCursorStack([null]);
          });
        }}
        onSelectPool={(poolId) => router.push(`/pools/${poolId}`)}
        expandedPoolId={resolvedExpandedPoolId}
        onToggleExpand={(poolId) => {
          if (selectedPoolId === poolId) {
            setCollapsedSelectedPoolId((current) => (current === poolId ? null : poolId));
            return;
          }

          setExpandedPoolId((current) => (current === poolId ? null : poolId));
          setCollapsedSelectedPoolId(null);
        }}
        expandedComposition={expandedComposition}
        expandedCompositionIsLoading={Boolean(resolvedExpandedPoolId) && expandedDetailQuery.isLoading}
        expandedCompositionErrorCode={
          expandedDetailQuery.error instanceof Error ? expandedDetailQuery.error.message : null
        }
      />
    </ConnectedShell>
  );
}
