import { cabColors } from "@/design-system/tokens";
import type { OverviewViewModel } from "@/features/overview/overview.types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type DistributionSlice = OverviewViewModel["distribution"]["slices"][number];

export type DistributionCompositionTokenBreakdown = {
  symbol: string;
  amount: number;
  estimatedValueUsd: number | null;
  color: string;
};

export type DistributionCompositionBreakdown = {
  key: string;
  slice: DistributionSlice;
  usesEstimatedValue: boolean;
  tokens: DistributionCompositionTokenBreakdown[];
};

export type CapitalAllocationSliceSummary = {
  key: string;
  label: string;
  color: string;
  valueUsd: number;
  percentage: number;
  dimension: DistributionSlice["dimension"];
};

export type CapitalAllocationStatusBadge = {
  key: string;
  label: string;
  tone: "neutral" | "success" | "warning" | "info";
};

export function formatDistributionTokenAmount(amount: number, locale: string) {
  const maximumFractionDigits = amount >= 1_000 ? 2 : amount >= 1 ? 4 : 6;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(amount);
}

export function getDistributionSliceLabel(slice: DistributionSlice, translate: Translate) {
  switch (slice.dimension) {
    case "idle":
      return translate("distribution.slices.idle");
    case "manual_deposit":
      return translate("distribution.slices.manualDeposits");
    case "strategy":
      return translate("distribution.slices.automatedStrategies");
    case "governance":
      return translate("distribution.slices.governanceLocks");
    case "staked_lp":
      return translate("distribution.slices.stakedLp");
  }
}

export function getDistributionSliceColor(dimension: DistributionSlice["dimension"]) {
  switch (dimension) {
    case "idle":
      return cabColors.dataViz.slate;
    case "manual_deposit":
      return cabColors.dataViz.cobalt;
    case "strategy":
      return cabColors.dataViz.emerald;
    case "governance":
      return cabColors.dataViz.amber;
    case "staked_lp":
      return cabColors.dataViz.violet;
  }
}

export function getDistributionSliceKey(slice: DistributionSlice) {
  return `${slice.dimension}-${slice.label}`;
}

export function formatDistributionCompositionToken(
  token: { symbol: string; amount: number },
  locale: string,
  translate: Translate,
) {
  return translate("distribution.composition.tokenAmount", {
    symbol: token.symbol,
    amount: formatDistributionTokenAmount(token.amount, locale),
  });
}

