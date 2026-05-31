"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { ActivityComponent } from "@/features/activity/Activity.component";
import { mapActivityResponseToViewModel } from "@/features/activity/activity.mappers";
import {
  createDefaultActivityUrlState,
  parseActivityUrlState,
  resetActivityFilter,
  serializeActivityUrlState,
} from "@/features/activity/activity.urlState";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { useActivityQuery, useAnalysisStatusQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function ActivityContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["activity", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const urlState = useMemo(() => parseActivityUrlState(searchParams), [searchParams]);

  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const activityQuery = useActivityQuery(
    { walletAddress, chainId: resolvedChainId, state: urlState },
    { enabled: isWalletReady },
  );

  useEffect(() => {
    const nextStatus = analysisStatusQuery.data?.status ?? null;
    const previousStatus = previousAnalysisStatusRef.current;
    previousAnalysisStatusRef.current = nextStatus;
    if (!walletAddress || !previousStatus || previousStatus === nextStatus) return;
    if (!isPendingAnalysisStatus(previousStatus) || !isSettledAnalysisStatus(nextStatus)) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.activity({ chainId: resolvedChainId, walletAddress }),
    });
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, walletAddress]);

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (activityQuery.data ? mapActivityResponseToViewModel(activityQuery.data) : null),
    [activityQuery.data],
  );
  const screenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || activityQuery.isLoading) return "loading" as const;
    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }
    if (activityQuery.error) return "error" as const;
    if (!viewModel || viewModel.screenKind === "locked") return "locked" as const;
    if (viewModel.screenKind === "empty") return "empty" as const;
    return "ready" as const;
  }, [activityQuery.error, activityQuery.isLoading, analysisStatusQuery.data, analysisStatusQuery.isLoading, isWalletReady, viewModel]);

  function updateUrl(nextState: typeof urlState) {
    const query = serializeActivityUrlState(nextState);
    router.replace(query ? `/activity?${query}` : "/activity", { scroll: false });
  }

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("activity:title")}</CabText>}>
          <CabStack gap="$2">
            {navigationItems.map((item) => (
              <CabSidebarNavItem
                key={item.key}
                iconName={item.iconName}
                label={t(item.labelKey)}
                state={item.stateKey}
                stateLabel={item.stateKey === "active" ? undefined : t(`navigation:states.${item.stateKey}`)}
                disabled={item.disabled}
                onPress={item.href ? () => router.push(item.href as string) : undefined}
              />
            ))}
          </CabStack>
        </CabSidebar>
      }
      topBar={<CabTopNav title={t("activity:title")} />}
    >
      <ActivityComponent
        screenState={screenState}
        viewModel={viewModel}
        urlState={urlState}
        errorCode={activityQuery.error instanceof Error ? activityQuery.error.message : null}
        isRefreshing={activityQuery.isFetching && !activityQuery.isLoading}
        onRetry={() => void activityQuery.refetch()}
        onStateChange={(nextState) => startTransition(() => updateUrl(nextState))}
        onClearFilter={(target) => startTransition(() => updateUrl(resetActivityFilter(urlState, target)))}
        onClearAll={() => startTransition(() => updateUrl(createDefaultActivityUrlState()))}
        onOpenHref={(href) => router.push(href)}
      />
    </ConnectedShell>
  );
}
