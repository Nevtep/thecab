"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { DepositDetailComponent } from "@/features/deposits/DepositDetail.component";
import { useAnalysisStatusQuery, useDepositDetailViewQuery } from "@/queries/hooks";
import { queryKeys } from "@/queries/keys";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";
import { useCabWallet } from "@/wallet/useCabWallet";

function isPendingAnalysisStatus(status: string | null) {
  return status === "queued" || status === "running";
}

function isSettledAnalysisStatus(status: string | null) {
  return status === "ready" || status === "stale" || status === "failed" || status === "not_analyzed";
}

type DepositDetailContainerProps = {
  depositId: string;
  onClose?: () => void;
  backHref?: string | null;
};

export function DepositDetailContainer(input: DepositDetailContainerProps) {
  const { backHref, depositId, onClose: onCloseOverride } = input;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation(["deposits"]);
  const previousAnalysisStatusRef = useRef<string | null>(null);
  const { address, chainId, isConnected, isAuthenticated, isSupportedChain, isAuthReady } = useCabWallet();

  const walletAddress = address?.toLowerCase() ?? "";
  const resolvedChainId = chainId ?? SUPPORTED_CHAIN_ID;
  const isWalletReady = isAuthReady && Boolean(walletAddress) && isConnected && isAuthenticated && isSupportedChain;
  const analysisStatusQuery = useAnalysisStatusQuery(
    { walletAddress, chainId: resolvedChainId },
    { enabled: isWalletReady },
  );
  const detailQuery = useDepositDetailViewQuery(
    {
      chainId: resolvedChainId,
      walletAddress,
      depositId,
    },
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
      queryKey: queryKeys.depositDetail(resolvedChainId, depositId),
    });
  }, [analysisStatusQuery.data?.status, depositId, queryClient, resolvedChainId, walletAddress]);

  const screenState = !isWalletReady || detailQuery.isLoading
    ? "loading"
    : detailQuery.error
      ? (detailQuery.error instanceof Error && detailQuery.error.message === "deposit_not_found" ? "empty" : "error")
      : !detailQuery.data
        ? "empty"
        : "ready";

  const onRetry = useCallback(() => {
    void detailQuery.refetch();
  }, [detailQuery]);

  const onClose = useCallback(() => {
    if (onCloseOverride) {
      onCloseOverride();
      return;
    }
    router.push(backHref ?? "/deposits");
  }, [backHref, onCloseOverride, router]);

  return (
    <DepositDetailComponent
      screenState={screenState}
      response={detailQuery.data ?? null}
      errorCode={detailQuery.error instanceof Error ? detailQuery.error.message : null}
      locale={i18n.language}
      onRetry={onRetry}
      onClose={onClose}
    />
  );
}