export function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");

  if (normalized.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getDistributionCompositionColor(index: number) {
  const colors = [
    cabColors.dataViz.violet,
    cabColors.dataViz.emerald,
    cabColors.dataViz.cobalt,
    cabColors.dataViz.amber,
    cabColors.dataViz.orange,
    cabColors.dataViz.mint,
  ];

  return colors[index % colors.length];
}

export function buildDistributionCompositionBreakdown(
  slice: DistributionSlice,
  assetRows: OverviewViewModel["assets"]["rows"],
) {
  if (!slice.composition?.length) {
    return null;
  }

  const priceBySymbol = new Map<string, number>();
  for (const row of assetRows) {
    if (!row.symbol || typeof row.priceUsd !== "number" || priceBySymbol.has(row.symbol)) {
      continue;
    }

    priceBySymbol.set(row.symbol, row.priceUsd);
  }

  const tokenTotals = new Map<string, { amount: number; estimatedValueUsd: number | null }>();
  for (const entry of slice.composition) {
    for (const token of entry.tokens) {
      if (typeof token.amount !== "number") {
        continue;
      }

      const existingToken = tokenTotals.get(token.symbol);
      const nextAmount = (existingToken?.amount ?? 0) + token.amount;
      const tokenPriceUsd = priceBySymbol.get(token.symbol) ?? null;
      const nextEstimatedValueUsd = tokenPriceUsd === null
        ? existingToken?.estimatedValueUsd ?? null
        : (existingToken?.estimatedValueUsd ?? 0) + (token.amount * tokenPriceUsd);

      tokenTotals.set(token.symbol, {
        amount: nextAmount,
        estimatedValueUsd: nextEstimatedValueUsd,
      });
    }
  }

  const tokens = Array.from(tokenTotals.entries())
    .map(([symbol, token], index) => ({
      symbol,
      amount: token.amount,
      estimatedValueUsd: token.estimatedValueUsd,
      color: getDistributionCompositionColor(index),
    }))
    .sort((left, right) => {
      const leftValue = left.estimatedValueUsd ?? left.amount;
      const rightValue = right.estimatedValueUsd ?? right.amount;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.symbol.localeCompare(right.symbol);
    });

  if (tokens.length === 0) {
    return null;
  }

  return {
    key: getDistributionSliceKey(slice),
    slice,
    usesEstimatedValue: tokens.every((token) => token.estimatedValueUsd !== null),
    tokens,
  } satisfies DistributionCompositionBreakdown;
}

export function buildIdleAssetBreakdown(
  slice: DistributionSlice,
  assetRows: OverviewViewModel["assets"]["rows"],
) {
  const tokens = assetRows
    .map((row, index) => ({
      symbol: row.symbol,
      amount: Number.parseFloat(row.balance),
      estimatedValueUsd: row.valueUsd,
      color: getDistributionCompositionColor(index),
    }))
    .filter((token) => Number.isFinite(token.amount))
    .sort((left, right) => {
      const leftValue = left.estimatedValueUsd ?? left.amount;
      const rightValue = right.estimatedValueUsd ?? right.amount;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.symbol.localeCompare(right.symbol);
    });

  if (tokens.length === 0) {
    return null;
  }

  return {
    key: getDistributionSliceKey(slice),
    slice,
    usesEstimatedValue: tokens.every((token) => token.estimatedValueUsd !== null),
    tokens,
  } satisfies DistributionCompositionBreakdown;
}

export function buildCapitalAllocationSliceSummaries(slices: DistributionSlice[], translate: Translate) {
  const totalValueUsd = slices.reduce((sum, slice) => sum + slice.valueUsd, 0);

  return slices.map((slice) => ({
    key: getDistributionSliceKey(slice),
    label: getDistributionSliceLabel(slice, translate),
    color: getDistributionSliceColor(slice.dimension),
    valueUsd: slice.valueUsd,
    percentage: totalValueUsd > 0 ? slice.valueUsd / totalValueUsd : 0,
    dimension: slice.dimension,
  })) satisfies CapitalAllocationSliceSummary[];
}

export function getDefaultSelectedDistributionKey(slices: DistributionSlice[]) {
  const preferredOrder = ["staked_lp", "strategy", "manual_deposit", "governance", "idle"] as const;

  for (const dimension of preferredOrder) {
    const matchingSlice = slices.find((slice) => slice.dimension === dimension);
    if (matchingSlice) {
      return getDistributionSliceKey(matchingSlice);
    }
  }

  return slices[0] ? getDistributionSliceKey(slices[0]) : null;
}

export function buildCapitalAllocationStatusBadges(
  distribution: OverviewViewModel["distribution"],
  translate: Translate,
) {
  const badges: CapitalAllocationStatusBadge[] = [];
  const reasonCodes = distribution.coverageReasonCodes ?? [];

  switch (distribution.coverageStatus) {
    case "partial":
      badges.push({
        key: "coverage-partial",
        label: translate("distribution.statusBadges.coveragePartial"),
        tone: "warning",
      });
      break;
    case "recent":
      badges.push({
        key: "coverage-recent",
        label: translate("distribution.statusBadges.coverageRecent"),
        tone: "info",
      });
      break;
    case "unknown":
      badges.push({
        key: "coverage-unknown",
        label: translate("distribution.statusBadges.coverageUnknown"),
        tone: "neutral",
      });
      break;
  }

  if (distribution.source === "partial_fallback") {
    badges.push({
      key: "source-fallback",
      label: translate("distribution.statusBadges.fallbackPartial"),
      tone: "info",
    });
  }

  if (distribution.source === "analyzed_history") {
    badges.push({
      key: "source-analyzed",
      label: translate("distribution.statusBadges.analyzedHistory"),
      tone: "success",
    });
  } else if (reasonCodes.includes("analysisPending")) {
    badges.push({
      key: "source-pending",
      label: translate("distribution.statusBadges.historicalPending"),
      tone: "neutral",
    });
  }

  return badges;
}