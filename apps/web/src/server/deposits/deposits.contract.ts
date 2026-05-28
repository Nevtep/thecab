export const DEPOSITS_ANALYSIS_STATUS_VALUES = ["ready", "stale"] as const;
export const DEPOSITS_STATUS_FILTER_VALUES = ["all", "open_active", "open_out_of_range", "closed"] as const;
export const DEPOSITS_RETURN_SIGN_FILTER_VALUES = ["all", "positive", "negative"] as const;
export const DEPOSITS_SORT_FIELD_VALUES = ["openedAt", "currentValue", "totalReturn", "totalRewards", "estApr"] as const;
export const DEPOSITS_SORT_DIRECTION_VALUES = ["asc", "desc"] as const;
export const DEPOSITS_NAMED_SORT_VALUES = [
  "opened_desc",
  "opened_asc",
  "return_desc",
  "return_asc",
  "apr_desc",
  "apr_asc",
] as const;
export const DEPOSIT_POOL_KIND_VALUES = ["cl", "basic_stable", "basic_volatile", "unknown"] as const;
export const DEPOSIT_SUMMARY_STATUS_VALUES = ["open_active", "open_out_of_range", "closed"] as const;
export const DEPOSIT_COVERAGE_STATUS_VALUES = ["full", "share_level", "partial", "unknown"] as const;
export const DEPOSIT_CONFIDENCE_VALUES = ["high", "medium", "degraded", "unknown"] as const;
export const DEPOSIT_LIFECYCLE_EVENT_TYPE_VALUES = [
  "mint_position",
  "increase_liquidity",
  "stake",
  "claim_reward",
  "unstake",
  "decrease_liquidity",
  "collect_fees",
  "withdraw",
  "burn",
  "close",
  "transfer_in",
] as const;
export const DEPOSIT_VALUE_CHART_SERIES_KEYS = [
  "openedValue",
  "additionalCapital",
  "rewards",
  "currentValue",
  "withdrawal",
  "closedValue",
] as const;
export const DEPOSIT_VALUE_CHART_GAP_REASON_CODES = [
  "coverageGap",
  "priceUnavailable",
  "missingHistoricalPrice",
  "priceFallbackDca",
  "lowConfidenceClassification",
] as const;
export const DEPOSIT_PRICE_SOURCE_VALUES = ["event", "pricePointFallback", "unavailable"] as const;

export type DepositsAnalysisStatus = (typeof DEPOSITS_ANALYSIS_STATUS_VALUES)[number];
export type DepositsStatusFilter = (typeof DEPOSITS_STATUS_FILTER_VALUES)[number];
export type DepositsReturnSignFilter = (typeof DEPOSITS_RETURN_SIGN_FILTER_VALUES)[number];
export type DepositsSortField = (typeof DEPOSITS_SORT_FIELD_VALUES)[number];
export type DepositsSortDirection = (typeof DEPOSITS_SORT_DIRECTION_VALUES)[number];
export type DepositsNamedSort = (typeof DEPOSITS_NAMED_SORT_VALUES)[number];
export type DepositPoolKind = (typeof DEPOSIT_POOL_KIND_VALUES)[number];
export type DepositSummaryStatus = (typeof DEPOSIT_SUMMARY_STATUS_VALUES)[number];
export type DepositCoverageStatus = (typeof DEPOSIT_COVERAGE_STATUS_VALUES)[number];
export type DepositConfidence = (typeof DEPOSIT_CONFIDENCE_VALUES)[number];
export type DepositLifecycleEventType = (typeof DEPOSIT_LIFECYCLE_EVENT_TYPE_VALUES)[number];
export type DepositValueChartSeriesKey = (typeof DEPOSIT_VALUE_CHART_SERIES_KEYS)[number];
export type DepositValueChartGapReasonCode = (typeof DEPOSIT_VALUE_CHART_GAP_REASON_CODES)[number];
export type DepositPriceSource = (typeof DEPOSIT_PRICE_SOURCE_VALUES)[number];

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

export function parseNamedDepositsSort(value: string | null | undefined): {
  sort: DepositsSortField;
  direction: DepositsSortDirection;
} | null {
  switch (value) {
    case "opened_desc":
      return { sort: "openedAt", direction: "desc" };
    case "opened_asc":
      return { sort: "openedAt", direction: "asc" };
    case "return_desc":
      return { sort: "totalReturn", direction: "desc" };
    case "return_asc":
      return { sort: "totalReturn", direction: "asc" };
    case "apr_desc":
      return { sort: "estApr", direction: "desc" };
    case "apr_asc":
      return { sort: "estApr", direction: "asc" };
    default:
      return null;
  }
}

export function toNamedDepositsSort(
  sort: DepositsSortField,
  direction: DepositsSortDirection,
): DepositsNamedSort | null {
  if (sort === "openedAt") {
    return direction === "asc" ? "opened_asc" : "opened_desc";
  }
  if (sort === "totalReturn") {
    return direction === "asc" ? "return_asc" : "return_desc";
  }
  if (sort === "estApr") {
    return direction === "asc" ? "apr_asc" : "apr_desc";
  }
  return null;
}