"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OverviewContainer } from "@/features/overview/Overview.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function OverviewPage() {
  const router = useRouter();
  const { status } = useCabWallet();

  useEffect(() => {
    if (status === "disconnected") {
      router.replace("/");
    }
  }, [router, status]);

  if (status === "disconnected") {
    return null;
  }

  return <OverviewContainer />;
}