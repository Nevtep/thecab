import assert from "node:assert/strict";
import test from "node:test";

import { accountManualDeposits } from "./index";
import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

function depositEvent(overrides: Partial<EngineV2DomainEventLike>): EngineV2DomainEventLike {
  return {
    id: "deposit-event",
    chainId: 8453,
    walletAddress,
    eventType: "manual_deposit_open",
    eventFamily: "deposit",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0xdep",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    metadataJson: {
      positionManagerAddress: "0x00000000000000000000000000000000000000aa",
      tokenId: "123",
      valueUsd: "100",
    },
    ...overrides,
  };
}

test("accountManualDeposits projects lifecycle only with explicit tokenId identity", () => {
  const links: EngineV2EntityLinkLike[] = [
    { domainEventId: "deposit-event", entityType: "pool", entityId: "pool-1" },
  ];
  const rows = accountManualDeposits({
    links,
    events: [
      depositEvent({ id: "deposit-event" }),
      depositEvent({ id: "collect-event", eventType: "manual_collect_fees", sequenceIndex: 1, metadataJson: { tokenId: "123", valueUsd: "7" } }),
      depositEvent({ id: "close-event", eventType: "manual_close", sequenceIndex: 2, metadataJson: { tokenId: "123", valueUsd: "80" } }),
      depositEvent({ id: "missing-token", metadataJson: { valueUsd: "999" } }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tokenId, "123");
  assert.equal(rows[0]?.status, "closed");
  assert.equal(rows[0]?.capitalInUsd, "100");
  assert.equal(rows[0]?.capitalOutUsd, "80");
  assert.equal(rows[0]?.rewardsUsd, "7");
});
