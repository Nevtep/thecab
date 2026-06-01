import assert from "node:assert/strict";
import test from "node:test";

import { accountRewards } from "./index";
import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

function rewardEvent(overrides: Partial<EngineV2DomainEventLike>): EngineV2DomainEventLike {
  return {
    id: "reward-event",
    chainId: 8453,
    walletAddress,
    eventType: "governance_claimBribes",
    eventFamily: "governance",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0xreward",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    metadataJson: { rewardId: "reward-1", rewardType: "governance_bribe", amountUsd: "12" },
    ...overrides,
  };
}

test("accountRewards counts each reward once and preserves unresolved/excluded contribution states", () => {
  const links: EngineV2EntityLinkLike[] = [
    { domainEventId: "reward-event", entityType: "governance_lock", entityId: "lock-1" },
    { domainEventId: "reward-event", entityType: "pool", entityId: "pool-1" },
  ];
  const rows = accountRewards({
    links,
    events: [
      rewardEvent({ id: "reward-event" }),
      rewardEvent({ id: "duplicate-event" }),
      rewardEvent({ id: "rebase", eventType: "governance_rebase_claim", metadataJson: { rewardId: "rebase-1", rewardType: "rebase", amountUsd: "3" } }),
      rewardEvent({ id: "excluded", coverageStatus: "excluded", metadataJson: { rewardId: "excluded-1", rewardType: "airdrop", amountUsd: "99" } }),
    ],
  });

  assert.equal(rows.length, 3);
  assert.equal(rows.find((row) => row.rewardId === "reward-1")?.poolContribution, "contributes");
  assert.equal(rows.find((row) => row.rewardId === "rebase-1")?.affectsTotals, false);
  assert.equal(rows.find((row) => row.rewardId === "excluded-1")?.poolContribution, "excluded");
});
