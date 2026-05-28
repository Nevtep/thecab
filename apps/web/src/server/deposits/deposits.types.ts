export type DepositsAnalysisStatus = "ready" | "stale";

export type DepositsStatusFilter = "all" | "open_active" | "open_out_of_range" | "closed";
export type DepositsReturnSignFilter = "all" | "positive" | "negative";
export type DepositsSortField =
  | "openedAt"
  | "currentValue"
  | "totalReturn"
  | "totalRewards"
  | "estApr";
export type DepositsSortDirection = "asc" | "desc";

export type DepositSummaryStatus = "open_active" | "open_out_of_range" | "closed";

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
  poolKind: "cl" | "basic_stable" | "basic_volatile" | "unknown";
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
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  confidence: "high" | "medium" | "degraded" | "unknown";
  coverageReasonCodes: string[];
  coveredStartDayUtc: string | null;
  coveredEndDayUtc: string | null;
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
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  coverageReasonCodes: string[];
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
  deposit: DepositSummaryView;
};
