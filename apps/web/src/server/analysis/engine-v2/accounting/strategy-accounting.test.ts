import assert from "node:assert/strict";
import test from "node:test";

import { accountStrategies } from "./index";
import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

function strategyEvent(overrides: Partial<EngineV2DomainEventLike>): EngineV2DomainEventLike {
  return {
    id: "strategy-event",
    chainId: 8453,
    walletAddress,
    eventType: "strategy_deposit",
    eventFamily: "strategy",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0xstrat",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    metadataJson: { sharesRaw: "10", valueUsd: "100" },
    ...overrides,
  };
}

test("accountStrategies tracks share-level lifecycle and rewards without manual deposit ownership", () => {
  const links: EngineV2EntityLinkLike[] = [
    { domainEventId: "strategy-event", entityType: "strategy_exposure", entityId: "exposure-1" },
    { domainEventId: "strategy-event", entityType: "pool", entityId: "pool-1" },
  ];
  const rows = accountStrategies({
    links,
    events: [
      strategyEvent({ id: "strategy-event" }),
      strategyEvent({ id: "reward-event", eventType: "strategy_reward_claim", sequenceIndex: 1, metadataJson: { strategyExposureId: "exposure-1", valueUsd: "11" } }),
      strategyEvent({ id: "withdraw-event", eventType: "strategy_withdraw", sequenceIndex: 2, metadataJson: { strategyExposureId: "exposure-1", sharesRaw: "4", valueUsd: "40" } }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.strategyExposureId, "exposure-1");
  assert.equal(rows[0]?.poolId, "pool-1");
  assert.equal(rows[0]?.currentSharesRaw, "6");
  assert.equal(rows[0]?.rewardsUsd, "11");
  assert.equal(rows[0]?.coverageStatus, "share_level");
});
