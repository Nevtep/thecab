import assert from "node:assert/strict";
import test from "node:test";

import { runKnownBugsRegression } from "./known-bugs-regression";

test("known bug regression covers BUG-EV2-002 through BUG-EV2-006 deterministically", () => {
  const result = runKnownBugsRegression();

  assert.equal(result.lockOrigin, "nft_transfer_history");
  assert.equal(result.lockCount, 2);
  assert.equal(result.managedLinkCount, 1);
  assert.equal(result.depositManagedCoverage, "full");
  assert.equal(result.claimItemCount, 2);
  assert.equal(result.nestedClaimFeesEventType, "governance_fee_claim");
  assert.equal(result.rebaseCoverage, "full");
  assert.equal(result.unresolvedClaimItemCount, 2);
});
