import type { RewardsUrlState } from "@/features/rewards/rewards.types";

export const REWARDS_DATE_PRESET_OPTIONS: Array<RewardsUrlState["datePreset"]> = ["7d", "30d", "90d", "1y", "all", "custom"];
export const REWARDS_SOURCE_OPTIONS: Array<RewardsUrlState["source"]> = ["all", "deposits", "strategies", "governance"];
export const REWARDS_COVERAGE_OPTIONS: Array<NonNullable<RewardsUrlState["coverage"]> | "all"> = [
  "all",
  "full",
  "partial",
  "unresolved",
  "excluded",
  "unavailable",
];
export const REWARDS_PAGE_SIZE_OPTIONS: Array<RewardsUrlState["pageSize"]> = [10, 25, 50, 100];

export function resetRewardsFilter(state: RewardsUrlState, target: string): RewardsUrlState {
  switch (target) {
    case "search":
      return { ...state, search: "", page: 1 };
    case "source":
      return { ...state, source: "all", page: 1 };
    case "tokenAddress":
      return { ...state, tokenAddress: null, page: 1 };
    case "poolId":
      return { ...state, poolId: null, page: 1 };
    case "depositId":
      return { ...state, depositId: null, page: 1 };
    case "strategyExposureId":
      return { ...state, strategyExposureId: null, page: 1 };
    case "coverage":
      return { ...state, coverage: null, page: 1 };
    case "resolutionStatus":
      return { ...state, resolutionStatus: null, page: 1 };
    default:
      return state;
  }
}
