import type { RewardsResponse, RewardsViewModel } from "@/features/rewards/rewards.types";

export function mapRewardsResponseToViewModel(response: RewardsResponse): RewardsViewModel {
  if (response.analysis.status === "locked") {
    return { ...response, screenKind: "locked" };
  }
  if (
    response.events.rows.length === 0 &&
    response.summary?.rewardEventCount === 0 &&
    response.filters.activeChips.length === 0
  ) {
    return { ...response, screenKind: "empty" };
  }
  return { ...response, screenKind: "ready" };
}

export function getCoverageLabelKey(coverage: string) {
  return `coverage:level.${coverage}`;
}

export function getConfidenceLabelKey(confidence: string) {
  return `rewards:confidence.${confidence}`;
}
