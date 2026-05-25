import type { AnalysisStatus, AnalysisSummary } from "@/analysis/analysisStatus";

export type OverviewRange = "24h" | "7d" | "30d";

export type OverviewMode = "recent_view";

export type OverviewAnalysisStatus = AnalysisStatus;

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

export type ProtocolPositionCoverageReasonCode =
  | "protocolPositionsPresent"
  | "recentProtocolReconstruction"
  | "protocolValuationPartial"
  | "strategyShareLevelOnly"
  | "governanceValueUnavailable"
  | "positionMetadataIncomplete";

export type OverviewCoverageReasonCode =
  | ExistingOverviewCoverageReasonCode
  | OverviewTrustCoverageReasonCode
  | ProtocolPositionCoverageReasonCode;

export type ProtocolPositionFamily =
  | "manual_deposit"
  | "strategy_exposure"
  | "governance_lock"
  | "staked_lp";

export type ProtocolPositionCoverageStatus = "full" | "share_level" | "partial" | "unknown";

export type ProtocolPositionValueStatus = "current" | "estimated" | "unavailable";

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
  analysis: AnalysisSummary & {
    status: OverviewAnalysisStatus;
    stage: string | null;
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
      dimension: "manual_deposit" | "staked_lp" | "strategy" | "idle" | "governance";
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
  protocolPositions: {
    source: "recent_provider_data" | "partial_fallback";
    coverageStatus: "full" | "partial" | "unknown";
    coverageReasonCodes: ProtocolPositionCoverageReasonCode[] | null;
    rows: Array<{
      positionKey: string;
      chainId: number;
      walletAddress: string;
      family: ProtocolPositionFamily;
      protocol: string;
      label: string;
      status: "active" | "locked" | "staked" | "unknown";
      coverageStatus: ProtocolPositionCoverageStatus;
      coverageReasonCodes: ProtocolPositionCoverageReasonCode[];
      valueUsd: number | null;
      valueStatus: ProtocolPositionValueStatus;
      valueUpdatedAt: string | null;
      primaryTokenSymbol: string | null;
      secondaryTokenSymbol: string | null;
      primaryTokenAmount: number | null;
      secondaryTokenAmount: number | null;
      poolLabel: string | null;
      strategyLabel: string | null;
      governanceLabel: string | null;
      tokenId: string | null;
      metadata: {
        protocolSurface: string | null;
        wrapperAddress: string | null;
        positionContractAddress: string | null;
        lockEndAt: string | null;
        feeTierLabel: string | null;
        rangeLowerTick: number | null;
        rangeUpperTick: number | null;
        currentTick: number | null;
        isInRange: boolean | null;
        rangeLowerPrice: number | null;
        rangeUpperPrice: number | null;
        rangeQuoteTokenSymbol: string | null;
        rangeDisplayFractionDigits: number | null;
      };
    }>;
    summary: {
      totalCount: number;
      familyCounts: {
        manualDeposit: number;
        strategyExposure: number;
        governanceLock: number;
        stakedLp: number;
      };
      hasPartialValuation: boolean;
      hasShareLevelPositions: boolean;
      lastRefreshedAt: string | null;
    };
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