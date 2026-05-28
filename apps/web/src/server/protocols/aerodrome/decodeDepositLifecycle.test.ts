import assert from "node:assert/strict";
import test from "node:test";

import { resolveAerodromeRewardCandidateTokenId } from "@/server/protocols/aerodrome/decodeDepositLifecycle";

test("resolveAerodromeRewardCandidateTokenId keeps explicit lifecycle token ids", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    lifecycleTokenId: "71093441",
    poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    currentManualPositions: [{
      tokenId: "99999999",
      poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    }],
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId falls back to a unique current manual position in the same pool", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    lifecycleTokenId: null,
    poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    currentManualPositions: [{
      tokenId: "71093441",
      poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    }],
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId stays unresolved when a pool has multiple current manual positions", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    lifecycleTokenId: null,
    poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    currentManualPositions: [
      {
        tokenId: "71093441",
        poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
      },
      {
        tokenId: "71093442",
        poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
      },
    ],
  });

  assert.equal(result, null);
});