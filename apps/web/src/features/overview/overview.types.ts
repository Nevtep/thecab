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

export type ExistingOverviewCoverageReasonCode =
  | "analysisPending"
  | "providerPartial"
  | "missingPrices"
  | "noRecentActivity";

export type OverviewTrustCoverageReasonCode =
  | "excludedSuspiciousAssets"
  | "lowConfidenceAssetsHidden"
  | "missingPrices"
  | "visibleUnpricedAssets"
  | "hiddenAssetsPresent"
  | "knownProtocolSignalConflict"
  | "providerTrustSignalsMissing"
  | "metadataIncomplete"
  | "dustAssetsHidden"
  | "valuationPartial";

export type OverviewCoverageReasonCode =
  | ExistingOverviewCoverageReasonCode
  | OverviewTrustCoverageReasonCode;

export type TokenTrustStatus =
  | "trusted"
  | "verified"
  | "known_protocol"
  | "priced"
  | "low_confidence"
  | "possible_spam"
  | "blocked"
  | "unknown";

export type TokenTrustReasonCode =
  | "moralisPossibleSpam"
  | "moralisVerifiedContract"
  | "alchemyMissingPrice"
  | "missingLogo"
  | "missingMetadata"
  | "suspiciousSymbol"
  | "zeroOrDustValue"
  | "unrecognizedContract"
  | "knownAerodromeToken"
  | "knownProtocolContract"
  | "hasReliablePrice"
  | "userHidden"
  | "userAllowed";

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
    reasonCodes: OverviewCoverageReasonCode[];
    details: string | null;
  };
  summary: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
    walletAddress: string;
    chainId: number;
    chainLabel: string;
    lastRefreshedAt: string | null;
    modeLabelKey: string;
  };
  metrics: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
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
  chart: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
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
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
    slices: Array<{
      dimension: "pool" | "token" | "strategy" | "idle" | "governance";
      label: string;
      valueUsd: number;
      coverageStatus: OverviewCoverageStatus | null;
    }>;
    exclusions: OverviewExclusionSummary | null;
  };
  assets: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
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
  activity: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: OverviewCoverageStatus;
    coverageReasonCodes: OverviewCoverageReasonCode[] | null;
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

export type OverviewQueryInput = {
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
};