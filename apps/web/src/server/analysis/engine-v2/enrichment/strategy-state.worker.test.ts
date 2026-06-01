import assert from "node:assert/strict";
import test from "node:test";

import { strategyStateSnapshot } from "./strategy-state.worker";

test("strategyStateSnapshot cannot create historical lifecycle ownership", () => {
  const row = strategyStateSnapshot({
    chainId: 8453,
    wrapperAddress: "0x0000000000000000000000000000000000000001",
    strategyExposureId: "strategy-1",
    shareTokenAddress: "0x0000000000000000000000000000000000000002",
    currentSharesRaw: "100",
  });

  assert.equal(row.subjectType, "strategy");
  assert.equal(row.evidenceJson?.currentStateOnly, true);
  assert.equal(row.evidenceJson?.cannotCreateHistoricalOwnership, true);
});
