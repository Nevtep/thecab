import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAerodromeRewardRecordTokenId,
  resolveAerodromeRewardCandidateTokenId,
} from "@/server/protocols/aerodrome/decodeDepositLifecycle";

test("extractAerodromeRewardRecordTokenId reads a single nested token id from decoded input", () => {
  const result = extractAerodromeRewardRecordTokenId({
    category: "token receive",
    decoded_call: {
      params: {
        tokenIds: [71093441],
      },
    },
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId keeps explicit token ids", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: "71093441",
    lifecycleTokenId: "71093441",
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId falls back to the same-tx lifecycle token id", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: null,
    lifecycleTokenId: "71093441",
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId stays unresolved when the tx has no provable token id", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: null,
    lifecycleTokenId: null,
  });

  assert.equal(result, null);
});