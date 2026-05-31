"use client";

import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { GovernanceComponent } from "@/features/governance/Governance.component";
import { mapGovernanceResponseToViewModel } from "@/features/governance/governance.mappers";
import {
  createDefaultGovernanceUrlState,
  parseGovernanceUrlState,
  resetGovernanceFilter,
  serializeGovernanceUrlState,
} from "@/features/governance/governance.urlState";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { useAnalysisStatusQuery, useGovernanceQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

export function GovernanceContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["governance", "navigation"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const urlState = useMemo(() => parseGovernanceUrlState(searchParams), [searchParams]);

  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const governanceQuery = useGovernanceQuery(
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
      queryKey: queryKeys.governance({ chainId: resolvedChainId, walletAddress }),
    });
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, walletAddress]);

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (governanceQuery.data ? mapGovernanceResponseToViewModel(governanceQuery.data) : null),
    [governanceQuery.data],
  );
  const screenState = useMemo(() => {
    if (!isWalletReady || analysisStatusQuery.isLoading || governanceQuery.isLoading) return "loading" as const;
    if (analysisStatusQuery.data && analysisStatusQuery.data.status !== "ready" && analysisStatusQuery.data.status !== "stale") {
      return "locked" as const;
    }
    if (governanceQuery.error) return "error" as const;
    if (!viewModel || viewModel.screenKind === "locked") return "locked" as const;
    if (viewModel.screenKind === "empty") return "empty" as const;
    return "ready" as const;
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, governanceQuery.error, governanceQuery.isLoading, isWalletReady, viewModel]);

  function updateUrl(nextState: typeof urlState) {
    const query = serializeGovernanceUrlState(nextState);
    router.replace(query ? `/governance?${query}` : "/governance", { scroll: false });
  }

  return (
    <ConnectedShell
      sidebar={
        <CabSidebar header={<CabText variant="heading">{t("governance:title")}</CabText>}>
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
      topBar={<CabTopNav title={t("governance:title")} />}
    >
      <GovernanceComponent
        screenState={screenState}
        viewModel={viewModel}
        urlState={urlState}
        errorCode={governanceQuery.error instanceof Error ? governanceQuery.error.message : null}
        isRefreshing={governanceQuery.isFetching && !governanceQuery.isLoading}
        onRetry={() => void governanceQuery.refetch()}
        onStateChange={(nextState) => startTransition(() => updateUrl(nextState))}
        onClearFilter={(target) => startTransition(() => updateUrl(resetGovernanceFilter(urlState, target)))}
        onClearAll={() => startTransition(() => updateUrl(createDefaultGovernanceUrlState()))}
        onOpenHref={(href) => router.push(href)}
      />
    </ConnectedShell>
  );
}
