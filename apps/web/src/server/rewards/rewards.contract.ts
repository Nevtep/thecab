export const REWARDS_ANALYSIS_STATUS_VALUES = ["locked", "ready", "stale"] as const;
export const REWARDS_DATE_PRESET_VALUES = ["7d", "30d", "90d", "1y", "all", "custom"] as const;
export const REWARDS_SOURCE_FILTER_VALUES = [
  "all",
  "deposits",
  "strategies",
  "governance",
  "unresolved",
  "excluded",
  "unavailable",
] as const;
export const REWARDS_COVERAGE_VALUES = ["full", "partial", "unresolved", "excluded", "unavailable"] as const;
export const REWARDS_RESOLUTION_STATUS_VALUES = ["resolved", "unresolved", "excluded", "unavailable"] as const;
export const REWARDS_POOL_CONTRIBUTION_VALUES = ["contributes", "none", "unresolved", "excluded", "unavailable"] as const;
export const REWARDS_CONFIDENCE_VALUES = ["high", "medium", "low", "none"] as const;
export const REWARDS_RETURN_COVERAGE_VALUES = ["full", "estimated", "partial", "unavailable"] as const;
export const REWARDS_SORT_KEY_VALUES = ["occurredAt", "valueUsd", "tokenAmount", "source", "owner", "coverage"] as const;
export const REWARDS_SORT_DIRECTION_VALUES = ["asc", "desc"] as const;
export const REWARDS_PAGE_SIZE_VALUES = [10, 25, 50, 100] as const;
export const REWARDS_GROUPING_VALUES = ["daily", "weekly", "monthly"] as const;

export type RewardsAnalysisStatus = (typeof REWARDS_ANALYSIS_STATUS_VALUES)[number];
export type RewardsDatePreset = (typeof REWARDS_DATE_PRESET_VALUES)[number];
export type RewardsSourceFilter = (typeof REWARDS_SOURCE_FILTER_VALUES)[number];
export type RewardsCoverageState = (typeof REWARDS_COVERAGE_VALUES)[number];
export type RewardsResolutionStatus = (typeof REWARDS_RESOLUTION_STATUS_VALUES)[number];
export type RewardsPoolContributionStatus = (typeof REWARDS_POOL_CONTRIBUTION_VALUES)[number];
export type RewardsConfidence = (typeof REWARDS_CONFIDENCE_VALUES)[number];
export type RewardsReturnCoverage = (typeof REWARDS_RETURN_COVERAGE_VALUES)[number];
export type RewardsSortKey = (typeof REWARDS_SORT_KEY_VALUES)[number];
export type RewardsSortDirection = (typeof REWARDS_SORT_DIRECTION_VALUES)[number];
export type RewardsPageSize = (typeof REWARDS_PAGE_SIZE_VALUES)[number];
export type RewardsGrouping = (typeof REWARDS_GROUPING_VALUES)[number];

export function isRewardsOneOf<const TValues extends readonly string[]>(
  value: string | null | undefined,
  allowed: TValues,
): value is TValues[number] {
  return value !== null && value !== undefined && (allowed as readonly string[]).includes(value);
}

export function normalizeRewardsOneOf<const TValues extends readonly string[]>(
  value: string | null | undefined,
  allowed: TValues,
  fallback: TValues[number],
): TValues[number] {
  return isRewardsOneOf(value, allowed) ? value : fallback;
}
