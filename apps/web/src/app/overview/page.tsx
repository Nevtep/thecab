"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OverviewContainer } from "@/features/overview/Overview.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function OverviewPage() {
  const router = useRouter();
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

  return <OverviewContainer />;
}