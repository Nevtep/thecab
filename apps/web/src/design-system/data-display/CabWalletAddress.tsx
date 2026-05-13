"use client";

import { CabText } from "@/design-system/primitives/CabText";

export function CabWalletAddress({ address }: { address: string }) {
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <CabText variant="data" style={{ fontVariantNumeric: "tabular-nums" }}>
      {short}
    </CabText>
  );
}
