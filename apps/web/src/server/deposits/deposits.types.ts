import type {
  DepositConfidence,
  DepositCoverageStatus,
  DepositLifecycleEventType,
  DepositPoolKind,
  DepositPriceSource,
  DepositSummaryStatus,
  DepositValueChartGapReasonCode,
  DepositValueChartSeriesKey,
  DepositsAnalysisStatus,
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
} from "@/server/deposits/deposits.contract";

export type {
  DepositConfidence,
  DepositCoverageStatus,
  DepositLifecycleEventType,
  DepositPoolKind,
  DepositPriceSource,
  DepositSummaryStatus,
  DepositValueChartGapReasonCode,
  DepositValueChartSeriesKey,
  DepositsAnalysisStatus,
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
};

export type DepositsListRequest = {
  walletAddress: string;
  chainId: number;
  status: DepositsStatusFilter;
  poolId: string | null;
  startDayUtc: string | null;
  endDayUtc: string | null;
  returnSign: DepositsReturnSignFilter;
  sort: DepositsSortField;
  direction: DepositsSortDirection;
  page: number;
  pageSize: number;
};

export type DepositDetailRequest = {
  walletAddress: string;
  chainId: number;
  depositId: string;
};

export type DepositSummaryView = {
  depositId: string;
  poolId: string;
  poolLabel: string;
  positionLabel: string;
  poolKind: DepositPoolKind;
  feeTierBps: number | null;
  tokenId: string | null;
  token0Symbol: string | null;
  token1Symbol: string | null;
  status: DepositSummaryStatus;
  openedAt: string | null;
  closedAt: string | null;
  openedByTransferIn: boolean;
  openedValueUsd: number;
  currentValueUsd: number;
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  totalRewardsUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalReturnUsd: number;
  totalReturnPct: number | null;
  estimatedAnnualizedReturnPct: number | null;
  isInRange: boolean | null;
  rangeLowerPrice: number | null;
  rangeUpperPrice: number | null;
  coverageStatus: DepositCoverageStatus;
  confidence: DepositConfidence;
  coverageReasonCodes: string[];
  coveredStartDayUtc: string | null;
  coveredEndDayUtc: string | null;
  mellowStrategyCrossLinkId?: string | null;
  mellowStrategyExternalPositionReference?: string | null;
  mellowStrategyExternalPositionReferenceStatus?: "resolved" | "unresolved" | null;
};

export type DepositsListSummary = {
  totalCount: number;
  openActiveCount: number;
  openOutOfRangeCount: number;
  closedCount: number;
  currentValueUsd: number;
  totalRewardsUsd: number;
  weightedAnnualizedReturnPct: number | null;
  capitalDeployedPctOfManual: number | null;
  hasAutomatedExposure: boolean;
  coverageStatus: DepositCoverageStatus;
  coverageReasonCodes: string[];
};

export type DepositLifecycleTokenDelta = {
  tokenAddress: string | null;
  symbol: string | null;
  direction: "in" | "out";
  amountRaw: string;
  amountFormatted: string | null;
  usdValue: number | null;
  priceSource: DepositPriceSource | null;
};

export type DepositLifecycleEventView = {
  id: string;
  sequenceIndex: number;
  eventType: DepositLifecycleEventType;
  occurredAt: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  usdValue: number | null;
  signedTokenDeltas: DepositLifecycleTokenDelta[];
  priceSource: DepositPriceSource | null;
  confidence: DepositConfidence;
  inferredActionId: string | null;
  coverageReasonCodes: string[];
  metadata: Record<string, unknown>;
};

export type DepositPerformanceDecompositionView = {
  totalReturnUsd: number;
  rewardsUsd: number;
  feesUsd: number;
  assetPriceEffectUsd: number;
  rebalanceEffectUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  unattributedUsd: number;
  unattributedReasonCodes: string[];
  componentPercentages: Record<string, number>;
};

export type DepositValueChartPoint = {
  occurredAt: string;
  usd: number;
  lifecycleEventId: string | null;
};

export type DepositValueChartSeries = {
  key: DepositValueChartSeriesKey;
  points: DepositValueChartPoint[];
};

export type DepositValueChartGap = {
  fromOccurredAt: string;
  toOccurredAt: string;
  reasonCode: DepositValueChartGapReasonCode;
};

export type DepositValueChartView = {
  series: DepositValueChartSeries[];
  gaps: DepositValueChartGap[];
};

export type DepositDetailView = DepositSummaryView & {
  tickLower: number | null;
  tickUpper: number | null;
  token0Address: string | null;
  token1Address: string | null;
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  decomposition: DepositPerformanceDecompositionView;
  lifecycle: DepositLifecycleEventView[];
  mellowStrategyCrossLinkId: string | null;
  mellowStrategyExternalPositionReference?: string | null;
  mellowStrategyExternalPositionReferenceStatus?: "resolved" | "unresolved" | null;
};

export type DepositsCoveredRange = {
  startDayUtc: string | null;
  endDayUtc: string | null;
};

export type DepositsListResponse = {
  walletAddress: string;
  chainId: number;
  analysisStatus: DepositsAnalysisStatus;
  coveredRange: DepositsCoveredRange;
  summary: DepositsListSummary;
  items: DepositSummaryView[];
  page: {
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
  };
};

export type DepositDetailResponse = {
  walletAddress: string;
  chainId: number;
  analysisStatus: DepositsAnalysisStatus;
  coveredRange: DepositsCoveredRange;
  deposit: DepositDetailView;
  valueChart: DepositValueChartView;
};
