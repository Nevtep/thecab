"use client";

import { CabText } from "@/design-system/primitives/CabText";

export function CabTxHash({ hash }: { hash: string }) {
  const short = `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  return (
    <CabText variant="data" style={{ fontVariantNumeric: "tabular-nums" }}>
      {short}
    </CabText>
  );
}
