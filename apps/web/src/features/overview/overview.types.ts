export type OverviewRange = "24h" | "7d" | "30d";

export type OverviewMode = "recent_view";

export type OverviewAnalysisStatus =
  | "not_analyzed"
  | "queued"
  | "running"
  | "ready"
  | "stale"
  | "failed";

export type OverviewCoverageStatus = "recent" | "partial" | "unknown";

export type OverviewScreenState = {
  walletAddress: string | null;
  chainId: number | null;
  range: OverviewRange;
};

export type OverviewViewModel = {
  walletAddress: string;
  chainId: number;
  mode: OverviewMode;
  selectedRange: OverviewRange;
  analysis: {
    status: OverviewAnalysisStatus;
    runId: string | null;
    stage: string;
    progressPct: number;
    lastSuccessfulRunAt: string | null;
    lastUpdatedAt: string | null;
    lastError: string | null;
  };
  coverage: {
    status: OverviewCoverageStatus;
    confidence: "low" | "medium" | "high" | null;
    reasonCodes: string[];
    details: string | null;
  };
  summary: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
    walletAddress: string;
    chainId: number;
    chainLabel: string;
    lastRefreshedAt: string | null;
    modeLabelKey: string;
  };
  metrics: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
    netPortfolioValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    changeOverSelectedPeriodPct: number | null;
    estimatedRealizedRewardsUsd: number | null;
    manualDepositsValueUsd: number | null;
    automatedStrategiesValueUsd: number | null;
    residualAttributedValueUsd: number | null;
    governanceValueUsd: number | null;
  };
  chart: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
    range: OverviewRange;
    hasRewardMarkers: boolean;
    points: Array<{
      capturedAt: string;
      totalValueUsd: number | null;
      deployedValueUsd: number | null;
      idleValueUsd: number | null;
      rewardValueUsd: number | null;
    }>;
  };
  distribution: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
    slices: Array<{
      dimension: "pool" | "token" | "strategy" | "idle" | "governance";
      label: string;
      valueUsd: number;
      coverageStatus: OverviewCoverageStatus | null;
    }>;
  };
  assets: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
    rows: Array<{
      tokenAddress: string | null;
      symbol: string;
      balance: string;
      priceUsd: number | null;
      valueUsd: number | null;
      movement24hPct: number | null;
      movement7dPct: number | null;
      classification: "deployed" | "idle" | "residual" | "reward" | "governance" | "unknown";
      priceConfidence: "low" | "medium" | "high" | null;
    }>;
  };
  activity: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: string[] | null;
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
};

export type OverviewQueryInput = {
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
};