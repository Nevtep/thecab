import type { ActivityUrlState } from "@/features/activity/activity.types";
import { normalizeOpaqueEntityId } from "@/analysis/opaqueEntityId";

const surfaces = new Set<ActivityUrlState["surface"]>(["all", "wallet", "pools", "deposits", "strategies", "rewards", "governance", "unknown"]);
const actions = new Set<ActivityUrlState["action"]>([
  "all",
  "approval",
  "failed",
  "position_created",
  "deposit",
  "withdraw",
  "swap",
  "claim",
  "strategy",
  "governance",
  "stake",
  "unstake",
  "cash_in",
  "cash_out",
  "noop",
  "transfer",
  "airdrop",
  "unsupported",
  "ambiguous",
]);
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
  return normalizeOpaqueEntityId(value);
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
  return pageSizes.has(parsed as ActivityUrlState["pageSize"]) ? parsed as ActivityUrlState["pageSize"] : 10;
}
