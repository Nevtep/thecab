import assert from "node:assert/strict";
import test from "node:test";

import { accountRewards } from "./index";
import type { EngineV2DepositProjection } from "./deposit-accounting";
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

test("accountRewards resolves closed manual deposit claims from explicit tokenId", () => {
  const deposits: EngineV2DepositProjection[] = [{
    depositId: "8453:0x00000000000000000000000000000000000000aa:71251309",
    tokenId: "71251309",
    poolId: "pool-1",
    status: "closed",
    openedAt: new Date("2026-01-01T00:00:00.000Z"),
    closedAt: new Date("2026-01-10T00:00:00.000Z"),
    openedValueUsd: "100",
    currentOrCloseValueUsd: "120",
    capitalInUsd: "100",
    capitalOutUsd: "120",
    rewardsUsd: "0",
    lifecycle: [],
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
  }];

  const rows = accountRewards({
    deposits,
    events: [
      rewardEvent({
        id: "deposit-claim",
        eventType: "manual_gauge_reward_claim",
        eventFamily: "deposit",
        txHash: "0xc479d7b01c3b0b2ab620c42a47ce4e5850dbde60d93a3a98a6d16b522271bd93",
        metadataJson: {
          rewardId: "deposit-claim-1",
          rewardType: "manual_reward",
          amountUsd: "454.40",
          tokenId: "71251309",
        },
      }),
    ],
  });

  assert.equal(rows[0]?.ownerStatus, "manual_deposit");
  assert.equal(rows[0]?.linkedEntityId, deposits[0]?.depositId);
  assert.equal(rows[0]?.rewardType, "reward_claim");
  assert.equal(rows[0]?.poolId, deposits[0]?.poolId);
  assert.equal(rows[0]?.poolContribution, "contributes");
  assert.deepEqual(rows[0]?.reasonCodes ?? [], []);
});

test("accountRewards infers reward_claim when manual deposit metadata still says unknown", () => {
  const deposits: EngineV2DepositProjection[] = [{
    depositId: "8453:0x00000000000000000000000000000000000000aa:71251309",
    tokenId: "71251309",
    poolId: "pool-1",
    status: "closed",
    openedAt: new Date("2026-01-01T00:00:00.000Z"),
    closedAt: new Date("2026-01-10T00:00:00.000Z"),
    openedValueUsd: "100",
    currentOrCloseValueUsd: "120",
    capitalInUsd: "100",
    capitalOutUsd: "120",
    rewardsUsd: "0",
    lifecycle: [],
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
  }];

  const rows = accountRewards({
    deposits,
    events: [
      rewardEvent({
        id: "deposit-claim-unknown",
        eventType: "manual_gauge_reward_claim",
        eventFamily: "deposit",
        txHash: "0xa33e299ea21434b3bc7ec8b23f2480e29fda573dbc254eee48422bdec7c398d0",
        metadataJson: {
          rewardId: "deposit-claim-unknown-1",
          rewardType: "unknown",
          amountUsd: "454.40",
          tokenId: "71251309",
        },
      }),
    ],
  });

  assert.equal(rows[0]?.ownerStatus, "manual_deposit");
  assert.equal(rows[0]?.rewardType, "reward_claim");
  assert.equal(rows[0]?.poolId, "pool-1");
});
