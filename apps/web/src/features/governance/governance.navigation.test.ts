import assert from "node:assert/strict";
import test from "node:test";

import { getGovernanceHref } from "@/features/governance/governance.navigation";

test("getGovernanceHref builds chain-aware links with selected detail", () => {
  assert.equal(
    getGovernanceHref({
      chainId: 8453,
      selectedKind: "reward",
      selectedGovernanceId: "123e4567-e89b-12d3-a456-426614174000",
      rewardType: "bribe",
      protocolSurface: "briber",
    }),
    "/governance?chainId=8453&kind=reward&selected=123e4567-e89b-12d3-a456-426614174000&rewardType=bribe&protocolSurface=briber",
  );
});

test("getGovernanceHref carries explicit cross-surface IDs without fabricating context", () => {
  assert.equal(
    getGovernanceHref({
      chainId: 8453,
      rewardEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      poolId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      epochId: "170",
    }),
    "/governance?chainId=8453&rewardEventId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&poolId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&epochId=170",
  );
});

test("getGovernanceHref supports explicit inbound Activity and Rewards identities", () => {
  assert.equal(
    getGovernanceHref({
      chainId: 8453,
      governanceEventId: "77777777-7777-4777-8777-777777777777",
    }),
    "/governance?chainId=8453&governanceEventId=77777777-7777-4777-8777-777777777777",
  );
  assert.equal(
    getGovernanceHref({
      chainId: 8453,
      rewardEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    "/governance?chainId=8453&rewardEventId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
});
