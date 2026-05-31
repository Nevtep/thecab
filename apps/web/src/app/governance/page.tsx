"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { GovernanceContainer } from "@/features/governance/Governance.container";
import { useCabWallet } from "@/wallet/useCabWallet";

export default function GovernancePage() {
  const router = useRouter();
  const { isAuthReady, isAuthenticated } = useCabWallet();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthReady, isAuthenticated, router]);

  if (isAuthReady && !isAuthenticated) {
    return null;
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <GovernanceContainer />
    </main>
  );
}
