"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { ActivityContainer } from "@/features/activity/Activity.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function ActivityPage() {
  const router = useRouter();
  const { t } = useTranslation(["navigation"]);
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
      <a href="#activity-content" className="cab-skip-link">
        {t("navigation:a11y.skipToContent", { defaultValue: "Skip to main content" })}
      </a>
      <div id="activity-content" tabIndex={-1}>
        <ActivityContainer />
      </div>
    </>
  );
}
