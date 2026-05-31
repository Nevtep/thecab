import type { RewardsUrlState } from "@/features/rewards/rewards.types";
import { createDefaultRewardsUrlState, serializeRewardsUrlState } from "@/features/rewards/rewards.urlState";

export function buildRewardsHref(state: Partial<RewardsUrlState> = {}) {
  const query = serializeRewardsUrlState({
    ...createDefaultRewardsUrlState(),
    ...state,
    sort: state.sort ?? createDefaultRewardsUrlState().sort,
  });
  return query ? `/rewards?${query}` : "/rewards";
}

export function buildPoolRewardsHref(poolId: string) {
  return buildRewardsHref({ poolId });
}

export function buildDepositRewardsHref(depositId: string) {
  return buildRewardsHref({ depositId, source: "deposits" });
}

export function buildStrategyRewardsHref(strategyExposureId: string) {
  return buildRewardsHref({ strategyExposureId, source: "strategies" });
}

export function buildGovernanceRewardsHref(rewardEventId?: string | null) {
  return buildRewardsHref({
    source: "governance",
    selectedRewardEventId: rewardEventId ?? null,
  });
}

export function buildGovernanceRewardDetailHref(rewardEventId: string, chainId?: number) {
  const params = new URLSearchParams({
    kind: "reward",
    selected: rewardEventId,
    rewardEventId,
  });
  if (typeof chainId === "number") params.set("chainId", String(chainId));
  return `/governance?${params.toString()}`;
}
