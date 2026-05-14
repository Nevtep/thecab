import type { CabAnalysisStatus, CabIconName } from "@/design-system";
import type {
  OverviewAnalysisStatus,
  OverviewRange,
  OverviewScreenState,
  OverviewViewModel,
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

function dedupeReasonCodes(reasonCodes: string[] | null) {
  return reasonCodes ? Array.from(new Set(reasonCodes)) : null;
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
      reasonCodes: Array.from(new Set(response.coverage.reasonCodes)),
    },
    summary: {
      ...response.summary,
      walletAddress: response.summary.walletAddress.toLowerCase(),
      coverageReasonCodes: dedupeReasonCodes(response.summary.coverageReasonCodes),
    },
    metrics: {
      ...response.metrics,
      coverageReasonCodes: dedupeReasonCodes(response.metrics.coverageReasonCodes),
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
    },
    assets: {
      ...response.assets,
      coverageReasonCodes: dedupeReasonCodes(response.assets.coverageReasonCodes),
      rows: [...response.assets.rows].sort(
        (left, right) => (right.valueUsd ?? -1) - (left.valueUsd ?? -1),
      ),
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