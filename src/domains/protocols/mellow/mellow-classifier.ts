import { getMellowAction } from "@/domains/protocols/mellow/contracts";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export function classifyMellowEventType(semantic: FixtureSemantic) {
  switch (getMellowAction(semantic)) {
    case "depositAndStake":
      return semantic.lifecycleSequence != null && semantic.lifecycleSequence > 1
        ? ("mellow_exposure_increased" as const)
        : ("mellow_exposure_opened" as const);
    case "unstakeAndWithdraw":
      return "mellow_exposure_decreased" as const;
    case "claimReward":
      return "mellow_reward_claimed" as const;
    default:
      return null;
  }
}