import type {
  OverviewTrustCoverageReasonCode,
  TokenTrustReasonCode,
  TokenTrustStatus,
} from "@/server/asset-trust/assetTrust.types";

export const OVERVIEW_RANGES = ["24h", "7d", "30d"] as const;

export const EXISTING_OVERVIEW_COVERAGE_REASON_CODES = [
  "analysisPending",
  "providerPartial",
  "missingPrices",
  "noRecentActivity",
] as const;

export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export type ExistingOverviewCoverageReasonCode =
  (typeof EXISTING_OVERVIEW_COVERAGE_REASON_CODES)[number];

export type OverviewCoverageReasonCode =
  | ExistingOverviewCoverageReasonCode
  | OverviewTrustCoverageReasonCode;

export type OverviewMode = "recent_view";

export type OverviewDataSource = "recent_provider_data" | "partial_fallback";

export type OverviewCoverageStatus = "recent" | "partial" | "unknown";

export type OverviewAnalysisStatus =
  | "not_analyzed"
  | "queued"
  | "running"
  | "ready"
  | "stale"
  | "failed";

export type OverviewBlockProvenance = {
  source: OverviewDataSource;
  coverageStatus: OverviewCoverageStatus;
  coverageReasonCodes: OverviewCoverageReasonCode[] | null;
};

export type OverviewRequest = {
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
};

export type OverviewAnalysisState = {
  status: OverviewAnalysisStatus;
  runId: string | null;
  stage: string;
  progressPct: number;
  lastSuccessfulRunAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

export type OverviewCoverage = {
  status: OverviewCoverageStatus;
  confidence: "low" | "medium" | "high" | null;
  reasonCodes: OverviewCoverageReasonCode[];
  details: string | null;
};

export type OverviewSummary = OverviewBlockProvenance & {
  walletAddress: string;
  chainId: number;
  chainLabel: string;
  lastRefreshedAt: string | null;
  modeLabelKey: string;
};

export type OverviewMetrics = OverviewBlockProvenance & {
  netPortfolioValueUsd: number | null;
  deployedValueUsd: number | null;
  idleValueUsd: number | null;
  changeOverSelectedPeriodPct: number | null;
  estimatedRealizedRewardsUsd: number | null;
  manualDepositsValueUsd: number | null;
  automatedStrategiesValueUsd: number | null;
  residualAttributedValueUsd: number | null;
  governanceValueUsd: number | null;
  exclusions: OverviewExclusionSummary | null;
};

export type OverviewChartPoint = {
  capturedAt: string;
  totalValueUsd: number | null;
  deployedValueUsd: number | null;
  idleValueUsd: number | null;
  rewardValueUsd: number | null;
};

export type OverviewChart = OverviewBlockProvenance & {
  range: OverviewRange;
  hasRewardMarkers: boolean;
  points: OverviewChartPoint[];
};

export type OverviewDistribution = OverviewBlockProvenance & {
  slices: Array<{
    dimension: "pool" | "token" | "strategy" | "idle" | "governance";
    label: string;
    valueUsd: number;
    coverageStatus: OverviewCoverageStatus | null;
  }>;
  exclusions: OverviewExclusionSummary | null;
};

export type OverviewExclusionSummary = {
  excludedAssetCount: number;
  excludedValueUsd: number | null;
  reasonCodes: OverviewTrustCoverageReasonCode[];
  includesUnpricedVisibleAssets: boolean;
};

export type HiddenAssetSummary = {
  hiddenCount: number;
  hiddenValueUsd: number | null;
  reasonCodes: OverviewTrustCoverageReasonCode[];
  affectsTotals: boolean;
  allVisibleAssetsUnpricedOrZero: boolean;
};

export type OverviewAssets = OverviewBlockProvenance & {
  rows: Array<{
    tokenAddress: string | null;
    chainId: number;
    symbol: string;
    name: string | null;
    balance: string;
    priceUsd: number | null;
    valueUsd: number | null;
    movement24hPct: number | null;
    movement7dPct: number | null;
    classification: "deployed" | "idle" | "residual" | "reward" | "governance" | "unknown";
    priceConfidence: "low" | "medium" | "high" | null;
    trustStatus: TokenTrustStatus;
    trustReasonCodes: TokenTrustReasonCode[];
    isHiddenByDefault: boolean;
    classifierVersion: string | null;
  }>;
  hiddenSummary: HiddenAssetSummary | null;
  defaultVisibleCount: number;
};

export type OverviewActivity = OverviewBlockProvenance & {
  items: Array<{
    id: string;
    occurredAt: string;
    eventType: string;
    labelKey: string;
    txHash: string | null;
    confidence: "low" | "medium" | "high" | null;
    isUnclassified: boolean;
  }>;
};

export type OverviewResponse = {
  walletAddress: string;
  chainId: number;
  mode: OverviewMode;
  selectedRange: OverviewRange;
  analysis: OverviewAnalysisState;
  coverage: OverviewCoverage;
  summary: OverviewSummary;
  metrics: OverviewMetrics;
  chart: OverviewChart;
  distribution: OverviewDistribution;
  assets: OverviewAssets;
  activity: OverviewActivity;
};