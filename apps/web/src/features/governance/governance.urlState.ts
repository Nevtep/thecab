import type { GovernanceUrlState } from "@/features/governance/governance.types";
import {
  normalizeGovernanceAddress,
  normalizeGovernanceConfidence,
  normalizeGovernanceCoverage,
  normalizeGovernanceDatePreset,
  normalizeGovernanceEpochId,
  normalizeGovernanceEventType,
  normalizeGovernancePage,
  normalizeGovernancePageSize,
  normalizeGovernanceProtocolSurface,
  normalizeGovernanceRewardType,
  normalizeGovernanceSearch,
  normalizeGovernanceSelectionKind,
  normalizeGovernanceSortDirection,
  normalizeGovernanceSortKey,
  normalizeGovernanceUuid,
} from "@/features/governance/governance.validation";

export function createDefaultGovernanceUrlState(): GovernanceUrlState {
  return {
    search: "",
    datePreset: "all",
    eventType: "all",
    rewardType: "all",
    protocolSurface: "all",
    epochId: null,
    poolId: null,
    tokenAddress: null,
    coverage: null,
    confidence: null,
    selectedKind: null,
    selectedGovernanceId: null,
    sort: {
      key: "occurredAt",
      direction: "desc",
    },
    page: 1,
    pageSize: 10,
  };
}

function pickFirst(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) return value;
  }
  return null;
}

export function parseGovernanceUrlState(searchParams: URLSearchParams): GovernanceUrlState {
  return {
    search: normalizeGovernanceSearch(searchParams.get("search")),
    datePreset: normalizeGovernanceDatePreset(searchParams.get("range")),
    eventType: normalizeGovernanceEventType(searchParams.get("eventType")),
    rewardType: normalizeGovernanceRewardType(searchParams.get("rewardType")),
    protocolSurface: normalizeGovernanceProtocolSurface(searchParams.get("protocolSurface")),
    epochId: normalizeGovernanceEpochId(searchParams.get("epochId")),
    poolId: normalizeGovernanceUuid(searchParams.get("poolId")),
    tokenAddress: normalizeGovernanceAddress(searchParams.get("tokenAddress")),
    coverage: normalizeGovernanceCoverage(searchParams.get("coverage")),
    confidence: normalizeGovernanceConfidence(searchParams.get("confidence")),
    selectedKind: normalizeGovernanceSelectionKind(pickFirst(searchParams, ["selectedKind", "kind"])),
    selectedGovernanceId: normalizeGovernanceUuid(pickFirst(searchParams, ["selectedGovernanceId", "selected"])),
    sort: {
      key: normalizeGovernanceSortKey(searchParams.get("sort")),
      direction: normalizeGovernanceSortDirection(searchParams.get("direction")),
    },
    page: normalizeGovernancePage(searchParams.get("page")),
    pageSize: normalizeGovernancePageSize(searchParams.get("pageSize")),
  };
}

export function serializeGovernanceUrlState(state: GovernanceUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultGovernanceUrlState();
  if (state.search) params.set("search", state.search);
  if (state.datePreset !== defaults.datePreset) params.set("range", state.datePreset);
  if (state.eventType !== defaults.eventType) params.set("eventType", state.eventType);
  if (state.rewardType !== defaults.rewardType) params.set("rewardType", state.rewardType);
  if (state.protocolSurface !== defaults.protocolSurface) params.set("protocolSurface", state.protocolSurface);
  if (state.epochId) params.set("epochId", state.epochId);
  if (state.poolId) params.set("poolId", state.poolId);
  if (state.tokenAddress) params.set("tokenAddress", state.tokenAddress);
  if (state.coverage) params.set("coverage", state.coverage);
  if (state.confidence) params.set("confidence", state.confidence);
  if (state.selectedKind) params.set("kind", state.selectedKind);
  if (state.selectedGovernanceId) params.set("selected", state.selectedGovernanceId);
  if (state.sort.key !== defaults.sort.key) params.set("sort", state.sort.key);
  if (state.sort.direction !== defaults.sort.direction) params.set("direction", state.sort.direction);
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function normalizeGovernanceFiltersForQueryKey(state: GovernanceUrlState) {
  return {
    search: state.search,
    datePreset: state.datePreset,
    eventType: state.eventType,
    rewardType: state.rewardType,
    protocolSurface: state.protocolSurface,
    epochId: state.epochId,
    poolId: state.poolId,
    tokenAddress: state.tokenAddress,
    coverage: state.coverage,
    confidence: state.confidence,
    selectedKind: state.selectedKind,
    selectedGovernanceId: state.selectedGovernanceId,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function buildGovernanceApiQueryString(input: { chainId: number; state: GovernanceUrlState }) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  const serialized = serializeGovernanceUrlState(input.state);
  if (serialized) {
    const stateParams = new URLSearchParams(serialized);
    for (const [key, value] of stateParams.entries()) params.set(key, value);
  }
  return params.toString();
}

export function resetGovernanceFilter(state: GovernanceUrlState, target: string): GovernanceUrlState {
  return {
    ...state,
    search: target === "search" ? "" : state.search,
    datePreset: target === "datePreset" ? "all" : state.datePreset,
    eventType: target === "eventType" ? "all" : state.eventType,
    rewardType: target === "rewardType" ? "all" : state.rewardType,
    protocolSurface: target === "protocolSurface" ? "all" : state.protocolSurface,
    epochId: target === "epochId" ? null : state.epochId,
    poolId: target === "poolId" ? null : state.poolId,
    tokenAddress: target === "tokenAddress" ? null : state.tokenAddress,
    coverage: target === "coverage" ? null : state.coverage,
    confidence: target === "confidence" ? null : state.confidence,
    page: 1,
  };
}
