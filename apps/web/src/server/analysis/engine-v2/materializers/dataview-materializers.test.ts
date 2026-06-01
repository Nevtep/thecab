import assert from "node:assert/strict";
import test from "node:test";

import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";

import { materializeAllDataViewRows } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("materializeAllDataViewRows emits Activity, Deposits, Strategies, Pools, Rewards, and Governance rows", () => {
  const accounting = runChronologicalAccounting({
    events: [
      {
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
        metadataJson: { positionManagerAddress: "0x00000000000000000000000000000000000000aa", tokenId: "1", valueUsd: "10" },
      },
      {
        id: "strategy-event",
        chainId: 8453,
        walletAddress,
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xstrat",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { strategyExposureId: "strat-1", sharesRaw: "1", valueUsd: "20" },
      },
      {
        id: "reward-event",
        chainId: 8453,
        walletAddress,
        eventType: "governance_claimFees",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        txHash: "0xreward",
        sequenceIndex: 2,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missing_distributor_pool_link"],
        metadataJson: { rewardId: "reward-1", rewardType: "governance_fee", lockTokenId: "110971", amountUsd: "5" },
      },
    ],
    links: [
      { domainEventId: "deposit-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "strategy-event", entityType: "strategy_exposure", entityId: "strat-1" },
      { domainEventId: "strategy-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "reward-event", entityType: "governance_lock", entityId: "lock-1" },
    ],
  });

  const surfaces = new Set(materializeAllDataViewRows(accounting).map((row) => row.surface));
  assert.ok(surfaces.has("activity"));
  assert.ok(surfaces.has("deposits"));
  assert.ok(surfaces.has("strategies"));
  assert.ok(surfaces.has("pools"));
  assert.ok(surfaces.has("rewards"));
  assert.ok(surfaces.has("governance"));
});
