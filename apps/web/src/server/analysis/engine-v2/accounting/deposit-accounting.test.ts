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

test("accountManualDeposits keeps gauge reward claims on the known deposit identity for the same tokenId", () => {
  const rows = accountManualDeposits({
    events: [
      depositEvent({
        id: "open-event",
        eventType: "manual_position_created",
        metadataJson: {
          positionManagerAddress: "0x00000000000000000000000000000000000000aa",
          tokenId: "123",
        },
      }),
      depositEvent({
        id: "claim-event",
        eventType: "manual_gauge_reward_claim",
        sequenceIndex: 1,
        metadataJson: {
          positionManagerAddress: "0x00000000000000000000000000000000000000bb",
          tokenId: "123",
        },
      }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.depositId, "8453:0x00000000000000000000000000000000000000aa:123");
  assert.equal(rows[0]?.tokenId, "123");
  assert.deepEqual(rows[0]?.lifecycle.map((event) => event.eventType), [
    "manual_position_created",
    "manual_gauge_reward_claim",
  ]);
});

test("accountManualDeposits groups basic amm lifecycle by pool when tokenId is absent", () => {
  const poolAddress = "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const poolId = `8453:${poolAddress}`;
  const depositId = `8453:basic_amm:${poolAddress}`;
  const rows = accountManualDeposits({
    events: [
      depositEvent({
        id: "basic-open",
        eventType: "manual_pool_deposit_router",
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolAddress,
          poolId,
          poolType: "volatile",
          valueUsd: "10",
        },
      }),
      depositEvent({
        id: "basic-stake",
        eventType: "manual_gauge_stake",
        sequenceIndex: 1,
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolAddress,
          poolId,
        },
      }),
      depositEvent({
        id: "basic-unstake",
        eventType: "manual_gauge_unstake",
        sequenceIndex: 2,
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolAddress,
          poolId,
        },
      }),
      depositEvent({
        id: "basic-close",
        eventType: "manual_pool_withdraw_router",
        sequenceIndex: 3,
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolAddress,
          poolId,
          valueUsd: "8",
        },
      }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.depositId, depositId);
  assert.equal(rows[0]?.tokenId, null);
  assert.equal(rows[0]?.poolId, poolId);
  assert.equal(rows[0]?.status, "closed");
  assert.deepEqual(rows[0]?.lifecycle.map((event) => event.eventType), [
    "manual_pool_deposit_router",
    "manual_gauge_stake",
    "manual_gauge_unstake",
    "manual_pool_withdraw_router",
  ]);
});

test("accountManualDeposits creates a new basic amm episode when the same pool reopens later", () => {
  const poolAddress = "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const poolId = `8453:${poolAddress}`;
  const depositBaseId = `8453:basic_amm:${poolAddress}`;
  const rows = accountManualDeposits({
    events: [
      depositEvent({
        id: "episode-1-open",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        eventType: "manual_pool_deposit_router",
        metadataJson: { depositKind: "basic_amm", depositId: depositBaseId, poolAddress, poolId, valueUsd: "10" },
      }),
      depositEvent({
        id: "episode-1-close",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        sequenceIndex: 1,
        eventType: "manual_pool_withdraw_router",
        metadataJson: { depositKind: "basic_amm", depositId: depositBaseId, poolAddress, poolId, valueUsd: "8" },
      }),
      depositEvent({
        id: "episode-2-open",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        sequenceIndex: 2,
        eventType: "manual_pool_deposit_router",
        metadataJson: { depositKind: "basic_amm", depositId: depositBaseId, poolAddress, poolId, valueUsd: "12" },
      }),
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.depositId, depositBaseId);
  assert.equal(rows[0]?.status, "closed");
  assert.equal(rows[1]?.depositId, `${depositBaseId}:2`);
  assert.equal(rows[1]?.status, "open");
});
