import type { CabAnalysisStatus, CabBadgeProps, CabIconName } from "@/design-system";
import type {
  OverviewAnalysisStatus,
  OverviewCoverageReasonCode,
  OverviewRange,
  OverviewScreenState,
  OverviewViewModel,
  TokenTrustReasonCode,
  TokenTrustStatus,
} from "@/features/overview/overview.types";

export type OverviewNavigationItem = {
  key:
    | "overview"
    | "pools"
    | "deposits"
    | "strategies"
    | "rewards"
    | "governance"
    | "activity"
    | "settings";
  iconName: CabIconName;
  labelKey: string;
  stateKey: "active" | "requiresAnalysis" | "comingSoon";
  disabled: boolean;
};

export type PartitionedOverviewAssetRows = {
  visibleRows: OverviewViewModel["assets"]["rows"];
  hiddenRows: OverviewViewModel["assets"]["rows"];
};

function dedupeReasonCodes<TCode extends string>(reasonCodes: TCode[] | null) {
  return reasonCodes ? Array.from(new Set(reasonCodes)) : null;
}

function dedupeRequiredReasonCodes<TCode extends string>(reasonCodes: TCode[]) {
  return Array.from(new Set(reasonCodes));
}

export function createInitialOverviewScreenState(
  walletAddress: string | null = null,
  chainId: number | null = null,
): OverviewScreenState {
  return {
    walletAddress,
    chainId,
    range: "7d",
  };
}

export function normalizeOverviewRange(range?: string | null): OverviewRange {
  if (range === "24h" || range === "30d") {
    return range;
  }

  return "7d";
}

export function mapOverviewResponseToViewModel(response: OverviewViewModel): OverviewViewModel {
  return {
    ...response,
    walletAddress: response.walletAddress.toLowerCase(),
    selectedRange: normalizeOverviewRange(response.selectedRange),
    coverage: {
      ...response.coverage,
      reasonCodes: dedupeRequiredReasonCodes<OverviewCoverageReasonCode>(response.coverage.reasonCodes),
    },
    summary: {
      ...response.summary,
      walletAddress: response.summary.walletAddress.toLowerCase(),
      coverageReasonCodes: dedupeReasonCodes(response.summary.coverageReasonCodes),
    },
    metrics: {
      ...response.metrics,
      coverageReasonCodes: dedupeReasonCodes(response.metrics.coverageReasonCodes),
      exclusions: response.metrics.exclusions
        ? {
            ...response.metrics.exclusions,
            reasonCodes: dedupeRequiredReasonCodes(response.metrics.exclusions.reasonCodes),
          }
        : null,
    },
    chart: {
      ...response.chart,
      coverageReasonCodes: dedupeReasonCodes(response.chart.coverageReasonCodes),
      points: [...response.chart.points].sort((left, right) =>
        left.capturedAt.localeCompare(right.capturedAt),
      ),
    },
    distribution: {
      ...response.distribution,
      coverageReasonCodes: dedupeReasonCodes(response.distribution.coverageReasonCodes),
      slices: [...response.distribution.slices].sort((left, right) => right.valueUsd - left.valueUsd),
      exclusions: response.distribution.exclusions
        ? {
            ...response.distribution.exclusions,
            reasonCodes: dedupeRequiredReasonCodes(response.distribution.exclusions.reasonCodes),
          }
        : null,
    },
    assets: {
      ...response.assets,
      coverageReasonCodes: dedupeReasonCodes(response.assets.coverageReasonCodes),
      rows: [...response.assets.rows].sort(
        (left, right) => (right.valueUsd ?? -1) - (left.valueUsd ?? -1),
      ).map((row) => ({
        ...row,
        trustReasonCodes: dedupeRequiredReasonCodes<TokenTrustReasonCode>(row.trustReasonCodes),
      })),
      hiddenSummary: response.assets.hiddenSummary
        ? {
            ...response.assets.hiddenSummary,
            reasonCodes: dedupeRequiredReasonCodes(response.assets.hiddenSummary.reasonCodes),
          }
        : null,
    },
    activity: {
      ...response.activity,
      coverageReasonCodes: dedupeReasonCodes(response.activity.coverageReasonCodes),
      items: [...response.activity.items].sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      ),
    },
  };
}

export function partitionOverviewAssetRows(
  rows: OverviewViewModel["assets"]["rows"],
): PartitionedOverviewAssetRows {
  return {
    visibleRows: rows.filter((row) => !row.isHiddenByDefault),
    hiddenRows: rows.filter((row) => row.isHiddenByDefault),
  };
}

export function getOverviewTrustBadgeTone(
  trustStatus: TokenTrustStatus,
): NonNullable<CabBadgeProps["tone"]> {
  switch (trustStatus) {
    case "trusted":
    case "verified":
      return "success";
    case "known_protocol":
      return "info";
    case "priced":
      return "neutral";
    case "low_confidence":
    case "unknown":
      return "warning";
    case "possible_spam":
    case "blocked":
      return "danger";
  }
}

export function getOverviewTrustStatusLabelKey(trustStatus: TokenTrustStatus) {
  return `trust:status.${trustStatus}`;
}

export function getOverviewTrustReasonLabelKeys(reasonCodes: TokenTrustReasonCode[]) {
  return reasonCodes.map((reasonCode) => `trust:reasons.${reasonCode}`);
}

export function getOverviewCoverageReasonLabelKeys(reasonCodes: OverviewCoverageReasonCode[] | null) {
  return (reasonCodes ?? []).map((reasonCode) => `coverage:reasons.${reasonCode}`);
}

export function mapOverviewAnalysisStatusToBadgeStatus(
  status: OverviewAnalysisStatus,
): CabAnalysisStatus {
  switch (status) {
    case "not_analyzed":
      return "not_started";
    case "queued":
    case "running":
    case "ready":
    case "failed":
    case "stale":
      return status;
  }
}

export function formatWalletAddressLabel(walletAddress: string) {
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

export function getOverviewNavigationItems(
  status: OverviewAnalysisStatus,
): OverviewNavigationItem[] {
  const analysisReady = status === "ready" || status === "stale";

  return [
    {
      key: "overview",
      iconName: "dashboard",
      labelKey: "navigation:items.overview",
      stateKey: "active",
      disabled: false,
    },
    {
      key: "pools",
      iconName: "pools",
      labelKey: "navigation:items.pools",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "deposits",
      iconName: "deposits",
      labelKey: "navigation:items.deposits",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "strategies",
      iconName: "strategies",
      labelKey: "navigation:items.strategies",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "rewards",
      iconName: "rewards",
      labelKey: "navigation:items.rewards",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "governance",
      iconName: "governance",
      labelKey: "navigation:items.governance",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "activity",
      iconName: "activity",
      labelKey: "navigation:items.activity",
      stateKey: analysisReady ? "comingSoon" : "requiresAnalysis",
      disabled: true,
    },
    {
      key: "settings",
      iconName: "settings",
      labelKey: "navigation:items.settings",
      stateKey: "comingSoon",
      disabled: true,
    },
  ];
}