export const ACTIVITY_ACTION_VALUES = [
  "deposit",
  "withdraw",
  "swap",
  "claim",
  "strategy",
  "governance",
  "transfer",
  "airdrop",
  "unsupported",
  "ambiguous",
] as const;

export const ACTIVITY_SURFACE_VALUES = [
  "all",
  "wallet",
  "pools",
  "deposits",
  "strategies",
  "rewards",
  "governance",
  "unknown",
] as const;

export const ACTIVITY_COVERAGE_VALUES = [
  "full",
  "partial",
  "unresolved",
  "excluded",
  "unavailable",
] as const;

export const ACTIVITY_CONFIDENCE_VALUES = [
  "high",
  "medium",
  "low",
  "none",
] as const;

export const ACTIVITY_PAGE_SIZE_VALUES = [10, 25, 50, 100] as const;
export const ACTIVITY_SORT_KEY_VALUES = ["occurredAt", "valueUsd", "action", "coverage", "confidence"] as const;
export const ACTIVITY_SORT_DIRECTION_VALUES = ["asc", "desc"] as const;

export type ActivityAction = typeof ACTIVITY_ACTION_VALUES[number];
export type ActivitySurfaceFilter = typeof ACTIVITY_SURFACE_VALUES[number];
export type ActivityCoverage = typeof ACTIVITY_COVERAGE_VALUES[number];
export type ActivityConfidence = typeof ACTIVITY_CONFIDENCE_VALUES[number];
export type ActivityPageSize = typeof ACTIVITY_PAGE_SIZE_VALUES[number];
export type ActivitySortKey = typeof ACTIVITY_SORT_KEY_VALUES[number];
export type ActivitySortDirection = typeof ACTIVITY_SORT_DIRECTION_VALUES[number];

export type ActivityErrorCode =
  | "UNAUTHENTICATED_WALLET"
  | "UNSUPPORTED_CHAIN"
  | "INVALID_ACTIVITY_FILTERS"
  | "ACTIVITY_READ_FAILED";
