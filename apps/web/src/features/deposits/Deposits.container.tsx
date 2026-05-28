"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
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
import type {
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
} from "@/features/deposits/deposits.types";
import {
  buildDepositsApiQueryString,
  createDefaultDepositsListUrlState,
  parseDepositsListUrlState,
  serializeDepositsListUrlState,
  type DepositsListUrlState,
} from "@/features/deposits/deposits.urlState";
import { useDepositsViewPreferences } from "@/features/deposits/deposits.viewPrefs";
import { useAnalysisStatusQuery, useDepositsListQuery } from "@/queries/hooks";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

export function DepositsContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation(["deposits", "navigation"]);
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

  const screenState: DepositsScreenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || depositsQuery.isLoading) {
      return "loading";
    }

    const status = analysisStatusQuery.data?.status;
    if (status && status !== "ready" && status !== "stale") {
      return "locked";
    }

    if (depositsQuery.error) {
      return depositsQuery.error instanceof Error && depositsQuery.error.message === "analysis_required"
        ? "locked"
        : "error";
    }

    if (!depositsQuery.data || depositsQuery.data.items.length === 0) {
      return "empty";
    }

    return "ready";
  }, [
    analysisStatusQuery.data?.status,
    analysisStatusQuery.isLoading,
    depositsQuery.data,
    depositsQuery.error,
    depositsQuery.isLoading,
    isWalletReady,
  ]);

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

  const onSortChange = useCallback(
    (sort: DepositsSortField, direction: DepositsSortDirection) => {
      pushUrlState({ ...urlState, sort, direction });
    },
    [pushUrlState, urlState],
  );

  const onSelectRow = useCallback(
    (depositId: string) => {
      pushUrlState({ ...urlState, selectedDepositId: depositId });
    },
    [pushUrlState, urlState],
  );

  const onRetry = useCallback(() => {
    void depositsQuery.refetch();
  }, [depositsQuery]);

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
        returnSign={urlState.returnSign}
        sort={urlState.sort}
        direction={urlState.direction}
        density={preferences.density}
        hiddenColumns={preferences.hiddenColumns}
        selectedDepositId={urlState.selectedDepositId}
        errorCode={depositsQuery.error instanceof Error ? depositsQuery.error.message : null}
        onRetry={onRetry}
        onStatusChange={onStatusChange}
        onReturnSignChange={onReturnSignChange}
        onSortChange={onSortChange}
        onSelectRow={onSelectRow}
      />
    </ConnectedShell>
  );
}
