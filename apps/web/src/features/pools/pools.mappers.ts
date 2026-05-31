import { getExplorerBaseUrl } from "@/chains/chains";
import { getGovernanceHref } from "@/features/governance/governance.navigation";
import { formatCompactNumber, formatDateTime, formatDayRange, formatNumber, formatPercent, formatUnit, formatUsd } from "@/i18n/formatters";

import type { PoolDetailResponse, PoolsListResponse } from "@/features/pools/pools.types";

export function getPoolsCoverageLabelKey(coverageStatus: string) {
  return `coverage:level.${coverageStatus}`;
}

function formatInvestedDays(value: number | null, locale: string) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return formatUnit(Math.max(1, Math.round(value)), locale, "day", {
    unitDisplay: "short",
    maximumFractionDigits: 0,
  });
}

function formatAddressLabel(value: string) {
  if (!value.startsWith("0x") || value.length < 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatProtocolFamily(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatPoolType(value: string | null) {
  if (!value) {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case "cl":
      return "CL";
    case "stable":
      return "Stable";
    case "volatile":
      return "Volatile";
    default:
      return value.trim();
  }
}

function normalizePoolTokenSymbols(tokenSymbols: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const tokenSymbol of tokenSymbols) {
    const trimmed = tokenSymbol.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(trimmed);

    if (normalized.length === 2) {
      break;
    }
  }

  return normalized;
}

function formatInteger(value: number, locale: string) {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  });
}

function formatPositionTokenAmount(value: number, locale: string) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1000) {
    return formatCompactNumber(value, locale);
  }

  return formatNumber(value, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: absoluteValue >= 1 ? 2 : 4,
  });
}

function formatPositionTokens(
  tokens: Array<{ symbol: string; amount: number | null }>,
  locale: string,
) {
  const formatted = tokens
    .filter((token) => token.symbol.trim().length > 0)
    .map((token) => {
      if (token.amount === null) {
        return token.symbol;
      }

      return `${formatPositionTokenAmount(token.amount, locale)} ${token.symbol}`;
    });

  return formatted.length > 0 ? formatted.join(" · ") : null;
}

function formatRangeValue(value: number, locale: string, fractionDigits: number | null) {
  return formatNumber(value, locale, {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  });
}

function formatTickRange(lower: number | null, upper: number | null, locale: string) {
  if (lower === null && upper === null) {
    return null;
  }

  const lowerLabel = lower === null ? "?" : formatInteger(lower, locale);
  const upperLabel = upper === null ? "?" : formatInteger(upper, locale);

  return `${lowerLabel} -> ${upperLabel}`;
}

function formatPositionRange(input: {
  lowerPrice: number | null;
  upperPrice: number | null;
  quoteToken: string | null;
  fractionDigits: number | null;
  tickLower: number | null;
  tickUpper: number | null;
  locale: string;
}) {
  if (input.lowerPrice !== null && input.upperPrice !== null && input.quoteToken) {
    return `${formatRangeValue(input.lowerPrice, input.locale, input.fractionDigits)} -> ${formatRangeValue(input.upperPrice, input.locale, input.fractionDigits)} ${input.quoteToken}`;
  }

  return formatTickRange(input.tickLower, input.tickUpper, input.locale);
}

