"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OverviewContainer } from "@/features/overview/Overview.container";
import { useCabWallet } from "@/wallet/useCabWallet";
import { useTranslation } from "react-i18next";

export default function OverviewPage() {
  const router = useRouter();
  const { t } = useTranslation(["overview", "navigation"]);
  const { status, isAuthenticated, isAuthReady } = useCabWallet();

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
      <a href="#overview-content" className="cab-skip-link">
        {t("navigation:a11y.skipToContent", { defaultValue: "Skip to main content" })}
      </a>
      <div id="overview-content" tabIndex={-1}>
        <OverviewContainer />
      </div>
    </>
  );
}