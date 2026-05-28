"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";
import { CabTokenIcon } from "@/design-system/data-display/CabTokenIcon";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabTokenPairToken = {
  chainId?: number | null;
  tokenAddress?: string | null;
  symbol: string;
  name?: string | null;
  accentColor?: string;
};

const sizeStyleMap = {
  sm: {
    glyphSize: 20,
    fontSize: 9,
    overlap: 6,
    labelSize: 13,
  },
  md: {
    glyphSize: 26,
    fontSize: 10,
    overlap: 8,
    labelSize: 15,
  },
  lg: {
    glyphSize: 32,
    fontSize: 11,
    overlap: 10,
    labelSize: 17,
  },
} as const;

export type CabTokenPairProps = {
  primary: CabTokenPairToken;
  secondary?: CabTokenPairToken;
  feeTierLabel?: string;
  size?: "sm" | "md" | "lg";
};

export function CabTokenPair({ primary, secondary, feeTierLabel, size = "md" }: CabTokenPairProps) {
  const sizeStyle = sizeStyleMap[size];
  const tokens = [primary, secondary].filter((token): token is CabTokenPairToken => Boolean(token));

  return (
    <CabStack row alignItems="center" gap="$2.5" flexWrap="wrap">
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          minWidth: sizeStyle.glyphSize + (tokens.length - 1) * (sizeStyle.glyphSize - sizeStyle.overlap),
          height: sizeStyle.glyphSize,
        }}
      >
        {tokens.map((token, index) => (
          <div
            key={`${token.tokenAddress ?? token.symbol}-${index}`}
            style={{
              position: "absolute",
              left: index * (sizeStyle.glyphSize - sizeStyle.overlap),
            }}
          >
            <CabTokenIcon
              chainId={token.chainId}
              tokenAddress={token.tokenAddress}
              symbol={token.symbol}
              name={token.name}
              accentColor={token.accentColor}
              size={sizeStyle.glyphSize}
              decorative
            />
          </div>
        ))}
      </div>

      <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
        <CabText
          variant="label"
          fontSize={sizeStyle.labelSize}
          color={cabColors.text.primary}
          style={{ lineHeight: 1.1 }}
        >
          {primary.symbol}
          {secondary ? ` / ${secondary.symbol}` : ""}
        </CabText>
        {feeTierLabel ? (
          <CabBadge tone="neutral" size="sm" variant="emphasis">
            {feeTierLabel}
          </CabBadge>
        ) : null}
      </CabStack>
    </CabStack>
  );
}