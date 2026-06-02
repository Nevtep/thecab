import assert from "node:assert/strict";
import test from "node:test";

import { accountPools } from "./index";

test("accountPools aggregates only explicit pool links and does not infer from token pair/time", () => {
  const rows = accountPools({
    events: [],
    links: [],
    deposits: [{ depositId: "dep", tokenId: "1", poolId: "pool-1", status: "open", openedAt: null, closedAt: null, openedValueUsd: "100", currentOrCloseValueUsd: "110", capitalInUsd: "100", capitalOutUsd: "0", rewardsUsd: "0", lifecycle: [], coverageStatus: "full", confidence: "high", reasonCodes: [] }],
    strategies: [{ strategyExposureId: "strat", strategyId: null, wrapperAddress: null, poolId: "pool-1", currentSharesRaw: "1", sharesReceivedRaw: "1", sharesRedeemedRaw: "0", depositedValueUsd: "50", withdrawnValueUsd: "0", rewardsUsd: "0", lifecycle: [], coverageStatus: "share_level", confidence: "high", reasonCodes: [] }],
    rewards: [{ rewardId: "reward", rewardType: "fee", tokenAddress: null, amountRaw: null, amountUsd: "5", ownerStatus: "governance", linkedEntityId: "lock", poolId: "pool-1", affectsTotals: true, poolContribution: "contributes", coverageStatus: "full", confidence: "high", reasonCodes: [], txHash: "0x", occurredAt: new Date() }],
    residualInventory: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.poolId, "pool-1");
  assert.equal(rows[0]?.manualDepositValueUsd, "110");
  assert.equal(rows[0]?.strategyValueUsd, "50");
  assert.equal(rows[0]?.rewardValueUsd, "0");
});
