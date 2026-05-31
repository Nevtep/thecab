import type {
  ActivityAction,
  ActivityConfidence,
  ActivityCoverage,
  ActivityPageSize,
  ActivitySortDirection,
  ActivitySortKey,
  ActivitySurfaceFilter,
} from "@/server/activity/activity.contract";

export type ActivityRequest = {
  walletAddress: string;
  chainId: number;
  search: string;
  surface: ActivitySurfaceFilter;
  action: ActivityAction | "all";
  coverage: ActivityCoverage | null;
  confidence: ActivityConfidence | null;
  selectedActivityId: string | null;
  sort: {
    key: ActivitySortKey;
    direction: ActivitySortDirection;
  };
  page: number;
  pageSize: ActivityPageSize;
};

export type ActivityMovement = {
  id: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  direction: "in" | "out";
  amountRaw: string | null;
  amountUsd: string | null;
};

export type ActivityLinkedEntity = {
  kind: "pool" | "deposit" | "strategy" | "reward" | "governance" | "unavailable";
  label: string;
  href: string | null;
  reasonCode: string | null;
};

export type ActivityEventRow = {
  activityId: string;
  chainId: number;
  walletAddress: string;
  occurredAt: string;
  txHash: string | null;
  externalTxUrl: string | null;
  action: ActivityAction;
  actionLabelKey: string;
  surface: Exclude<ActivitySurfaceFilter, "all">;
  surfaceLabelKey: string;
  coverage: ActivityCoverage;
  confidence: ActivityConfidence;
  confidenceScore: number;
  valueUsd: string | null;
  primaryTokenAddress: string | null;
  primaryTokenSymbol: string | null;
  summary: string;
  reasonCodes: string[];
  movements: ActivityMovement[];
  linkedEntities: ActivityLinkedEntity[];
  metadata: Record<string, unknown>;
};

export type ActivitySummary = {
  totalEvents: number;
  interpretedEvents: number;
  totalValueUsd: string;
  excludedEvents: number;
  unresolvedEvents: number;
  coveragePercent: string;
};

export type ActivityAvailableFilters = {
  actions: ActivityAction[];
  surfaces: Array<Exclude<ActivitySurfaceFilter, "all">>;
  tokens: Array<{ tokenAddress: string; symbol: string | null }>;
};

export type ActivityRepositoryResult = {
  allRows: ActivityEventRow[];
  rows: ActivityEventRow[];
  totalRows: number;
  availableFilters: ActivityAvailableFilters;
};

export type ActivityResponse = {
  screenKind: "ready" | "locked" | "empty";
  walletAddress: string;
  chainId: number;
  analysis: {
    status: "not_analyzed" | "queued" | "running" | "ready" | "stale" | "failed";
    coverage: string;
    coverageReasons: string[];
  };
  summary: ActivitySummary;
  kpis: Array<{
    id: string;
    labelKey: string;
    value: string | number | null;
    valueKind: "currency" | "count" | "percent";
    contextLabelKey: string | null;
    coverage: ActivityCoverage;
  }>;
  events: {
    rows: ActivityEventRow[];
    pagination: {
      page: number;
      pageSize: ActivityPageSize;
      totalRows: number;
      totalPages: number;
    };
  };
  selectedActivity: ActivityEventRow | null;
  availableFilters: ActivityAvailableFilters;
  activeChips: Array<{
    id: string;
    labelKey: string;
    value: string;
    removeTarget: string;
  }>;
};
