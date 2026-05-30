import type {
  RewardEventRow,
  RewardsActiveChip,
  RewardsConfidence,
  RewardsCoverageState,
  RewardsDatePreset,
  RewardsDistribution,
  RewardsGrouping,
  RewardsKpi,
  RewardsOverTimeBucket,
  RewardsPageSize,
  RewardsResolutionStatus,
  RewardsResponse,
  RewardsReturnCoverage,
  RewardsSortDirection,
  RewardsSortKey,
  RewardsSourceFilter,
  SelectedReward,
} from "@/server/rewards/rewards.types";

export type {
  RewardEventRow,
  RewardsActiveChip,
  RewardsConfidence,
  RewardsCoverageState,
  RewardsDatePreset,
  RewardsDistribution,
  RewardsGrouping,
  RewardsKpi,
  RewardsOverTimeBucket,
  RewardsPageSize,
  RewardsResolutionStatus,
  RewardsResponse,
  RewardsReturnCoverage,
  RewardsSortDirection,
  RewardsSortKey,
  RewardsSourceFilter,
  SelectedReward,
};

export type RewardsUrlState = {
  search: string;
  datePreset: RewardsDatePreset;
  dateStart: string | null;
  dateEnd: string | null;
  source: RewardsSourceFilter;
  tokenAddress: string | null;
  poolId: string | null;
  depositId: string | null;
  strategyExposureId: string | null;
  rewardType: string | null;
  coverage: RewardsCoverageState | null;
  resolutionStatus: RewardsResolutionStatus | null;
  selectedRewardEventId: string | null;
  sort: {
    key: RewardsSortKey;
    direction: RewardsSortDirection;
  };
  page: number;
  pageSize: RewardsPageSize;
};

export type RewardsViewModel = RewardsResponse & {
  screenKind: "locked" | "empty" | "ready";
};
