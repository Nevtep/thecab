import {
  REWARDS_COVERAGE_VALUES,
  REWARDS_DATE_PRESET_VALUES,
  REWARDS_PAGE_SIZE_VALUES,
  REWARDS_RESOLUTION_STATUS_VALUES,
  REWARDS_SORT_DIRECTION_VALUES,
  REWARDS_SORT_KEY_VALUES,
  REWARDS_SOURCE_FILTER_VALUES,
  normalizeRewardsOneOf,
} from "@/server/rewards/rewards.contract";
import type {
  RewardsCoverageState,
  RewardsDatePreset,
  RewardsPageSize,
  RewardsResolutionStatus,
  RewardsSortDirection,
  RewardsSortKey,
  RewardsSourceFilter,
} from "@/features/rewards/rewards.types";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function normalizeRewardsSearch(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, 96);
}

export function normalizeRewardsDatePreset(value: string | null | undefined): RewardsDatePreset {
  return normalizeRewardsOneOf(value, REWARDS_DATE_PRESET_VALUES, "all");
}

export function normalizeRewardsSource(value: string | null | undefined): RewardsSourceFilter {
  return normalizeRewardsOneOf(value, REWARDS_SOURCE_FILTER_VALUES, "all");
}

export function normalizeRewardsCoverage(value: string | null | undefined): RewardsCoverageState | null {
  return value ? normalizeRewardsOneOf(value, REWARDS_COVERAGE_VALUES, "full") : null;
}

export function normalizeRewardsResolution(value: string | null | undefined): RewardsResolutionStatus | null {
  return value ? normalizeRewardsOneOf(value, REWARDS_RESOLUTION_STATUS_VALUES, "resolved") : null;
}

export function normalizeRewardsSortKey(value: string | null | undefined): RewardsSortKey {
  return normalizeRewardsOneOf(value, REWARDS_SORT_KEY_VALUES, "occurredAt");
}

export function normalizeRewardsSortDirection(value: string | null | undefined): RewardsSortDirection {
  return normalizeRewardsOneOf(value, REWARDS_SORT_DIRECTION_VALUES, "desc");
}

export function normalizeRewardsUuid(value: string | null | undefined) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export function normalizeRewardsAddress(value: string | null | undefined) {
  return value && ADDRESS_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function normalizeRewardsNullableText(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : null;
}

export function normalizeRewardsPage(value: string | null | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeRewardsPageSize(value: string | null | undefined): RewardsPageSize {
  const parsed = Number(value ?? 25);
  return (REWARDS_PAGE_SIZE_VALUES as readonly number[]).includes(parsed) ? parsed as RewardsPageSize : 25;
}
