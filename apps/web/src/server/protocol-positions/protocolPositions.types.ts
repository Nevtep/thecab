export const PROTOCOL_POSITION_FAMILIES = [
  "manual_deposit",
  "strategy_exposure",
  "governance_lock",
  "staked_lp",
] as const;

export const PROTOCOL_POSITION_COVERAGE_STATUSES = [
  "full",
  "share_level",
  "partial",
  "unknown",
] as const;

export const PROTOCOL_POSITION_VALUE_STATUSES = [
  "current",
  "estimated",
  "unavailable",
] as const;

export const PROTOCOL_POSITION_COVERAGE_REASON_CODES = [
  "protocolPositionsPresent",
  "recentProtocolReconstruction",
  "protocolValuationPartial",
  "strategyShareLevelOnly",
  "governanceValueUnavailable",
  "positionMetadataIncomplete",
] as const;

export type ProtocolPositionFamily = (typeof PROTOCOL_POSITION_FAMILIES)[number];
export type ProtocolPositionCoverageStatus = (typeof PROTOCOL_POSITION_COVERAGE_STATUSES)[number];
export type ProtocolPositionValueStatus = (typeof PROTOCOL_POSITION_VALUE_STATUSES)[number];
export type ProtocolPositionCoverageReasonCode =
  (typeof PROTOCOL_POSITION_COVERAGE_REASON_CODES)[number];

export type OverviewProtocolPosition = {
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
    poolAddress: string | null;
    externalDepositReference?: string | null;
    externalDepositReferenceStatus?: "resolved" | "unresolved" | null;
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
};

export type OverviewProtocolPositionsSummary = {
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

export type OverviewProtocolPositionsBlock = {
  source: "recent_provider_data" | "partial_fallback";
  coverageStatus: "full" | "partial" | "unknown";
  coverageReasonCodes: ProtocolPositionCoverageReasonCode[] | null;
  rows: OverviewProtocolPosition[];
  summary: OverviewProtocolPositionsSummary;
};