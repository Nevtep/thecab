"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  CabSidebar,
  CabSidebarNavItem,
  CabStack,
  CabText,
  CabTopNav,
  ConnectedShell,
} from "@/design-system";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { DepositsComponent, type DepositsScreenState } from "@/features/deposits/Deposits.component";
import { mapDepositsListResponseToViewModel } from "@/features/deposits/deposits.mappers";
import { getStrategiesListHref } from "@/features/deposits/deposits.navigation";
import type {
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
} from "@/features/deposits/deposits.types";
import {
  buildDepositsApiQueryString,
  createDefaultDepositsListUrlState,
  normalizeFiltersForQueryKey,
  parseDepositsListUrlState,
  serializeDepositsListUrlState,
  type DepositsListUrlState,
} from "@/features/deposits/deposits.urlState";
import { deriveDepositsScreenState } from "@/features/deposits/deposits.validation";
import { useDepositsViewPreferences } from "@/features/deposits/deposits.viewPrefs";
import { useAnalysisStatusQuery, useDepositsListQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function DepositsContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation(["deposits", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady =
    isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;

  const urlState = useMemo<DepositsListUrlState>(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    return parseDepositsListUrlState(params);
  }, [searchParams]);

  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );

  const depositsQuery = useDepositsListQuery(
    {
      chainId: resolvedChainId,
      walletAddress,
      state: urlState,
    },
    { enabled: isWalletReady },
  );

  const { preferences } = useDepositsViewPreferences({
    chainId: resolvedChainId,
    walletAddress,
  });

  const viewModel = useMemo(
    () => (depositsQuery.data ? mapDepositsListResponseToViewModel(depositsQuery.data) : null),
    [depositsQuery.data],
  );

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
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
      queryKey: queryKeys.deposits({
        chainId: resolvedChainId,
        walletAddress,
        filters: normalizeFiltersForQueryKey(urlState),
      }),
    });

    if (urlState.selectedDepositId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.depositDetail(resolvedChainId, urlState.selectedDepositId),
      });
    }
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, urlState, walletAddress]);

  const screenState: DepositsScreenState = useMemo(
    () => deriveDepositsScreenState({
      isWalletReady,
      analysisStatus: analysisStatusQuery.data?.status,
      analysisStatusIsLoading: analysisStatusQuery.isLoading,
      depositsIsLoading: depositsQuery.isLoading,
      depositsErrorCode: depositsQuery.error instanceof Error ? depositsQuery.error.message : null,
      totalCount: depositsQuery.data?.summary.totalCount ?? null,
    }),
    [
      analysisStatusQuery.data?.status,
      analysisStatusQuery.isLoading,
      depositsQuery.data?.summary.totalCount,
      depositsQuery.error,
      depositsQuery.isLoading,
      isWalletReady,
    ],
  );

  const pushUrlState = useCallback(
    (next: DepositsListUrlState) => {
      const queryString = serializeDepositsListUrlState(next);
      const href = queryString ? `/deposits?${queryString}` : "/deposits";
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const onStatusChange = useCallback(
    (value: DepositsStatusFilter) => {
      pushUrlState({ ...urlState, status: value, page: 1 });
    },
    [pushUrlState, urlState],
  );

  const onReturnSignChange = useCallback(
    (value: DepositsReturnSignFilter) => {
      pushUrlState({ ...urlState, returnSign: value, page: 1 });
    },
    [pushUrlState, urlState],
  );

  const onClearPool = useCallback(() => {
    pushUrlState({ ...urlState, poolId: null, page: 1 });
  }, [pushUrlState, urlState]);

  const onStartDayChange = useCallback((value: string | null) => {
    pushUrlState({ ...urlState, startDayUtc: value, page: 1 });
  }, [pushUrlState, urlState]);

  const onEndDayChange = useCallback((value: string | null) => {
    pushUrlState({ ...urlState, endDayUtc: value, page: 1 });
  }, [pushUrlState, urlState]);

  const onClearDateRange = useCallback(() => {
    pushUrlState({ ...urlState, startDayUtc: null, endDayUtc: null, page: 1 });
  }, [pushUrlState, urlState]);

  const onSortChange = useCallback(
    (sort: DepositsSortField, direction: DepositsSortDirection) => {
      pushUrlState({ ...urlState, sort, direction, page: 1 });
    },
    [pushUrlState, urlState],
  );

  const onPageChange = useCallback(
    (page: number) => {
      pushUrlState({ ...urlState, page });
    },
    [pushUrlState, urlState],
  );

  const onPageSizeChange = useCallback(
    (pageSize: number) => {
      pushUrlState({ ...urlState, pageSize, page: 1 });
    },
    [pushUrlState, urlState],
  );

  const onSelectRow = useCallback(
    (depositId: string) => {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        const currentQuery = serializeDepositsListUrlState(urlState);
        const returnTo = currentQuery ? `/deposits?${currentQuery}` : "/deposits";
        router.push(`/deposits/${depositId}?chainId=${resolvedChainId}&returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      pushUrlState({ ...urlState, selectedDepositId: depositId });
    },
    [pushUrlState, resolvedChainId, router, urlState],
  );

  const onCloseDetail = useCallback(() => {
    const selectedRow = typeof document !== "undefined"
      ? (document.querySelector('tr[aria-selected="true"]') as HTMLElement | null)
      : null;

    pushUrlState({ ...urlState, selectedDepositId: null });

    if (selectedRow) {
      requestAnimationFrame(() => {
        selectedRow.focus();
      });
    }
  }, [pushUrlState, urlState]);

  const onRetry = useCallback(() => {
    void depositsQuery.refetch();
  }, [depositsQuery]);

  const onOpenStrategies = useCallback(() => {
    const href = getStrategiesListHref();
    if (href) {
      router.push(href);
    }
  }, [router]);

  // Reference unused helper to indicate intentional API surface for downstream wiring.
  void buildDepositsApiQueryString;
  void createDefaultDepositsListUrlState;

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("deposits:title")}</CabText>}>
          <CabStack gap="$2">
            {navigationItems.map((item) => {
              const href = item.href;
              return (
                <CabSidebarNavItem
                  key={item.key}
                  iconName={item.iconName}
                  label={t(item.labelKey)}
                  state={item.stateKey}
                  stateLabel={
                    item.stateKey === "active"
                      ? undefined
                      : t(`navigation:states.${item.stateKey}`)
                  }
                  disabled={item.disabled}
                  onPress={href ? () => router.push(href) : undefined}
                />
              );
            })}
          </CabStack>
        </CabSidebar>
      }
      topBar={<CabTopNav title={t("deposits:title")} />}
    >
      <DepositsComponent
        screenState={screenState}
        viewModel={viewModel}
        locale={i18n.language}
        status={urlState.status}
        poolId={urlState.poolId}
        startDayUtc={urlState.startDayUtc}
        endDayUtc={urlState.endDayUtc}
        returnSign={urlState.returnSign}
        sort={urlState.sort}
        direction={urlState.direction}
        density={preferences.density}
        hiddenColumns={preferences.hiddenColumns}
        selectedDepositId={urlState.selectedDepositId}
        selectedDepositReturnTo={serializeDepositsListUrlState(urlState) ? `/deposits?${serializeDepositsListUrlState(urlState)}` : "/deposits"}
        errorCode={depositsQuery.error instanceof Error ? depositsQuery.error.message : null}
        isRefreshing={depositsQuery.isFetching && !depositsQuery.isLoading}
        onRetry={onRetry}
        onStatusChange={onStatusChange}
        onClearPool={onClearPool}
        onStartDayChange={onStartDayChange}
        onEndDayChange={onEndDayChange}
        onClearDateRange={onClearDateRange}
        onReturnSignChange={onReturnSignChange}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onSelectRow={onSelectRow}
        onCloseDetail={onCloseDetail}
        onOpenStrategies={onOpenStrategies}
      />
    </ConnectedShell>
  );
}
