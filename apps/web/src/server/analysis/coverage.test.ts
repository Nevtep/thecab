import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeCoverageReasons,
  mapInferredActionCoverageReasons,
  mapRewardResolutionReasonCodesToCoverageReasons,
  resolveCoverageLevel,
} from "@/server/analysis/coverage";

test("dedupeCoverageReasons drops duplicates and unknown codes", () => {
  assert.deepEqual(
    dedupeCoverageReasons([
      "providerThrottled",
      "providerThrottled",
      "missingPrices",
      "notReal",
      "",
    ]),
    ["providerThrottled", "missingPrices"],
  );
});

test("resolveCoverageLevel distinguishes partial, full, and unknown states", () => {
  assert.equal(resolveCoverageLevel({ failedSliceCount: 1, hasCompletedData: true }), "partial");
  assert.equal(resolveCoverageLevel({ reasonCodes: ["providerError"], hasCompletedData: true }), "partial");
  assert.equal(resolveCoverageLevel({ hasCompletedData: true }), "full");
  assert.equal(resolveCoverageLevel({ hasCompletedData: false }), "unknown");
});

test("mapRewardResolutionReasonCodesToCoverageReasons preserves deterministic reward gaps", () => {
  assert.deepEqual(
    mapRewardResolutionReasonCodesToCoverageReasons([
      "missingTokenId",
      "missingStrategyExposure",
      "manualStrategyConflict",
      "providerDecodedOnly",
      "missingTokenId",
    ]),
    [
      "rewardMissingTokenId",
      "rewardMissingStrategyExposure",
      "rewardManualStrategyConflict",
      "rewardProviderDecodedOnly",
    ],
  );
});

test("mapInferredActionCoverageReasons marks ambiguous residual funding", () => {
  assert.deepEqual(
    mapInferredActionCoverageReasons(["unknown_source_deposit", "rebalance_same_pool"]),
    ["residualAmbiguousSource"],
  );
});