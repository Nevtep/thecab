import type { GovernanceUrlState } from "@/features/governance/governance.types";
import {
  GOVERNANCE_COVERAGE_STATES,
  GOVERNANCE_CONFIDENCE_STATES,
  GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_PAGE_SIZES,
  GOVERNANCE_PROTOCOL_SURFACES,
  GOVERNANCE_REWARD_TYPES,
  GOVERNANCE_SORT_KEYS,
} from "@/server/governance/governance.contract";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const datePresets = new Set<GovernanceUrlState["datePreset"]>(["7d", "30d", "90d", "1y", "all", "custom"]);
const eventTypes = new Set<GovernanceUrlState["eventType"]>(GOVERNANCE_EVENT_TYPES);
const rewardTypes = new Set<GovernanceUrlState["rewardType"]>(GOVERNANCE_REWARD_TYPES);
const protocolSurfaces = new Set<GovernanceUrlState["protocolSurface"]>(GOVERNANCE_PROTOCOL_SURFACES);
const coverages = new Set<NonNullable<GovernanceUrlState["coverage"]>>(GOVERNANCE_COVERAGE_STATES);
const confidences = new Set<NonNullable<GovernanceUrlState["confidence"]>>(GOVERNANCE_CONFIDENCE_STATES);
const selectionKinds = new Set<NonNullable<GovernanceUrlState["selectedKind"]>>(["event", "reward", "epoch", "metric"]);
const sortKeys = new Set<GovernanceUrlState["sort"]["key"]>(GOVERNANCE_SORT_KEYS);
const sortDirections = new Set<GovernanceUrlState["sort"]["direction"]>(["asc", "desc"]);
const pageSizes = new Set<GovernanceUrlState["pageSize"]>(GOVERNANCE_PAGE_SIZES);

export function normalizeGovernanceSearch(value: string | null): string {
  return (value ?? "").trim().slice(0, 96);
}

export function normalizeGovernanceDatePreset(value: string | null): GovernanceUrlState["datePreset"] {
  return datePresets.has(value as GovernanceUrlState["datePreset"])
    ? value as GovernanceUrlState["datePreset"]
    : "all";
}

export function normalizeGovernanceEventType(value: string | null): GovernanceUrlState["eventType"] {
  return eventTypes.has(value as GovernanceUrlState["eventType"])
    ? value as GovernanceUrlState["eventType"]
    : "all";
}

export function normalizeGovernanceRewardType(value: string | null): GovernanceUrlState["rewardType"] {
  return rewardTypes.has(value as GovernanceUrlState["rewardType"])
    ? value as GovernanceUrlState["rewardType"]
    : "all";
}

export function normalizeGovernanceProtocolSurface(value: string | null): GovernanceUrlState["protocolSurface"] {
  return protocolSurfaces.has(value as GovernanceUrlState["protocolSurface"])
    ? value as GovernanceUrlState["protocolSurface"]
    : "all";
}

export function normalizeGovernanceCoverage(value: string | null): GovernanceUrlState["coverage"] {
  return coverages.has(value as NonNullable<GovernanceUrlState["coverage"]>)
    ? value as GovernanceUrlState["coverage"]
    : null;
}

export function normalizeGovernanceConfidence(value: string | null): GovernanceUrlState["confidence"] {
  return confidences.has(value as NonNullable<GovernanceUrlState["confidence"]>)
    ? value as GovernanceUrlState["confidence"]
    : null;
}

export function normalizeGovernanceUuid(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export function normalizeGovernanceAddress(value: string | null): string | null {
  return value && ADDRESS_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function normalizeGovernanceEpochId(value: string | null): string | null {
  const normalized = (value ?? "").trim().slice(0, 64);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeGovernanceSelectionKind(value: string | null): GovernanceUrlState["selectedKind"] {
  return selectionKinds.has(value as NonNullable<GovernanceUrlState["selectedKind"]>)
    ? value as GovernanceUrlState["selectedKind"]
    : null;
}

export function normalizeGovernanceSortKey(value: string | null): GovernanceUrlState["sort"]["key"] {
  return sortKeys.has(value as GovernanceUrlState["sort"]["key"])
    ? value as GovernanceUrlState["sort"]["key"]
    : "occurredAt";
}

export function normalizeGovernanceSortDirection(value: string | null): GovernanceUrlState["sort"]["direction"] {
  return sortDirections.has(value as GovernanceUrlState["sort"]["direction"])
    ? value as GovernanceUrlState["sort"]["direction"]
    : "desc";
}

export function normalizeGovernancePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeGovernancePageSize(value: string | null): GovernanceUrlState["pageSize"] {
  const parsed = Number(value);
  return pageSizes.has(parsed as GovernanceUrlState["pageSize"])
    ? parsed as GovernanceUrlState["pageSize"]
    : 10;
}
