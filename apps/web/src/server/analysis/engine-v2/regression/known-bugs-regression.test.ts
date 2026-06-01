import assert from "node:assert/strict";
import test from "node:test";

import { runKnownBugsRegression } from "./known-bugs-regression";

test("known bug regression covers lock grant backfill, managed links, and unresolved claim items", () => {
  const result = runKnownBugsRegression();

  assert.equal(result.lockOrigin, "nft_transfer_history");
  assert.equal(result.managedLinkCount, 1);
  assert.equal(result.unresolvedClaimItemCount, 1);
});
