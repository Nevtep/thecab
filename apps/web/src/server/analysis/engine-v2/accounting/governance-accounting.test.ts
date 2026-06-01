import assert from "node:assert/strict";
import test from "node:test";

import { accountGovernance } from "./index";
import type { EngineV2DomainEventLike } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

function govEvent(overrides: Partial<EngineV2DomainEventLike>): EngineV2DomainEventLike {
  return {
    id: "gov-event",
    chainId: 8453,
    walletAddress,
    eventType: "governance_create_lock",
    eventFamily: "governance",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0xgov",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    metadataJson: {
      votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
      lockTokenId: "110971",
      epochId: "1",
    },
    ...overrides,
  };
}

test("accountGovernance separates direct locks from managed links and tracks epochs", () => {
  const result = accountGovernance({
    events: [
      govEvent({}),
      govEvent({ id: "managed", eventType: "governance_deposit_managed", sequenceIndex: 1, metadataJson: { votingEscrowAddress: "0x00000000000000000000000000000000000000aa", lockTokenId: "113464", managedTokenId: "10298", managerAddress: "0x00000000000000000000000000000000000000bb", epochId: "2" } }),
    ],
  });

  assert.equal(result.locks.length, 2);
  assert.equal(result.locks.find((lock) => lock.tokenId === "113464")?.managedTokenId, "10298");
  assert.equal(result.managedLinks[0]?.userTokenId, "113464");
  assert.equal(result.epochs.length, 2);
});
