import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDepositRewardsHref,
  buildGovernanceRewardDetailHref,
  buildGovernanceRewardsHref,
  buildPoolRewardsHref,
  buildStrategyRewardsHref,
} from "@/features/rewards/rewards.navigation";

const id = "123e4567-e89b-12d3-a456-426614174000";

test("rewards navigation helpers preserve incoming context as URL filters", () => {
  assert.equal(buildPoolRewardsHref(id), `/rewards?pool=${id}`);
  assert.equal(buildDepositRewardsHref(id), `/rewards?source=deposits&deposit=${id}`);
  assert.equal(buildStrategyRewardsHref(id), `/rewards?source=strategies&strategy=${id}`);
  assert.equal(buildGovernanceRewardsHref(id), `/rewards?source=governance&selected=${id}`);
  assert.equal(buildGovernanceRewardDetailHref(id, 8453), `/governance?kind=reward&selected=${id}&rewardEventId=${id}&chainId=8453`);
});
