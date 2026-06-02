import assert from "node:assert/strict";
import test from "node:test";

import { distributorPoolLinkFromGaugeCreated } from "./distributor-pool-links";
import { poolDefinitionSnapshot } from "./pool-enrichment.worker";

test("poolDefinitionSnapshot stores explicit pool definition evidence", () => {
  const row = poolDefinitionSnapshot({
    chainId: 8453,
    poolAddress: "0x0000000000000000000000000000000000000001",
    token0: "0x0000000000000000000000000000000000000002",
    token1: "0x0000000000000000000000000000000000000003",
    tickSpacing: 100,
    feeTier: "0.01%",
  });

  assert.equal(row.subjectType, "pool");
  assert.equal(row.stateJson?.tickSpacing, 100);
});

test("poolDefinitionSnapshot stores basic pool type when no tick spacing exists", () => {
  const row = poolDefinitionSnapshot({
    chainId: 8453,
    poolAddress: "0x0000000000000000000000000000000000000011",
    token0: "0x0000000000000000000000000000000000000002",
    token1: "0x0000000000000000000000000000000000000003",
    poolType: "volatile",
  });

  assert.equal(row.subjectType, "pool");
  assert.equal(row.stateJson?.tickSpacing, null);
  assert.equal(row.stateJson?.poolType, "volatile");
});

test("distributorPoolLinkFromGaugeCreated requires explicit GaugeCreated pool/distributor evidence", () => {
  const row = distributorPoolLinkFromGaugeCreated({
    chainId: 8453,
    txHash: "0xabc",
    logIndex: 1,
    params: {
      pool: "0x0000000000000000000000000000000000000001",
      bribeVotingReward: "0x0000000000000000000000000000000000000002",
      gauge: "0x0000000000000000000000000000000000000003",
    },
  });

  assert.equal(row?.poolAddress, "0x0000000000000000000000000000000000000001");
  assert.equal(row?.distributorAddress, "0x0000000000000000000000000000000000000002");
});
