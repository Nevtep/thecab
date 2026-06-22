import type {
  RewardsAnalysisStatus,
  RewardsConfidence,
  RewardsCoverageState,
  RewardsDatePreset,
  RewardsGrouping,
  RewardsPageSize,
  RewardsPoolContributionStatus,
  RewardsResolutionStatus,
  RewardsReturnCoverage,
  RewardsSortDirection,
  RewardsSortKey,
  RewardsSourceFilter,
} from "@/server/rewards/rewards.contract";

export type {
  RewardsAnalysisStatus,
  RewardsConfidence,
  RewardsCoverageState,
  RewardsDatePreset,
  RewardsGrouping,
  RewardsPageSize,
  RewardsPoolContributionStatus,
  RewardsResolutionStatus,
  RewardsReturnCoverage,
  RewardsSortDirection,
  RewardsSortKey,
  RewardsSourceFilter,
};

export type RewardsRequest = {
  walletAddress: string;
  chainId: number;
  search: string;
  datePreset: RewardsDatePreset;
  dateStart: string | null;
  dateEnd: string | null;
  source: RewardsSourceFilter;
  tokenAddress: string | null;
  poolId: string | null;
  depositId: string | null;
  strategyExposureId: string | null;
  rewardType: string | null;
  coverage: RewardsCoverageState | null;
  resolutionStatus: RewardsResolutionStatus | null;
  selectedRewardEventId: string | null;
  sort: {
    key: RewardsSortKey;
    direction: RewardsSortDirection;
  };
  page: number;
  pageSize: RewardsPageSize;
};

export type RewardsActiveChip = {
  id: string;
  labelKey: string;
  value: string;
  removeTarget: string;
};

export type RewardsFilterState = Omit<RewardsRequest, "walletAddress" | "chainId"> & {
  dateRange: {
    start: string | null;
    end: string | null;
  };
  activeChips: RewardsActiveChip[];
};

export type RewardsAnalysisInfo = {
  status: RewardsAnalysisStatus;
  runId: string | null;
  completedAt: string | null;
  coveredRange: {
    start: string | null;
    end: string | null;
  };
  isStale: boolean;
  reasonCode?: string;
};

export type RewardsKpi = {
  id: string;
  labelKey: string;
  value: string | number | null;
  valueKind: "currency" | "count" | "percent";
  context: {
    labelKey: string;
    value?: string | number | null;
  };
  coverageState: RewardsCoverageState | RewardsReturnCoverage;
};

export type RewardsSummary = {
  totalClaimedRewardsUsd: string;
  rewardEventCount: number;
  estimatedRewardReturnPct: string | null;
  estimatedRewardReturnCoverage: RewardsReturnCoverage;
  resolvedRewardsUsd: string;
  resolvedRewardsSharePct: string;
  unresolvedExcludedUsd: string;
  unresolvedExcludedSharePct: string;
  coverageState: RewardsCoverageState;
  coveragePercent: string;
  coverageReasonCodes: string[];
};

export type RewardsOverTimeBucket = {
  bucketStart: string;
  bucketEnd: string | null;
  claimedValueUsd: string;
  resolvedValueUsd: string;
  unresolvedExcludedValueUsd: string;
  cumulativeClaimedValueUsd: string;
  estimatedRewardReturnPct: string | null;
  rewardEventCount: number;
  claimMarkers: Array<{ rewardEventId: string; tokenSymbol: string | null }>;
  coverageState: RewardsCoverageState;
  coverageReasonCodes: string[];
};

export type RewardsDistributionItem = {
  id: string;
  label: string;
  labelKey: string | null;
  valueUsd: string;
  sharePct: string;
  count: number;
  coverageState: RewardsCoverageState;
  filterTarget: Partial<RewardsRequest>;
};

export type RewardsDistribution = {
  totalUsd: string;
  coverageState: RewardsCoverageState;
  items: RewardsDistributionItem[];
};

export type RewardOwner = {
  status: "manual_deposit" | "strategy" | "governance" | "unresolved" | "excluded" | "unavailable";
  labelKey: string;
  entityId: string | null;
  entityLabel: string | null;
  route: string | null;
};

export type RewardPoolContribution = {
  status: RewardsPoolContributionStatus;
  poolId: string | null;
  poolLabel: string | null;
  route: string | null;
  countingRule: string;
};

export type RewardEventRow = {
  rewardEventId: string;
  occurredAt: string;
  token: {
    address: string | null;
    symbol: string | null;
    iconUrl: string | null;
    decimals?: number | null;
  };
  tokenAmount: string | null;
  tokenAmountRaw?: string | null;
  tokenAmountFormatted?: string | null;
  usdValueAtClaim: string | null;
  owner: RewardOwner;
  sourceSurface: string;
  poolContribution: RewardPoolContribution;
  rewardType: string;
  coverageState: RewardsCoverageState;
  confidence: RewardsConfidence;
  confidenceDots: number;
  resolutionReasonCodes: string[];
  txHash: string | null;
  externalTxUrl: string | null;
};

export type SelectedReward = {
  rewardEventId: string;
  summary: {
    tokenAddress: string | null;
    tokenIconUrl: string | null;
    tokenSymbol: string | null;
    rewardTypeLabelKey: string;
    tokenAmount: string | null;
    usdValueAtClaim: string | null;
    ownerStatus: RewardOwner["status"];
    coverageState: RewardsCoverageState;
    confidence: RewardsConfidence;
  };
  ownershipTrace: {
    ownerStatus: RewardOwner["status"];
    linkedEntityLabel: string | null;
    linkedEntityRoute: string | null;
    sourceSurface: string;
    evidenceKey: string;
  };
  poolContribution: {
    status: RewardsPoolContributionStatus;
    linkedPoolLabel: string | null;
    linkedPoolRoute: string | null;
    countingRuleKey: string;
    noteKey: string;
  };
  claimDetails: {
    txHash: string | null;
    claimTime: string;
    rewardType: string;
    sourceContract: string | null;
    externalTxUrl: string | null;
  };
  coverageNotes: {
    coverageState: RewardsCoverageState;
    includedInAggregates: boolean;
    reasonCodes: string[];
  };
  unresolvedExcludedActivity: Array<{
    rewardEventId: string;
    tokenSymbol: string | null;
    occurredAt: string;
    tokenAmount: string | null;
    usdValueAtClaim: string | null;
    reasonCode: string;
  }>;
};

export type RewardsResponse = {
  walletAddress: string;
  chainId: number;
  analysis: RewardsAnalysisInfo;
  filters: RewardsFilterState;
  summary: RewardsSummary | null;
  kpis: RewardsKpi[];
  overTime: {
    grouping: RewardsGrouping;
    coveragePercent: string;
    coverageState: RewardsCoverageState;
    coverageReasonCodes: string[];
    buckets: RewardsOverTimeBucket[];
  };
  distributions: {
    source: RewardsDistribution;
    pool: RewardsDistribution;
    token: RewardsDistribution;
  };
  events: {
    rows: RewardEventRow[];
    pagination: {
      page: number;
      pageSize: RewardsPageSize;
      totalRows: number;
      totalPages: number;
    };
  };
  selectedReward: SelectedReward | null;
  availableFilters: {
    sources: RewardsSourceFilter[];
    tokens: Array<{ tokenAddress: string; symbol: string | null }>;
    pools: Array<{ poolId: string; label: string }>;
    rewardTypes: string[];
    coverageStates: RewardsCoverageState[];
  };
};
