"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { CabIcon } from "@/design-system/icons/CabIcon";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";
import { resolveCabTokenIcon } from "@/design-system/tokens/tokenAssets";

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function resolveAccentColor(symbol: string | null | undefined) {
  const normalized = symbol?.toLowerCase() ?? "";

  if (normalized.includes("btc")) {
    return "#F7931A";
  }

  if (normalized.includes("usd") || normalized.includes("eur")) {
    return cabColors.brand.electricBlue;
  }

  if (normalized.includes("eth") || normalized.includes("weth")) {
    return "#DDE3F2";
  }

  return cabColors.brand.signalTeal;
}

function renderMonogram(symbol: string) {
  return symbol
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

const sizeMap = {
  sm: 20,
  md: 26,
  lg: 32,
} as const;

export type CabTokenIconProps = {
  chainId?: number | null;
  tokenAddress?: string | null;
  symbol?: string | null;
  name?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | number;
  decorative?: boolean;
  accentColor?: string;
};

export function CabTokenIcon({
  chainId = null,
  tokenAddress = null,
  symbol = null,
  name = null,
  alt,
  size = "md",
  decorative = false,
  accentColor,
}: CabTokenIconProps) {
  const resolvedSize = typeof size === "number" ? size : sizeMap[size];
  const resolution = useMemo(
    () => resolveCabTokenIcon({ chainId, tokenAddress, symbol, name }),
    [chainId, tokenAddress, symbol, name],
  );
  const sourceKey = resolution.sources.map((source) => `${source.kind}:${source.src}`).join("|");
  const [failedSourcesByKey, setFailedSourcesByKey] = useState<Record<string, string[]>>({});
  const failedSources = failedSourcesByKey[sourceKey] ?? [];
  const activeSource = resolution.sources.find((source) => !failedSources.includes(source.src)) ?? null;
  const resolvedAccentColor = accentColor ?? resolveAccentColor(resolution.matchedSymbol ?? symbol);
  const accessibleLabel = alt ?? name ?? resolution.matchedName ?? resolution.matchedSymbol ?? resolution.fallbackLabel;
  const monogram = renderMonogram(resolution.matchedSymbol ?? symbol ?? resolution.fallbackLabel);

  const frameStyle = {
    position: "relative" as const,
    width: resolvedSize,
    height: resolvedSize,
    overflow: "hidden" as const,
    borderRadius: 999,
    border: `1px solid ${withAlpha(resolvedAccentColor, 0.34)}`,
    background: `radial-gradient(circle at 30% 30%, ${withAlpha("#FFFFFF", 0.16)} 0%, ${withAlpha(resolvedAccentColor, 0.2)} 32%, rgba(17, 26, 39, 0.96) 100%)`,
    boxShadow: `0 0 0 1px rgba(4, 15, 28, 0.92), 0 0 18px ${withAlpha(resolvedAccentColor, 0.16)}`,
    flexShrink: 0,
  };

  if (!activeSource) {
    return (
      <div
        aria-label={decorative ? undefined : accessibleLabel}
        role={decorative ? undefined : "img"}
        style={{
          ...frameStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {monogram.length > 0 ? (
          <CabText
            variant="mono"
            fontSize={Math.max(Math.round(resolvedSize * 0.34), 9)}
            color={resolvedAccentColor === "#DDE3F2" ? cabColors.brand.cabNight : cabColors.text.primary}
            style={{ fontWeight: 700, lineHeight: 1 }}
          >
            {monogram}
          </CabText>
        ) : (
          <CabIcon name="coins" width={Math.round(resolvedSize * 0.55)} height={Math.round(resolvedSize * 0.55)} color={cabColors.text.primary} />
        )}
      </div>
    );
  }

  return (
    <div aria-hidden={decorative} style={frameStyle}>
      <Image
        key={`${activeSource.kind}-${activeSource.src}`}
        src={activeSource.src}
        alt={decorative ? "" : accessibleLabel}
        width={resolvedSize}
        height={resolvedSize}
        onError={() => {
          setFailedSourcesByKey((currentState) => {
            const currentFailedSources = currentState[sourceKey] ?? [];

            if (currentFailedSources.includes(activeSource.src)) {
              return currentState;
            }

            return {
              ...currentState,
              [sourceKey]: [...currentFailedSources, activeSource.src],
            };
          });
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}