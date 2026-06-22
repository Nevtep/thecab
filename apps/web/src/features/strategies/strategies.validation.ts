import {
  normalizeOneOf,
  STRATEGIES_COVERAGE_FILTER_VALUES,
  STRATEGIES_PAGE_SIZE_VALUES,
  STRATEGIES_PROTOCOL_FILTER_VALUES,
  STRATEGIES_RETURN_SIGN_FILTER_VALUES,
  STRATEGIES_SORT_VALUES,
  STRATEGIES_STATUS_FILTER_VALUES,
} from "@/server/strategies/strategies.contract";
import { normalizeOpaqueEntityId } from "@/analysis/opaqueEntityId";
import type {
  StrategiesCoverageFilter,
  StrategiesPageSize,
  StrategiesProtocolFilter,
  StrategiesReturnSignFilter,
  StrategiesSort,
  StrategiesStatusFilter,
} from "@/features/strategies/strategies.types";

export const STRATEGIES_SEARCH_MAX_LENGTH = 64;
export const STRATEGIES_MAX_PAGE = 10_000;

export function normalizeStrategiesStatusFilter(value: string | null | undefined): StrategiesStatusFilter {
  return normalizeOneOf(value, STRATEGIES_STATUS_FILTER_VALUES, "active");
}

export function normalizeStrategiesProtocolFilter(value: string | null | undefined): StrategiesProtocolFilter {
  return normalizeOneOf(value, STRATEGIES_PROTOCOL_FILTER_VALUES, "mellow");
}

export function normalizeStrategiesCoverageFilter(value: string | null | undefined): StrategiesCoverageFilter {
  return normalizeOneOf(value, STRATEGIES_COVERAGE_FILTER_VALUES, "all");
}

export function normalizeStrategiesReturnSignFilter(value: string | null | undefined): StrategiesReturnSignFilter {
  return normalizeOneOf(value, STRATEGIES_RETURN_SIGN_FILTER_VALUES, "any");
}

export function normalizeStrategiesSort(value: string | null | undefined): StrategiesSort {
  return normalizeOneOf(value, STRATEGIES_SORT_VALUES, "current_value_desc");
}

export function normalizeStrategiesUuid(value: string | null | undefined): string | null {
  return normalizeOpaqueEntityId(value);
}

export function normalizeStrategiesSearch(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, STRATEGIES_SEARCH_MAX_LENGTH);
}

export function normalizeStrategiesPage(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 1;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const truncated = Math.trunc(parsed);
  return truncated >= 1 && truncated <= STRATEGIES_MAX_PAGE ? truncated : 1;
}

export function normalizeStrategiesPageSize(value: string | number | null | undefined): StrategiesPageSize {
  const parsed = typeof value === "number" ? value : Number(value);
  return (STRATEGIES_PAGE_SIZE_VALUES as readonly number[]).includes(parsed)
    ? (parsed as StrategiesPageSize)
    : 10;
}
