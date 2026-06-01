import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2Regression } from "./engine-v2-regression";

test("runEngineV2Regression composes canonical, classification, enrichment, and read-model checks", () => {
  const result = runEngineV2Regression({
    fixtureDirectory: "../../docs/api-research/moralis",
    walletAddress: "0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954",
  });

  assert.equal(result.ok, true);
  assert.equal(result.canonicalHistory.chronological, true);
  assert.ok(result.classification.transactionCount > 0);
  assert.ok(result.readModels.surfaces.includes("activity"));
});
