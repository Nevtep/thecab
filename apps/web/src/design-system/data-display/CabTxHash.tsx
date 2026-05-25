"use client";

import { CabText } from "@/design-system/primitives/CabText";

export function CabTxHash({
  hash,
  href,
}: {
  hash: string;
  href?: string | null;
}) {
  const short = `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  const content = (
    <CabText variant="data" style={{ fontVariantNumeric: "tabular-nums" }}>
      {short}
    </CabText>
  );

  if (!href) {
    return content;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none" }}>
      {content}
    </a>
  );
}
