import type {
  StrategiesListResponse,
  StrategyDetailResponse,
  StrategyLifecycleEventType,
  StrategyConfidence,
  StrategyCoverageStatus,
  StrategySummaryView,
} from "@/features/strategies/strategies.types";
import { getExplorerBaseUrl } from "@/chains/chains";
import { formatCompactNumber, formatSignedPercent, formatUsd } from "@/i18n/formatters";

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

function formatNullableUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return formatUsd(value, locale);
}

function formatNullablePercent(value: number | null, locale: string) {
  if (value === null) return "—";
  return formatSignedPercent(value, locale);
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

export function mapStrategiesListResponseToViewModel(
  response: StrategiesListResponse,
  locale = "en-US",
): StrategiesListViewModel {
  const selectedExposureId = response.selectedStrategy?.strategyExposureId ?? null;
  return {
    ...response,
    formattedKpis: {
      currentStrategyValueUsd: formatNullableUsd(response.kpis.currentStrategyValueUsd, locale),
      activeStrategyCount: formatCompactNumber(response.kpis.activeStrategyCount, locale),
      totalClaimedRewardsUsd: formatNullableUsd(response.kpis.totalClaimedRewardsUsd, locale),
      totalReturnUsd: formatNullableUsd(response.kpis.totalReturnUsd, locale),
      protocolCoveragePct: formatNullablePercent(response.kpis.protocolCoveragePct, locale),
    },
    items: response.strategies.map((item) => ({
      ...item,
      formattedCurrentValue: formatNullableUsd(item.displayValueUsd ?? item.currentEstimatedValueUsd, locale),
      formattedRewards: formatNullableUsd(item.totalRewardsUsd, locale),
      formattedTotalReturn: formatNullableUsd(item.totalReturnUsd, locale),
      formattedApr: formatNullablePercent(item.estimatedAnnualizedReturnPct, locale),
      totalReturnSign: totalReturnSign(item.totalReturnUsd),
      isSelected: item.strategyExposureId === selectedExposureId,
    })),
  };
}

export function mapStrategyDetailResponseToViewModel(
  response: StrategyDetailResponse,
  locale = "en-US",
): StrategyDetailViewModel {
  const coverageNoteView = {
    ...response.strategy.coverageNote,
    tone: getStrategyCoverageTone(response.strategy.coverageNote.status),
    isProminent: response.strategy.coverageNote.status !== "full",
    reasonLabelKeys: response.strategy.coverageNote.reasonCodes.map((reason) => `coverage:reasons.${reason}`),
  };

  return {
    ...response,
    formattedHeader: {
      currentValue: formatNullableUsd(response.strategy.displayValueUsd ?? response.strategy.currentEstimatedValueUsd, locale),
      totalReturn: formatNullableUsd(response.strategy.totalReturnUsd, locale),
      rewards: formatNullableUsd(response.strategy.totalRewardsUsd, locale),
    },
    coverageNoteView,
    rewardsRows: response.strategy.rewards.map((reward) => ({
      ...reward,
      formattedAmountUsd: formatNullableUsd(reward.amountUsd, locale),
      explorerUrl: getStrategyTxExplorerUrl(response.chainId, reward.txHash),
    })),
    lifecycleRows: response.strategy.lifecycle.map((event) => ({
      ...event,
      labelKey: getStrategyLifecycleLabelKey(event.eventType),
      formattedUsdValue: formatNullableUsd(event.usdValue, locale),
      explorerUrl: getStrategyTxExplorerUrl(response.chainId, event.txHash),
    })),
  };
}
