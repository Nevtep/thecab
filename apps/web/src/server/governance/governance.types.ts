import type {
  GOVERNANCE_CONFIDENCE_STATES,
  GOVERNANCE_COVERAGE_STATES,
  GOVERNANCE_ERROR_CODES,
  GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_PROTOCOL_SURFACES,
  GOVERNANCE_REWARD_TYPES,
  GOVERNANCE_SORT_KEYS,
} from "@/server/governance/governance.contract";

export type GovernanceEventType = Exclude<typeof GOVERNANCE_EVENT_TYPES[number], "all">;
export type GovernanceRewardType = Exclude<typeof GOVERNANCE_REWARD_TYPES[number], "all">;
export type GovernanceProtocolSurface = Exclude<typeof GOVERNANCE_PROTOCOL_SURFACES[number], "all">;
export type GovernanceCoverageState = typeof GOVERNANCE_COVERAGE_STATES[number];
export type GovernanceConfidence = typeof GOVERNANCE_CONFIDENCE_STATES[number];
export type GovernanceSortKey = typeof GOVERNANCE_SORT_KEYS[number];
export type GovernanceErrorCode = typeof GOVERNANCE_ERROR_CODES[number];

export type GovernanceAnalysisState = {
  status: "idle" | "queued" | "running" | "ready" | "failed" | "stale";
  runId: string | null;
  completedAt: string | null;
  isStale: boolean;
};

export type GovernanceValueState = {
  value: string | null;
  valueUsd?: string | null;
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  reasonCodes: string[];
};

export type GovernanceSummary = {
  lockedAero: GovernanceValueState;
  veAeroExposure: GovernanceValueState;
  lockExpiry: {
    expiresAt: string | null;
    remainingDays: number | null;
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
    reasonCodes: string[];
  };
  governanceRewardsClaimedUsd: GovernanceValueState;
  estimatedGovernanceReturn: GovernanceValueState;
  overallCoverage: {
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
    reasonCodes: string[];
  };
};

export type GovernanceLockPanel = {
  lockExposureId: string | null;
  lockId: string | null;
  status: "active" | "expired" | "withdrawn" | "partial" | "unknown";
  createdAt: string | null;
  expiresAt: string | null;
  lockedAeroAmount: string | null;
  lockedAeroValueUsd: string | null;
  veAeroExposure: string | null;
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  reasonCodes: string[];
  lifecycle: GovernanceLockLifecycleItem[];
};

export type GovernanceLockLifecycleItem = {
  eventId: string;
  eventType: GovernanceEventType;
  occurredAt: string;
  amountDelta: string | null;
  durationDeltaDays: number | null;
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
};

export type GovernanceEpochSummary = {
  epochId: string;
  epochLabel: string;
  epochStartAt: string | null;
  epochEndAt: string | null;
  votedPools: Array<{
    poolId: string;
    label: string;
    weightPercent: string | null;
  }>;
  voteMode: "manual" | "relay" | "mixed" | "unknown";
  resetState: "not_reset" | "reset" | "unknown";
  rewardState: "claimed" | "pending" | "none" | "partial" | "unknown";
  feesUsd: string | null;
  bribesUsd: string | null;
  rebasesUsd: string | null;
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
};

export type GovernanceRewardRow = {
  governanceRewardId: string;
  rewardEventId: string | null;
  claimedAt: string | null;
  rewardType: GovernanceRewardType;
  token: {
    address: string | null;
    symbol: string;
    iconUrl: string | null;
  };
  amount: string | null;
  valueUsdAtClaim: string | null;
  epochId: string | null;
  pool: {
    poolId: string;
    label: string;
  } | null;
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  context: {
    kind: "epoch" | "pool" | "reward" | "unknown";
    label: string;
  };
};

export type GovernanceSelectedDetail = {
  selectionKind: "event" | "reward" | "epoch" | "metric" | "empty";
  selectionId: string | null;
  actionSummary: {
    labelKey: string;
    contextLabel: string | null;
  };
  transaction: {
    txHash: string | null;
    occurredAt: string | null;
    externalTxUrl: string | null;
  };
  protocolSurface: GovernanceProtocolSurface | "unknown";
  tokenMovements: Array<Record<string, unknown>>;
  valueEffect: {
    valueUsd: string | null;
    coverageState: GovernanceCoverageState;
  };
  epochContext: Record<string, unknown> | null;
  poolContext: Record<string, unknown> | null;
  classificationEvidence: {
    basis: string[];
    reasonCodes: string[];
    missingEvidenceReasonCodes: string[];
  };
  linkedContexts: Array<{
    kind: "activity" | "reward" | "pool";
    entityId: string;
    route: string;
  }>;
  coverageNotes: {
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
    affectsTotals: boolean;
    reasonCodes: string[];
  };
  sourceEvidenceRefs: Array<Record<string, unknown>>;
};

export type GovernanceResponse = {
  walletAddress: string;
  chainId: number;
  analysis: GovernanceAnalysisState;
  filters: GovernanceFilters;
  summary: GovernanceSummary;
  lockPanel: GovernanceLockPanel | null;
  epochTimeline: {
    epochs: GovernanceEpochSummary[];
  };
  rewardBreakdown: {
    totalValueUsd: string | null;
    coverageState: GovernanceCoverageState;
    segments: Array<{
      rewardType: GovernanceRewardType;
      valueUsd: string | null;
      percent: string | null;
      coverageState: GovernanceCoverageState;
    }>;
  };
  rewards: {
    rows: GovernanceRewardRow[];
    pagination: {
      page: number;
      pageSize: number;
      totalRows: number;
      totalPages: number;
    };
  };
  selectedDetail: GovernanceSelectedDetail;
  availableFilters: Record<string, unknown>;
};

export type GovernanceFilters = {
  search: string;
  datePreset: "7d" | "30d" | "90d" | "1y" | "all" | "custom";
  eventType: typeof GOVERNANCE_EVENT_TYPES[number];
  rewardType: typeof GOVERNANCE_REWARD_TYPES[number];
  protocolSurface: typeof GOVERNANCE_PROTOCOL_SURFACES[number];
  epochId: string | null;
  poolId: string | null;
  tokenAddress: string | null;
  coverage: GovernanceCoverageState | null;
  confidence: GovernanceConfidence | null;
  selectedKind: "event" | "reward" | "epoch" | "metric" | null;
  selectedGovernanceId: string | null;
  sort: {
    key: GovernanceSortKey;
    direction: "asc" | "desc";
  };
  page: number;
  pageSize: 10 | 25 | 50;
  activeChips: Array<{
    id: string;
    labelKey: string;
    value: string;
    removeTarget: string;
  }>;
};
