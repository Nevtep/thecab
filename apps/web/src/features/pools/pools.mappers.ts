import { formatCompactNumber, formatDateTime, formatDayRange, formatPercent, formatUsd } from "@/i18n/formatters";

import type { PoolDetailResponse, PoolsListResponse } from "@/features/pools/pools.types";

export function getPoolsCoverageLabelKey(coverageStatus: string) {
  return `coverage:level.${coverageStatus}`;
}

function formatInvestedDays(value: number | null, locale: string) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "day",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(Math.max(1, Math.round(value)));
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
    items: response.items.map((item) => ({
      ...item,
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
    })),
  };
}

export function mapPoolDetailResponseToViewModel(response: PoolDetailResponse, locale: string) {
  return {
    ...response,
    formattedCoveredRange: formatDayRange(response.coveredRange.startDayUtc, response.coveredRange.endDayUtc, locale),
    header: {
      ...response.header,
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
  };
}