function formatCompactIdentifier(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function mapDepositStakingState(status: PoolDetailResponse["positions"]["manualDeposits"][number]["status"]) {
  switch (status) {
    case "staked":
      return "staked" as const;
    case "open":
      return "unstaked" as const;
    case "closed":
      return "closed" as const;
    default:
      return "unknown" as const;
  }
}

export function mapPoolsListResponseToViewModel(response: PoolsListResponse, locale: string) {
  return {
    ...response,
    formattedSummary: {
      poolCount: formatCompactNumber(response.summary.poolCount, locale),
      activePoolCount: formatCompactNumber(response.summary.activePoolCount, locale),
      activeInRangePoolCount: formatCompactNumber(response.summary.activeInRangePoolCount, locale),
      currentAttributedValueUsd: formatUsd(response.summary.currentAttributedValueUsd, locale),
      totalRewardsUsd: formatUsd(response.summary.totalRewardsUsd, locale),
      weightedAnnualizedReturnPct:
        response.summary.weightedAnnualizedReturnPct === null
          ? null
          : formatPercent(response.summary.weightedAnnualizedReturnPct / 100, locale),
      estimatedImpermanentLossUsd: null,
    },
    summarySeries: response.summary.series,
    formattedCoveredRange: formatDayRange(response.coveredRange.startDayUtc, response.coveredRange.endDayUtc, locale),
    items: response.items.map((item) => {
      const tokenSymbols = normalizePoolTokenSymbols(item.tokenSymbols);

      return {
        ...item,
        tokenSymbols,
        formattedPortfolioSharePct: response.summary.currentAttributedValueUsd > 0
          ? formatPercent(item.currentAttributedValueUsd / response.summary.currentAttributedValueUsd, locale)
          : formatPercent(0, locale),
        formattedCurrentAttributedValueUsd: formatUsd(item.currentAttributedValueUsd, locale),
        formattedCapitalInvestedUsd: formatUsd(item.capitalInvestedUsd, locale),
        formattedCapitalEnteredUsd: formatUsd(item.capitalEnteredUsd, locale),
        formattedCapitalWithdrawnUsd: formatUsd(item.capitalWithdrawnUsd, locale),
        formattedTotalRewardsUsd: formatUsd(item.totalRewardsUsd, locale),
        formattedInvestedDays: formatInvestedDays(item.investedDays, locale),
        formattedTotalReturnPct:
          item.totalReturnPct === null ? null : formatPercent(item.totalReturnPct / 100, locale),
        formattedAnnualizedReturnPct:
          item.annualizedReturnPct === null ? null : formatPercent(item.annualizedReturnPct / 100, locale),
        formattedLatestActivityAt: item.latestActivityAt ? formatDateTime(item.latestActivityAt, locale) : null,
      };
    }),
  };
}

export function mapPoolDetailResponseToViewModel(response: PoolDetailResponse, locale: string) {
  const explorerUrl = response.header.poolAddress
    ? `${getExplorerBaseUrl(response.chainId)}/address/${response.header.poolAddress}`
    : null;
  const formattedPoolType = formatPoolType(response.header.poolType);
  const tokenSymbols = normalizePoolTokenSymbols(response.header.tokenSymbols);

  return {
    ...response,
    formattedCoveredRange: formatDayRange(response.coveredRange.startDayUtc, response.coveredRange.endDayUtc, locale),
    header: {
      ...response.header,
      tokenSymbols,
      formattedProtocolFamily: formatProtocolFamily(response.header.protocolFamily),
      formattedPoolType,
      formattedProtocolMetadata: [
        formatProtocolFamily(response.header.protocolFamily),
        formattedPoolType,
        response.header.feeTierLabel,
      ].filter((value): value is string => Boolean(value && value.trim().length > 0)).join(" • "),
      formattedTokenPair: tokenSymbols.join(" / "),
      shortPoolAddress: formatAddressLabel(response.header.poolAddress),
      explorerUrl,
      formattedCurrentAttributedValueUsd: formatUsd(response.header.currentAttributedValueUsd, locale),
      formattedCapitalInvestedUsd: formatUsd(response.header.capitalInvestedUsd, locale),
      formattedCapitalEnteredUsd: formatUsd(response.header.capitalEnteredUsd, locale),
      formattedCapitalWithdrawnUsd: formatUsd(response.header.capitalWithdrawnUsd, locale),
      formattedTotalRewardsUsd: formatUsd(response.header.totalRewardsUsd, locale),
      formattedInvestedDays: formatInvestedDays(response.header.investedDays, locale),
      formattedTotalReturnPct:
        response.header.totalReturnPct === null
          ? null
          : formatPercent(response.header.totalReturnPct / 100, locale),
      formattedAnnualizedReturnPct:
        response.header.annualizedReturnPct === null
          ? null
          : formatPercent(response.header.annualizedReturnPct / 100, locale),
    },
    segments: {
      manual: {
        ...response.segments.manual,
        formattedCurrentValueUsd: formatUsd(response.segments.manual.currentValueUsd, locale),
      },
      strategy: {
        ...response.segments.strategy,
        formattedCurrentValueUsd: formatUsd(response.segments.strategy.currentValueUsd, locale),
      },
      residual: {
        ...response.segments.residual,
        formattedCurrentValueUsd: formatUsd(response.segments.residual.currentValueUsd, locale),
      },
    },
    chart: response.history.points.map((point) => ({
      timestamp: point.dayUtc,
      deployedValueUsd: point.deployedValueUsd,
      residualValueUsd: point.residualValueUsd,
      rewardValueUsd: point.rewardValueUsd,
      cumulativeRewardsUsd: point.cumulativeRewardsUsd,
    })),
    timeline: response.timeline.items.map((item) => ({
      ...item,
      formattedOccurredAt: formatDateTime(item.occurredAt, locale),
      formattedAttributedValueUsd:
        item.attributedValueUsd === null ? null : formatUsd(item.attributedValueUsd, locale),
    })),
    composition: {
      manualDeposits: response.positions.manualDeposits
        .filter((position) => position.status !== "closed")
        .map((position) => ({
        rowId: position.depositId,
        idLabel: position.tokenId ? `#${position.tokenId}` : formatCompactIdentifier(position.depositId),
        idMeta: position.tokenId ? formatCompactIdentifier(position.depositId) : null,
        type: "manual" as const,
        rangeState:
          position.isInRange === true
            ? "active" as const
            : position.isInRange === false
              ? "inactive" as const
              : "unknown" as const,
        rangeDetail: formatPositionRange({
          lowerPrice: position.rangeLowerPrice,
          upperPrice: position.rangeUpperPrice,
          quoteToken: position.rangeQuoteTokenSymbol,
          fractionDigits: position.rangeDisplayFractionDigits,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          locale,
        }),
        stakingState: mapDepositStakingState(position.status),
        underlyingLabel: formatPositionTokens(position.tokens, locale),
        aprLabel:
          position.annualizedReturnPct === null
            ? null
            : formatPercent(position.annualizedReturnPct / 100, locale),
      })),
      automatedStrategies: response.positions.automatedStrategies.map((position) => ({
        rowId: position.exposureId,
        idLabel: position.strategyLabel.trim().length > 0
          ? position.strategyLabel.trim()
          : formatCompactIdentifier(position.strategyId),
        idMeta: position.strategyLabel.trim().length > 0
          ? formatCompactIdentifier(position.strategyId)
          : null,
        type: "automated" as const,
        rangeState: "managed" as const,
        rangeDetail: null,
        stakingState: "staked" as const,
        underlyingLabel: formatPositionTokens(position.tokens, locale),
        aprLabel:
          position.annualizedReturnPct === null
            ? null
            : formatPercent(position.annualizedReturnPct / 100, locale),
      })),
    },
    related: {
      ...response.related,
      governanceRewards: response.related.governanceRewards.map((reward) => ({
        ...reward,
        href: getGovernanceHref({
          chainId: response.chainId,
          selectedKind: "reward",
          selectedGovernanceId: reward.id,
          rewardEventId: reward.id,
          poolId: response.header.poolId,
        }),
      })),
    },
  };
}
