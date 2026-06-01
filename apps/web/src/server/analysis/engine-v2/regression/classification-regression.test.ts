import assert from "node:assert/strict";
import test from "node:test";

import { runClassificationRegression } from "./classification-regression";

test("runClassificationRegression uses the fixture ABI registry and matches validated category parity", () => {
  const result = runClassificationRegression({
    fixtureDirectory: "../../docs/api-research/moralis",
    walletAddress: "0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954",
  });

  assert.equal(result.transactionCount, 534);
  assert.ok(result.registrySize > 0);
  assert.equal(result.unclassifiedCount, 0);
  assert.equal(result.unmappedCount, 0);
  assert.deepEqual(result.categoryCounts, {
    governance: 43,
    manualPosition: 87,
    strategy: 56,
  });
  assert.equal(result.byClassification.manual_gauge_reward_claim, 28);
});