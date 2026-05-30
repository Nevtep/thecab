import type {
  StrategiesListResponse,
  StrategyConfidence,
  StrategyCoverageStatus,
  StrategySummaryView,
} from "@/features/strategies/strategies.types";

export type StrategyRowViewModel = StrategySummaryView & {
  formattedCurrentValue: string;
  formattedRewards: string;
  formattedTotalReturn: string;
  formattedApr: string;
  totalReturnSign: "positive" | "negative" | "neutral" | "unavailable";
  isSelected: boolean;
};

export type StrategiesListViewModel = StrategiesListResponse & {
  formattedKpis: {
    currentStrategyValueUsd: string;
    activeStrategyCount: string;
    totalClaimedRewardsUsd: string;
    totalReturnUsd: string;
    protocolCoveragePct: string;
  };
  items: StrategyRowViewModel[];
};

function formatUsd(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function totalReturnSign(value: number | null): StrategyRowViewModel["totalReturnSign"] {
  if (value === null) return "unavailable";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function getStrategyCoverageLabelKey(coverageStatus: StrategyCoverageStatus) {
  return `coverage:level.${coverageStatus}`;
}

export function getStrategyConfidenceLabelKey(confidence: StrategyConfidence) {
  return `coverage:confidence.${confidence}`;
}

export function mapStrategiesListResponseToViewModel(response: StrategiesListResponse): StrategiesListViewModel {
  const selectedExposureId = response.selectedStrategy?.strategyExposureId ?? null;
  return {
    ...response,
    formattedKpis: {
      currentStrategyValueUsd: formatUsd(response.kpis.currentStrategyValueUsd),
      activeStrategyCount: formatCount(response.kpis.activeStrategyCount),
      totalClaimedRewardsUsd: formatUsd(response.kpis.totalClaimedRewardsUsd),
      totalReturnUsd: formatUsd(response.kpis.totalReturnUsd),
      protocolCoveragePct: formatPercent(response.kpis.protocolCoveragePct),
    },
    items: response.strategies.map((item) => ({
      ...item,
      formattedCurrentValue: formatUsd(item.currentEstimatedValueUsd),
      formattedRewards: formatUsd(item.totalRewardsUsd),
      formattedTotalReturn: formatUsd(item.totalReturnUsd),
      formattedApr: formatPercent(item.estimatedAnnualizedReturnPct),
      totalReturnSign: totalReturnSign(item.totalReturnUsd),
      isSelected: item.strategyExposureId === selectedExposureId,
    })),
  };
}

