"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabSidebar, CabSidebarNavItem, CabStack, CabText, CabTopNav, ConnectedShell } from "@/design-system";
import { getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { PoolDetailComponent } from "@/features/pools/PoolDetail.component";
import { mapPoolDetailResponseToViewModel } from "@/features/pools/pools.mappers";
import type { PoolDetailRange } from "@/features/pools/pools.types";
import { useAnalysisStatusQuery, usePoolDetailQuery } from "@/queries/hooks";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

export function PoolDetailContainer({ poolId }: { poolId: string }) {
  const router = useRouter();
  const { t, i18n } = useTranslation(["pools", "navigation"]);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();
  const [range, setRange] = useState<PoolDetailRange>("90d");

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
  const detailQuery = usePoolDetailQuery(
    {
      walletAddress,
      chainId: resolvedChainId,
      poolId,
      range,
    },
    {
      enabled: isWalletReady,
    },
  );

  const navigationItems = useMemo(
    () => getOverviewNavigationItems((analysisStatusQuery.data?.status ?? "not_analyzed") as never),
    [analysisStatusQuery.data?.status],
  );
  const viewModel = useMemo(
    () => (detailQuery.data ? mapPoolDetailResponseToViewModel(detailQuery.data, i18n.language) : null),
    [detailQuery.data, i18n.language],
  );
  const screenState = useMemo(() => {
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
  }, [analysisStatusQuery.data, analysisStatusQuery.isLoading, detailQuery.error, detailQuery.isLoading, isWalletReady]);

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
      <PoolDetailComponent
        screenState={screenState}
        viewModel={viewModel}
        errorCode={detailQuery.error instanceof Error ? detailQuery.error.message : null}
        range={range}
        onClose={() => router.push("/pools")}
        onRangeChange={setRange}
        onRetry={() => void detailQuery.refetch()}
      />
    </ConnectedShell>
  );
}