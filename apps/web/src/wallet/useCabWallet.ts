"use client";

import { useContext } from "react";

import { CabWalletContext } from "@/wallet/CabWalletProvider";

export function useCabWallet() {
  const context = useContext(CabWalletContext);
  if (!context) {
    throw new Error("useCabWallet must be used within CabWalletProvider");
  }

  return context;
}
