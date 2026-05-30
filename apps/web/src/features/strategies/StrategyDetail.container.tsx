"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { StrategyDetailComponent } from "@/features/strategies/StrategyDetail.component";
import { useAnalysisStatusQuery, useStrategyDetailQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

type StrategyDetailContainerProps = {
  strategyId: string;
  backHref?: string | null;
};

export function StrategyDetailContainer({ backHref, strategyId }: StrategyDetailContainerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation(["strategies"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const detailQuery = useStrategyDetailQuery(
    { walletAddress, chainId: resolvedChainId, strategyId },
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
      queryKey: queryKeys.strategyDetail(resolvedChainId, strategyId),
    });
  }, [analysisStatusQuery.data?.status, queryClient, resolvedChainId, strategyId, walletAddress]);

  const screenState = !isWalletReady || detailQuery.isLoading
    ? "loading"
    : detailQuery.error
      ? (detailQuery.error instanceof Error && detailQuery.error.message === "strategy_not_found" ? "empty" : "error")
      : !detailQuery.data
        ? "empty"
        : "ready";

  const onRetry = useCallback(() => {
    void detailQuery.refetch();
  }, [detailQuery]);

  const onClose = useCallback(() => {
    router.push(backHref ?? "/strategies");
  }, [backHref, router]);

  return (
    <StrategyDetailComponent
      screenState={screenState}
      response={detailQuery.data ?? null}
      errorCode={detailQuery.error instanceof Error ? detailQuery.error.message : null}
      locale={i18n.language}
      onRetry={onRetry}
      onClose={onClose}
    />
  );
}
