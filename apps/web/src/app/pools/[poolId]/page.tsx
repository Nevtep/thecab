"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { PoolsContainer } from "@/features/pools/Pools.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function PoolDetailPage({ params }: { params: Promise<{ poolId: string }> }) {
  const router = useRouter();
  const { t } = useTranslation(["navigation"]);
  const { status, isAuthenticated, isAuthReady } = useCabWallet();
  const { poolId } = use(params);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (status === "disconnected" || !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isAuthReady, router, status]);

  if (!isAuthReady || status === "disconnected" || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <a href="#pool-detail-content" className="cab-skip-link">
        {t("navigation:a11y.skipToContent", { defaultValue: "Skip to main content" })}
      </a>
      <div id="pool-detail-content" tabIndex={-1}>
        <PoolsContainer selectedPoolId={poolId} />
      </div>
    </>
  );
}