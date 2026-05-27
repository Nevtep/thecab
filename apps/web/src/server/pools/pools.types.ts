export type PoolsAnalysisStatus = "ready" | "stale";

export type PoolsStatusFilter = "active" | "inactive" | "closed" | "all";
export type PoolsExposureFilter = "manual" | "automated" | "mixed" | "residual_only" | "all";
export type PoolsCoverageFilter = "full" | "share_level" | "partial" | "unknown" | "all";
export type PoolsReturnBandFilter = "positive" | "negative" | "all";
export type PoolsSortField = "currentValue" | "rewards" | "return" | "recentActivity";
export type PoolsSortDirection = "asc" | "desc";
export type PoolDetailRange = "30d" | "90d" | "180d" | "1y" | "covered";

export type PoolsListRequest = {
  walletAddress: string;
  chainId: number;
  status: PoolsStatusFilter;
  exposure: PoolsExposureFilter;
  coverage: PoolsCoverageFilter;
  returnBand: PoolsReturnBandFilter;
  search: string;
  sort: PoolsSortField;
  direction: PoolsSortDirection;
  cursor: string | null;
  limit: number;
};

export type PoolDetailRequest = {
  walletAddress: string;
  chainId: number;
  poolId: string;
  range: PoolDetailRange;
  timelineCursor: string | null;
  timelineLimit: number;
};

export type PoolsListItem = {
  poolId: string;
  label: string;
  poolAddress: string;
  tokenSymbols: string[];
  feeTierLabel: string | null;
  protocolFamily: string;
  status: "active" | "inactive" | "closed" | "unknown";
  exposureMix: "manual" | "automated" | "mixed" | "residual_only" | "unknown";
  currentAttributedValueUsd: number;
  capitalInvestedUsd: number;
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalRewardsUsd: number;
  investedDays: number | null;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  isInRange: boolean | null;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  coverageReasonCodes: string[];
  latestActivityAt: string | null;
  strategyLabels: string[];
  metricsEstimated: boolean;
};

export type PoolsListResponse = {
  walletAddress: string;
  chainId: number;
  analysisStatus: PoolsAnalysisStatus;
  coveredRange: {
    startDayUtc: string | null;
    endDayUtc: string | null;
  };
  summary: {
    poolCount: number;
    activePoolCount: number;
    activeInRangePoolCount: number;
    currentAttributedValueUsd: number;
    totalRewardsUsd: number;
    weightedAnnualizedReturnPct: number | null;
    series: {
      activePoolCount: number[];
      currentAttributedValueUsd: number[];
      totalRewardsUsd: number[];
      estimatedAnnualizedReturnPct: number[];
    };
    coverageStatus: "full" | "share_level" | "partial" | "unknown";
    coverageReasonCodes: string[];
  };
  items: PoolsListItem[];
  page: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type PoolHistoryPoint = {
  dayUtc: string;
  totalValueUsd: number;
  deployedValueUsd: number;
  residualValueUsd: number;
  manualValueUsd: number;
  strategyValueUsd: number;
  rewardValueUsd: number;
  cumulativeRewardsUsd: number;
  capitalInUsd: number;
  capitalOutUsd: number;
  metadata: Record<string, unknown>;
};

export type PoolTimelineItem = {
  eventKey: string;
  eventType: string;
  occurredAt: string;
  confidence: string;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  attributedValueUsd: number | null;
  relatedDepositId: string | null;
  relatedStrategyId: string | null;
  metadata: Record<string, unknown>;
};

export type PoolDetailResponse = {
  walletAddress: string;
  chainId: number;
  analysisStatus: PoolsAnalysisStatus;
  coveredRange: {
    startDayUtc: string | null;
    endDayUtc: string | null;
  };
  selectedRange: PoolDetailRange;
  header: {
    poolId: string;
    label: string;
    poolAddress: string;
    tokenSymbols: string[];
    feeTierLabel: string | null;
    status: "active" | "inactive" | "closed" | "unknown";
    currentAttributedValueUsd: number;
    capitalInvestedUsd: number;
    capitalEnteredUsd: number;
    capitalWithdrawnUsd: number;
    totalRewardsUsd: number;
    investedDays: number | null;
    totalReturnPct: number | null;
    realizedPnlUsd: number | null;
    unrealizedPnlUsd: number | null;
    annualizedReturnPct: number | null;
    coverageStatus: "full" | "share_level" | "partial" | "unknown";
    coverageReasonCodes: string[];
    strategyLabels: string[];
    metricsEstimated: boolean;
  };
  segments: {
    manual: { currentValueUsd: number; coverageStatus: "full" | "share_level" | "partial" | "unknown" };
    strategy: { currentValueUsd: number; coverageStatus: "full" | "share_level" | "partial" | "unknown" };
    residual: { currentValueUsd: number; coverageStatus: "full" | "share_level" | "partial" | "unknown" };
  };
  currentComposition: Array<{ tokenSymbol: string; amount: number | null; valueUsd: number | null; segment: "manual" | "strategy" | "residual" }>;
  history: {
    points: PoolHistoryPoint[];
    coverageStatus: "full" | "share_level" | "partial" | "unknown";
    coverageReasonCodes: string[];
  };
  timeline: {
    items: PoolTimelineItem[];
    nextCursor: string | null;
    hasMore: boolean;
  };
  related: {
    deposits: Array<{ id: string; label: string }>;
    strategies: Array<{ id: string; label: string }>;
  };
};