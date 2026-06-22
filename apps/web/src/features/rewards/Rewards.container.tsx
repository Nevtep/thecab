"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { RewardsComponent } from "@/features/rewards/Rewards.component";
import { resetRewardsFilter } from "@/features/rewards/rewards.filters";
import { mapRewardsResponseToViewModel } from "@/features/rewards/rewards.mappers";
import {
  createDefaultRewardsUrlState,
  parseRewardsUrlState,
  serializeRewardsUrlState,
} from "@/features/rewards/rewards.urlState";
import { useAnalysisStatusQuery, useRewardsQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

const selectionContextKeys: Array<keyof ReturnType<typeof parseRewardsUrlState>> = [
  "search",
  "datePreset",
  "dateStart",
  "dateEnd",
  "source",
  "tokenAddress",
  "poolId",
  "depositId",
  "strategyExposureId",
  "rewardType",
  "coverage",
  "resolutionStatus",
  "page",
  "pageSize",
];

function shouldClearRewardSelection(
  current: ReturnType<typeof parseRewardsUrlState>,
  next: ReturnType<typeof parseRewardsUrlState>,
) {
  if (!current.selectedRewardEventId) return false;
  if (current.sort.key !== next.sort.key || current.sort.direction !== next.sort.direction) return true;
  return selectionContextKeys.some((key) => current[key] !== next[key]);
}

export function RewardsContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["rewards", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const urlState = useMemo(() => parseRewardsUrlState(searchParams), [searchParams]);

  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const rewardsQuery = useRewardsQuery(
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
      queryKey: queryKeys.rewards({ chainId: resolvedChainId, walletAddress }),
    });
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, walletAddress]);

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (rewardsQuery.data ? mapRewardsResponseToViewModel(rewardsQuery.data) : null),
    [rewardsQuery.data],
  );
  const screenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || rewardsQuery.isLoading) return "loading" as const;
    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }
    if (rewardsQuery.error) return "error" as const;
    if (!viewModel || viewModel.screenKind === "locked") return "locked" as const;
    if (viewModel.screenKind === "empty") return "empty" as const;
    return "ready" as const;
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, isWalletReady, rewardsQuery.error, rewardsQuery.isLoading, viewModel]);

  function updateUrl(nextState: typeof urlState) {
    const resolvedState = shouldClearRewardSelection(urlState, nextState)
      ? { ...nextState, selectedRewardEventId: null }
      : nextState;
    const query = serializeRewardsUrlState(resolvedState);
    router.replace(query ? `/rewards?${query}` : "/rewards", { scroll: false });
  }

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("rewards:title")}</CabText>}>
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
      topBar={<CabTopNav title={t("rewards:title")} />}
    >
      <RewardsComponent
        screenState={screenState}
        viewModel={viewModel}
        urlState={urlState}
        errorCode={rewardsQuery.error instanceof Error ? rewardsQuery.error.message : null}
        isRefreshing={rewardsQuery.isFetching && !rewardsQuery.isLoading}
        onRetry={() => void rewardsQuery.refetch()}
        onStateChange={(nextState) => startTransition(() => updateUrl(nextState))}
        onClearFilter={(target) => startTransition(() => updateUrl(resetRewardsFilter(urlState, target)))}
        onClearAll={() => startTransition(() => updateUrl(createDefaultRewardsUrlState()))}
        onOpenHref={(href) => router.push(href)}
      />
    </ConnectedShell>
  );
}
