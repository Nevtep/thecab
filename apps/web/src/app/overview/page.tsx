"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OverviewContainer } from "@/features/overview/Overview.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function OverviewPage() {
  const router = useRouter();
  const { status, isAuthenticated } = useCabWallet();

  useEffect(() => {
    if (status === "disconnected" || !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router, status]);

  if (status === "disconnected" || !isAuthenticated) {
    return null;
  }

  return <OverviewContainer />;
}