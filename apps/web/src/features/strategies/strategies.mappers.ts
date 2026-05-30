import type {
  StrategiesListResponse,
  StrategyDetailResponse,
  StrategyLifecycleEventType,
  StrategyConfidence,
  StrategyCoverageStatus,
  StrategySummaryView,
} from "@/features/strategies/strategies.types";
import { getExplorerBaseUrl } from "@/chains/chains";

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

export type StrategyDetailViewModel = StrategyDetailResponse & {
  formattedHeader: {
    currentValue: string;
    totalReturn: string;
    rewards: string;
  };
  coverageNoteView: StrategyDetailResponse["strategy"]["coverageNote"] & {
    tone: "success" | "warning" | "danger";
    isProminent: boolean;
    reasonLabelKeys: string[];
  };
  rewardsRows: Array<StrategyDetailResponse["strategy"]["rewards"][number] & {
    formattedAmountUsd: string;
    explorerUrl: string | null;
  }>;
  lifecycleRows: Array<StrategyDetailResponse["strategy"]["lifecycle"][number] & {
    labelKey: string;
    formattedUsdValue: string;
    explorerUrl: string | null;
  }>;
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

export function getStrategyCoverageTone(coverageStatus: StrategyCoverageStatus) {
  if (coverageStatus === "full") return "success" as const;
  if (coverageStatus === "unknown") return "danger" as const;
  return "warning" as const;
}

export function getStrategyCoverageLabelKey(coverageStatus: StrategyCoverageStatus) {
  return `coverage:level.${coverageStatus}`;
}

export function getStrategyConfidenceLabelKey(confidence: StrategyConfidence) {
  return `coverage:confidence.${confidence}`;
}

export function getStrategyLifecycleLabelKey(eventType: StrategyLifecycleEventType) {
  return `strategies:lifecycle.eventTypes.${eventType}`;
}

export function getStrategyTxExplorerUrl(chainId: number, txHash: string | null) {
  return txHash ? `${getExplorerBaseUrl(chainId)}/tx/${txHash}` : null;
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

export function mapStrategyDetailResponseToViewModel(response: StrategyDetailResponse): StrategyDetailViewModel {
  const coverageNoteView = {
    ...response.strategy.coverageNote,
    tone: getStrategyCoverageTone(response.strategy.coverageNote.status),
    isProminent: response.strategy.coverageNote.status !== "full",
    reasonLabelKeys: response.strategy.coverageNote.reasonCodes.map((reason) => `coverage:reasons.${reason}`),
  };

  return {
    ...response,
    formattedHeader: {
      currentValue: formatUsd(response.strategy.currentEstimatedValueUsd),
      totalReturn: formatUsd(response.strategy.totalReturnUsd),
      rewards: formatUsd(response.strategy.totalRewardsUsd),
    },
    coverageNoteView,
    rewardsRows: response.strategy.rewards.map((reward) => ({
      ...reward,
      formattedAmountUsd: formatUsd(reward.amountUsd),
      explorerUrl: getStrategyTxExplorerUrl(response.chainId, reward.txHash),
    })),
    lifecycleRows: response.strategy.lifecycle.map((event) => ({
      ...event,
      labelKey: getStrategyLifecycleLabelKey(event.eventType),
      formattedUsdValue: formatUsd(event.usdValue),
      explorerUrl: getStrategyTxExplorerUrl(response.chainId, event.txHash),
    })),
  };
}
