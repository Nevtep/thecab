import type {
  StrategiesAnalysisStatus,
  StrategiesCoverageFilter,
  StrategiesPageSize,
  StrategiesProtocolFilter,
  StrategiesReturnSignFilter,
  StrategiesSort,
  StrategiesStatusFilter,
  StrategyConfidence,
  StrategyCoverageStatus,
  StrategyExternalReferenceStatus,
  StrategyLifecycleEventType,
  StrategyPoolMappingStatus,
  StrategyPriceSource,
  StrategyProtocol,
  StrategySummaryStatus,
} from "@/server/strategies/strategies.contract";

export type {
  StrategiesAnalysisStatus,
  StrategiesCoverageFilter,
  StrategiesPageSize,
  StrategiesProtocolFilter,
  StrategiesReturnSignFilter,
  StrategiesSort,
  StrategiesStatusFilter,
  StrategyConfidence,
  StrategyCoverageStatus,
  StrategyExternalReferenceStatus,
  StrategyLifecycleEventType,
  StrategyPoolMappingStatus,
  StrategyPriceSource,
  StrategyProtocol,
  StrategySummaryStatus,
};

export type StrategiesListRequest = {
  walletAddress: string;
  chainId: number;
  status: StrategiesStatusFilter;
  protocol: StrategiesProtocolFilter;
  poolId: string | null;
  coverage: StrategiesCoverageFilter;
  returnSign: StrategiesReturnSignFilter;
  search: string;
  sort: StrategiesSort;
  selectedStrategyId: string | null;
  page: number;
  pageSize: StrategiesPageSize;
};

export type StrategyDetailRequest = {
  walletAddress: string;
  chainId: number;
  strategyId: string;
};

export type StrategiesCoveredRange = {
  startDayUtc: string | null;
  endDayUtc: string | null;
};

export type StrategySummaryView = {
  id: string;
  strategyId: string;
  strategyExposureId: string;
  strategyLabel: string;
  protocol: StrategyProtocol;
  primaryPoolId: string | null;
  poolLabel: string | null;
  poolMappingStatus: StrategyPoolMappingStatus;
  status: StrategySummaryStatus;
  currentEstimatedValueUsd: number | null;
  depositedValueUsd: number;
  withdrawnValueUsd: number;
  currentSharesRaw: string;
  shareSymbol: string | null;
  totalRewardsUsd: number;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalReturnUsd: number | null;
  totalReturnPct: number | null;
  estimatedAnnualizedReturnPct: number | null;
  coverageStatus: StrategyCoverageStatus;
  confidence: StrategyConfidence;
  coverageReasonCodes: string[];
};

export type StrategyRewardView = {
  id: string;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountFormatted: string | null;
  amountUsd: number | null;
  claimedAt: string | null;
  txHash: string | null;
  resolutionStatus: "resolved" | "unresolved";
  coverageReasonCodes: string[];
};

export type StrategyLifecycleTokenDelta = {
  tokenAddress: string | null;
  symbol: string | null;
  direction: "in" | "out";
  amountRaw: string;
  amountFormatted: string | null;
  usdValue: number | null;
  priceSource: StrategyPriceSource | null;
};

export type StrategyLifecycleEventView = {
  id: string;
  sequenceIndex: number;
  eventType: StrategyLifecycleEventType;
  occurredAt: string;
  txHash: string | null;
  logIndex: number | null;
  blockNumber: string | null;
  usdValue: number | null;
  shareDeltaRaw: string | null;
  tokenDeltas: StrategyLifecycleTokenDelta[];
  priceSource: StrategyPriceSource | null;
  confidence: StrategyConfidence;
  coverageStatus: StrategyCoverageStatus;
  coverageReasonCodes: string[];
  metadata: Record<string, unknown>;
};

export type StrategyDetailView = StrategySummaryView & {
  wrapperAddress: string | null;
  stakingRewardsAddress: string | null;
  externalStrategyPositionReference: string | null;
  externalStrategyPositionReferenceStatus: StrategyExternalReferenceStatus;
  sharesReceivedRaw: string;
  sharesRedeemedRaw: string;
  resolvedRewardCount: number;
  unresolvedRewardCount: number;
  history: Array<{
    dayUtc: string;
    estimatedValueUsd: number | null;
    cumulativeRewardsUsd: number;
  }>;
  rewards: StrategyRewardView[];
  lifecycle: StrategyLifecycleEventView[];
  coverageNote: {
    status: StrategyCoverageStatus;
    titleKey: string;
    bodyKey: string;
    reasonCodes: string[];
  };
};

export type StrategiesListResponse = {
  chainId: number;
  walletAddress: string;
  analysisStatus: StrategiesAnalysisStatus;
  coveredRange: StrategiesCoveredRange;
  kpis: {
    currentStrategyValueUsd: number | null;
    activeStrategyCount: number;
    totalClaimedRewardsUsd: number;
    totalReturnUsd: number | null;
    protocolCoveragePct: number | null;
    coverageStatus: StrategyCoverageStatus;
    coverageReasonCodes: string[];
    trends: Record<string, Array<{ dayUtc: string; value: number | null }>>;
  };
  filters: {
    applied: Record<string, string | number | null>;
    availablePools: Array<{ poolId: string; label: string }>;
  };
  page: {
    page: number;
    pageSize: StrategiesPageSize;
    totalPages: number;
    totalItems: number;
  };
  strategies: StrategySummaryView[];
  selectedStrategy: StrategyDetailView | null;
};

export type StrategyDetailResponse = {
  chainId: number;
  walletAddress: string;
  coveredRange: StrategiesCoveredRange;
  strategy: StrategyDetailView;
};

