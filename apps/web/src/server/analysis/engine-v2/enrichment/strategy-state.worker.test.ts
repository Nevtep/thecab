import assert from "node:assert/strict";
import test from "node:test";

import { strategyStateSnapshot } from "./strategy-state.worker";

test("strategyStateSnapshot cannot create historical lifecycle ownership", () => {
  const row = strategyStateSnapshot({
    chainId: 8453,
    wrapperAddress: "0x0000000000000000000000000000000000000001",
    strategyExposureId: "strategy-1",
    shareTokenAddress: "0x0000000000000000000000000000000000000002",
    token0Address: "0x0000000000000000000000000000000000000003",
    token1Address: "0x0000000000000000000000000000000000000004",
    currentSharesRaw: "100",
    token0AmountRaw: "25",
    token1AmountRaw: "75",
    currentEstimatedValueUsd: "42.5",
  });

  assert.equal(row.subjectType, "strategy");
  assert.equal(row.stateJson?.token0Address, "0x0000000000000000000000000000000000000003");
  assert.equal(row.stateJson?.token1Address, "0x0000000000000000000000000000000000000004");
  assert.equal(row.stateJson?.currentEstimatedValueUsd, "42.5");
  assert.equal(row.evidenceJson?.currentStateOnly, true);
  assert.equal(row.evidenceJson?.cannotCreateHistoricalOwnership, true);
});
