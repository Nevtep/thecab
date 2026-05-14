"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { CabLoadingPanel } from "@/design-system";

import { OverviewContainer } from "@/features/overview/Overview.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function OverviewPage() {
  const router = useRouter();
  const { t } = useTranslation("overview");
  const { status } = useCabWallet();

  useEffect(() => {
    if (status === "disconnected") {
      router.replace("/");
    }
  }, [router, status]);

  if (status === "disconnected" || status === "connecting" || status === "reconnecting") {
    return <CabLoadingPanel label={t("states.loadingTitle")} />;
  }

  return <OverviewContainer />;
}