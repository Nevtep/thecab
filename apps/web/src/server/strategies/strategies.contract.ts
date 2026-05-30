export const STRATEGIES_ANALYSIS_STATUS_VALUES = ["ready", "stale"] as const;
export const STRATEGIES_STATUS_FILTER_VALUES = ["active", "closed", "all"] as const;
export const STRATEGIES_PROTOCOL_FILTER_VALUES = ["mellow", "all"] as const;
export const STRATEGIES_COVERAGE_FILTER_VALUES = ["full", "share_level", "partial", "unknown", "all"] as const;
export const STRATEGIES_RETURN_SIGN_FILTER_VALUES = ["positive", "negative", "any"] as const;
export const STRATEGIES_SORT_VALUES = [
  "current_value_desc",
  "current_value_asc",
  "opened_desc",
  "opened_asc",
  "return_desc",
  "return_asc",
  "coverage_asc",
  "coverage_desc",
] as const;
export const STRATEGIES_PAGE_SIZE_VALUES = [10, 25, 50] as const;

export const STRATEGY_PROTOCOL_VALUES = ["mellow"] as const;
export const STRATEGY_SUMMARY_STATUS_VALUES = ["active", "closed", "unknown"] as const;
export const STRATEGY_COVERAGE_STATUS_VALUES = ["full", "share_level", "partial", "unknown"] as const;
export const STRATEGY_CONFIDENCE_VALUES = ["high", "medium", "low", "degraded", "unknown"] as const;
export const STRATEGY_POOL_MAPPING_STATUS_VALUES = ["confirmed", "inferred", "unknown"] as const;
export const STRATEGY_EXTERNAL_REFERENCE_STATUS_VALUES = ["resolved", "unresolved"] as const;
export const STRATEGY_PRICE_SOURCE_VALUES = [
  "alchemyHistorical",
  "pricePointFallback",
  "unavailable",
  "unknown",
] as const;
export const STRATEGY_LIFECYCLE_EVENT_TYPE_VALUES = [
  "strategy_deposit",
  "strategy_share_receive",
  "strategy_stake",
  "strategy_claim",
  "strategy_unstake",
  "strategy_withdraw",
  "strategy_share_redeem",
  "strategy_close",
  "strategy_internal_rebalance",
  "strategy_fee_dilution",
  "strategy_baseline_transfer_in",
  "unresolved_strategy_reward",
] as const;

export type StrategiesAnalysisStatus = (typeof STRATEGIES_ANALYSIS_STATUS_VALUES)[number];
export type StrategiesStatusFilter = (typeof STRATEGIES_STATUS_FILTER_VALUES)[number];
export type StrategiesProtocolFilter = (typeof STRATEGIES_PROTOCOL_FILTER_VALUES)[number];
export type StrategiesCoverageFilter = (typeof STRATEGIES_COVERAGE_FILTER_VALUES)[number];
export type StrategiesReturnSignFilter = (typeof STRATEGIES_RETURN_SIGN_FILTER_VALUES)[number];
export type StrategiesSort = (typeof STRATEGIES_SORT_VALUES)[number];
export type StrategiesPageSize = (typeof STRATEGIES_PAGE_SIZE_VALUES)[number];
export type StrategyProtocol = (typeof STRATEGY_PROTOCOL_VALUES)[number];
export type StrategySummaryStatus = (typeof STRATEGY_SUMMARY_STATUS_VALUES)[number];
export type StrategyCoverageStatus = (typeof STRATEGY_COVERAGE_STATUS_VALUES)[number];
export type StrategyConfidence = (typeof STRATEGY_CONFIDENCE_VALUES)[number];
export type StrategyPoolMappingStatus = (typeof STRATEGY_POOL_MAPPING_STATUS_VALUES)[number];
export type StrategyExternalReferenceStatus = (typeof STRATEGY_EXTERNAL_REFERENCE_STATUS_VALUES)[number];
export type StrategyPriceSource = (typeof STRATEGY_PRICE_SOURCE_VALUES)[number];
export type StrategyLifecycleEventType = (typeof STRATEGY_LIFECYCLE_EVENT_TYPE_VALUES)[number];

export function isOneOf<const TValues extends readonly string[]>(
  value: string | null | undefined,
  allowed: TValues,
): value is TValues[number] {
  return value !== null && value !== undefined && (allowed as readonly string[]).includes(value);
}

export function normalizeOneOf<const TValues extends readonly string[]>(
  value: string | null | undefined,
  allowed: TValues,
  fallback: TValues[number],
): TValues[number] {
  return isOneOf(value, allowed) ? value : fallback;
}

