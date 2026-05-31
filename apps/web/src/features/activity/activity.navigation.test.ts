import assert from "node:assert/strict";
import test from "node:test";

import { getActivityHref } from "@/features/activity/activity.navigation";

test("getActivityHref preserves chain and incoming selected context", () => {
  assert.equal(
    getActivityHref({
      chainId: 8453,
      selectedActivityId: "123e4567-e89b-12d3-a456-426614174000",
      surface: "rewards",
      action: "claim",
      poolId: "33333333-3333-4333-8333-333333333333",
    }),
    "/activity?chainId=8453&selected=123e4567-e89b-12d3-a456-426614174000&surface=rewards&action=claim&poolId=33333333-3333-4333-8333-333333333333",
  );
});
