import type { RewardsUrlState } from "@/features/rewards/rewards.types";
import {
  normalizeRewardsAddress,
  normalizeRewardsCoverage,
  normalizeRewardsDatePreset,
  normalizeRewardsNullableText,
  normalizeRewardsPage,
  normalizeRewardsPageSize,
  normalizeRewardsResolution,
  normalizeRewardsSearch,
  normalizeRewardsSortDirection,
  normalizeRewardsSortKey,
  normalizeRewardsSource,
  normalizeRewardsUuid,
} from "@/features/rewards/rewards.validation";

export function createDefaultRewardsUrlState(): RewardsUrlState {
  return {
    search: "",
    datePreset: "all",
    dateStart: null,
    dateEnd: null,
    source: "all",
    tokenAddress: null,
    poolId: null,
    depositId: null,
    strategyExposureId: null,
    rewardType: null,
    coverage: null,
    resolutionStatus: null,
    selectedRewardEventId: null,
    sort: {
      key: "occurredAt",
      direction: "desc",
    },
    page: 1,
    pageSize: 25,
  };
}

function pickFirst(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) return value;
  }
  return null;
}

export function parseRewardsUrlState(searchParams: URLSearchParams): RewardsUrlState {
  return {
    search: normalizeRewardsSearch(searchParams.get("search")),
    datePreset: normalizeRewardsDatePreset(searchParams.get("datePreset")),
    dateStart: normalizeRewardsNullableText(searchParams.get("dateStart")),
    dateEnd: normalizeRewardsNullableText(searchParams.get("dateEnd")),
    source: normalizeRewardsSource(searchParams.get("source")),
    tokenAddress: normalizeRewardsAddress(pickFirst(searchParams, ["tokenAddress", "token"])),
    poolId: normalizeRewardsUuid(pickFirst(searchParams, ["poolId", "pool"])),
    depositId: normalizeRewardsUuid(pickFirst(searchParams, ["depositId", "deposit"])),
    strategyExposureId: normalizeRewardsUuid(pickFirst(searchParams, ["strategyExposureId", "strategy"])),
    rewardType: normalizeRewardsNullableText(searchParams.get("rewardType")),
    coverage: normalizeRewardsCoverage(searchParams.get("coverage")),
    resolutionStatus: normalizeRewardsResolution(searchParams.get("resolutionStatus")),
    selectedRewardEventId: normalizeRewardsUuid(pickFirst(searchParams, ["selectedRewardEventId", "selected"])),
    sort: {
      key: normalizeRewardsSortKey(searchParams.get("sort")),
      direction: normalizeRewardsSortDirection(searchParams.get("direction")),
    },
    page: normalizeRewardsPage(searchParams.get("page")),
    pageSize: normalizeRewardsPageSize(searchParams.get("pageSize")),
  };
}

export function serializeRewardsUrlState(state: RewardsUrlState): string {
  const params = new URLSearchParams();
  const defaults = createDefaultRewardsUrlState();
  if (state.search) params.set("search", state.search);
  if (state.datePreset !== defaults.datePreset) params.set("datePreset", state.datePreset);
  if (state.dateStart) params.set("dateStart", state.dateStart);
  if (state.dateEnd) params.set("dateEnd", state.dateEnd);
  if (state.source !== defaults.source) params.set("source", state.source);
  if (state.tokenAddress) params.set("token", state.tokenAddress);
  if (state.poolId) params.set("pool", state.poolId);
  if (state.depositId) params.set("deposit", state.depositId);
  if (state.strategyExposureId) params.set("strategy", state.strategyExposureId);
  if (state.rewardType) params.set("rewardType", state.rewardType);
  if (state.coverage) params.set("coverage", state.coverage);
  if (state.resolutionStatus) params.set("resolutionStatus", state.resolutionStatus);
  if (state.selectedRewardEventId) params.set("selected", state.selectedRewardEventId);
  if (state.sort.key !== defaults.sort.key) params.set("sort", state.sort.key);
  if (state.sort.direction !== defaults.sort.direction) params.set("direction", state.sort.direction);
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function normalizeRewardsFiltersForQueryKey(state: RewardsUrlState) {
  return {
    search: state.search,
    datePreset: state.datePreset,
    dateStart: state.dateStart,
    dateEnd: state.dateEnd,
    source: state.source,
    tokenAddress: state.tokenAddress,
    poolId: state.poolId,
    depositId: state.depositId,
    strategyExposureId: state.strategyExposureId,
    rewardType: state.rewardType,
    coverage: state.coverage,
    resolutionStatus: state.resolutionStatus,
    selectedRewardEventId: state.selectedRewardEventId,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  };
}

export function buildRewardsApiQueryString(input: { chainId: number; state: RewardsUrlState }) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId));
  const serialized = serializeRewardsUrlState(input.state);
  if (serialized) {
    const stateParams = new URLSearchParams(serialized);
    for (const [key, value] of stateParams.entries()) params.set(key, value);
  }
  return params.toString();
}
