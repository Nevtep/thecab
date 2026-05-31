import type { ActivityUrlState } from "@/features/activity/activity.types";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const surfaces = new Set<ActivityUrlState["surface"]>(["all", "wallet", "pools", "deposits", "strategies", "rewards", "governance", "unknown"]);
const actions = new Set<ActivityUrlState["action"]>(["all", "deposit", "withdraw", "swap", "claim", "strategy", "governance", "transfer", "airdrop", "unsupported", "ambiguous"]);
const coverages = new Set<NonNullable<ActivityUrlState["coverage"]>>(["full", "partial", "unresolved", "excluded", "unavailable"]);
const confidences = new Set<NonNullable<ActivityUrlState["confidence"]>>(["high", "medium", "low", "none"]);
const sortKeys = new Set<ActivityUrlState["sort"]["key"]>(["occurredAt", "valueUsd", "action", "coverage", "confidence"]);
const sortDirections = new Set<ActivityUrlState["sort"]["direction"]>(["asc", "desc"]);
const pageSizes = new Set<ActivityUrlState["pageSize"]>([10, 25, 50, 100]);

export function normalizeActivitySearch(value: string | null): string {
  return (value ?? "").trim().slice(0, 96);
}

export function normalizeActivitySurface(value: string | null): ActivityUrlState["surface"] {
  return surfaces.has(value as ActivityUrlState["surface"]) ? value as ActivityUrlState["surface"] : "all";
}

export function normalizeActivityAction(value: string | null): ActivityUrlState["action"] {
  return actions.has(value as ActivityUrlState["action"]) ? value as ActivityUrlState["action"] : "all";
}

export function normalizeActivityCoverage(value: string | null): ActivityUrlState["coverage"] {
  return coverages.has(value as NonNullable<ActivityUrlState["coverage"]>) ? value as ActivityUrlState["coverage"] : null;
}

export function normalizeActivityConfidence(value: string | null): ActivityUrlState["confidence"] {
  return confidences.has(value as NonNullable<ActivityUrlState["confidence"]>) ? value as ActivityUrlState["confidence"] : null;
}

export function normalizeActivityUuid(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export function normalizeActivitySortKey(value: string | null): ActivityUrlState["sort"]["key"] {
  return sortKeys.has(value as ActivityUrlState["sort"]["key"]) ? value as ActivityUrlState["sort"]["key"] : "occurredAt";
}

export function normalizeActivitySortDirection(value: string | null): ActivityUrlState["sort"]["direction"] {
  return sortDirections.has(value as ActivityUrlState["sort"]["direction"]) ? value as ActivityUrlState["sort"]["direction"] : "desc";
}

export function normalizeActivityPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeActivityPageSize(value: string | null): ActivityUrlState["pageSize"] {
  const parsed = Number(value);
  return pageSizes.has(parsed as ActivityUrlState["pageSize"]) ? parsed as ActivityUrlState["pageSize"] : 25;
}
