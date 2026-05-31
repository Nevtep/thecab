import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateResolvedPoolRewardTotals,
  buildGroupedLifecycleEvent,
  buildSyntheticGaugeClaimCandidates,
  buildSyntheticGaugeClaimEventKey,
  buildSyntheticGaugeClaimRewards,
  collectCanonicalLifecycleRows,
  mapInferredActionToPoolTimelineEventType,
  resolvePoolRewardTargetPoolId,
} from "@/server/analysis/pool-read-models";

test("mapInferredActionToPoolTimelineEventType does not infer rebalance from swap-shaped lifecycle rows", () => {
  assert.equal(mapInferredActionToPoolTimelineEventType("rebalance_same_pool"), "rebalance");
  assert.equal(mapInferredActionToPoolTimelineEventType("redeploy_same_pool"), "redeploy");
  assert.equal(mapInferredActionToPoolTimelineEventType(null), "deposit");
});

test("collectCanonicalLifecycleRows uses exact inferred-action ledger ids instead of time windows", () => {
  const rows = collectCanonicalLifecycleRows({
    lifecycleRows: [
      {
        id: "deposit-ledger",
        txHash: "0xdeposit",
        classification: "manual_deposit",
        occurredAt: new Date("2026-05-01T00:00:00.000Z"),
        confidence: "high",
        metadataJson: {},
      },
      {
        id: "withdraw-ledger",
        txHash: "0xwithdraw",
        classification: "manual_withdrawal",
        occurredAt: new Date("2026-04-20T00:00:00.000Z"),
        confidence: "high",
        metadataJson: {},
      },
      {
        id: "unrelated-ledger",
        txHash: "0xunrelated",
        classification: "swap",
        occurredAt: new Date("2026-05-01T00:05:00.000Z"),
        confidence: "high",
        metadataJson: {},
      },
    ],
    inferredAction: {
      classificationBasis: "residual_flow",
      consumingLedgerEventIdsJson: ["withdraw-ledger"],
      sourceLedgerEventId: "deposit-ledger",
    },
  });

  assert.deepEqual(rows.map((row) => row.id), ["withdraw-ledger", "deposit-ledger"]);
});

test("buildGroupedLifecycleEvent defaults to a degraded deposit row when no canonical inferred action exists", () => {
  const event = buildGroupedLifecycleEvent({
    deposit: {
      depositId: "deposit-1",
      poolId: "pool-1",
      occurredAt: new Date("2026-05-01T00:00:00.000Z"),
      txHash: "0xdeposit",
      sourceLedgerEventId: "deposit-ledger",
      coverageStatus: "partial",
      attributedValueUsd: 123,
      relatedDepositId: "deposit-1",
      tokenId: "123",
      status: "open",
      metadataJson: {},
    },
    lifecycleRows: [
      {
        id: "swap-ledger",
        txHash: "0xswap",
        classification: "swap",
        occurredAt: new Date("2026-05-01T00:01:00.000Z"),
        confidence: "high",
        metadataJson: {},
      },
    ],
    inferredAction: null,
  });

  assert.equal(event.eventType, "deposit");
  assert.equal(event.metadataJson.inferredActionType, null);
  assert.deepEqual(event.metadataJson.groupedClassifications, ["swap"]);
});

test("resolvePoolRewardTargetPoolId prefers explicit resolved pool ownership and otherwise uses deposit or strategy ownership", () => {
  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: "pool-explicit",
    relatedId: "strategy-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), "pool-explicit");

  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: null,
    relatedId: "deposit-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), "pool-1");

  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: null,
    relatedId: "strategy-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), "pool-2");

  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: null,
    relatedId: null,
    strategyExposureId: "exposure-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
    strategyExposureToPoolId: new Map([["exposure-1", "pool-2"]]),
  }), "pool-2");

  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: null,
    relatedId: "unresolved",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), null);

  assert.equal(resolvePoolRewardTargetPoolId({
    resolvedPoolId: null,
    relatedId: "deposit-1",
    isGovernanceReward: true,
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), null);
});

test("aggregateResolvedPoolRewardTotals adds resolved deposit and strategy exposure rewards without unresolved rows", () => {
  const totals = aggregateResolvedPoolRewardTotals({
    rewards: [
      {
        resolvedPoolId: null,
        relatedId: "deposit-1",
        resolutionStatus: "resolved",
        rewardType: "reward_claim",
        amountUsd: 20,
      },
      {
        resolvedPoolId: null,
        relatedId: null,
        strategyExposureId: "exposure-1",
        resolutionStatus: "resolved",
        rewardType: "reward_claim",
        amountUsd: 15,
      },
      {
        resolvedPoolId: null,
        relatedId: null,
        strategyExposureId: "exposure-1",
        resolutionStatus: "unresolved",
        rewardType: "reward_claim",
        amountUsd: 99,
      },
      {
        resolvedPoolId: "pool-1",
        relatedId: null,
        resolutionStatus: "resolved",
        rewardType: "fee_claim",
        amountUsd: 3,
      },
    ],
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map(),
    strategyExposureToPoolId: new Map([["exposure-1", "pool-1"]]),
  });

  assert.equal(totals.get("pool-1")?.rewardsUsd, 35);
  assert.equal(totals.get("pool-1")?.feesUsd, 3);
});

test("aggregateResolvedPoolRewardTotals only counts governance rewards with explicit pool association", () => {
  const totals = aggregateResolvedPoolRewardTotals({
    rewards: [
      {
        resolvedPoolId: null,
        relatedId: "deposit-1",
        resolutionStatus: "resolved",
        rewardType: "governance_bribe_claim",
        resolutionBasis: "governance_reward",
        amountUsd: 50,
        metadataJson: { sourceSurface: "governance_bribe_claim" },
      },
      {
        resolvedPoolId: "pool-1",
        relatedId: null,
        resolutionStatus: "resolved",
        rewardType: "governance_bribe_claim",
        resolutionBasis: "governance_reward",
        amountUsd: 25,
        metadataJson: { sourceSurface: "governance_bribe_claim" },
      },
    ],
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map(),
    strategyExposureToPoolId: new Map(),
  });

  assert.equal(totals.get("pool-1")?.rewardsUsd, 25);
});

test("buildSyntheticGaugeClaimCandidates keeps unmatched gauge claims for known pools", () => {
  const candidates = buildSyntheticGaugeClaimCandidates({
    lifecycleRows: [
      {
        id: "ledger-1",
        txHash: "0xabc",
        classification: "claim",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x1111111111111111111111111111111111111111",
          methodLabel: "getReward",
        },
      },
    ],
    rewardTxHashSet: new Set<string>(),
    protocolContractPoolIdByAddress: new Map([
      ["0x1111111111111111111111111111111111111111", "pool-1"],
    ]),
  });

  assert.deepEqual(candidates, [
    {
      ledgerEventId: "ledger-1",
      txHash: "0xabc",
      occurredAt: new Date("2026-05-28T00:00:00.000Z"),
      poolId: "pool-1",
      gaugeAddress: "0x1111111111111111111111111111111111111111",
      methodLabel: "getreward",
      metadataJson: {
        toAddress: "0x1111111111111111111111111111111111111111",
        methodLabel: "getReward",
      },
    },
  ]);
});

test("buildSyntheticGaugeClaimCandidates keeps unmatched gauge unstake rewards for known pools", () => {
  const candidates = buildSyntheticGaugeClaimCandidates({
    lifecycleRows: [
      {
        id: "ledger-unstake",
        txHash: "0xunstake",
        classification: "unstake",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x1111111111111111111111111111111111111111",
          methodLabel: "withdraw",
        },
      },
    ],
    rewardTxHashSet: new Set<string>(),
    protocolContractPoolIdByAddress: new Map([
      ["0x1111111111111111111111111111111111111111", "pool-1"],
    ]),
  });

  assert.deepEqual(candidates, [
    {
      ledgerEventId: "ledger-unstake",
      txHash: "0xunstake",
      occurredAt: new Date("2026-05-28T00:00:00.000Z"),
      poolId: "pool-1",
      gaugeAddress: "0x1111111111111111111111111111111111111111",
      methodLabel: "withdraw",
      metadataJson: {
        toAddress: "0x1111111111111111111111111111111111111111",
        methodLabel: "withdraw",
      },
    },
  ]);
});

test("buildSyntheticGaugeClaimCandidates skips claims already covered by reward events or unknown targets", () => {
  const candidates = buildSyntheticGaugeClaimCandidates({
    lifecycleRows: [
      {
        id: "ledger-1",
        txHash: "0xcovered",
        classification: "claim",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x1111111111111111111111111111111111111111",
          methodLabel: "getReward",
        },
      },
      {
        id: "ledger-2",
        txHash: "0xunknown",
        classification: "claim",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x2222222222222222222222222222222222222222",
          methodLabel: "collect",
        },
      },
      {
        id: "ledger-3",
        txHash: "0xother",
        classification: "swap",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x1111111111111111111111111111111111111111",
          methodLabel: "getReward",
        },
      },
    ],
    rewardTxHashSet: new Set(["0xcovered"]),
    protocolContractPoolIdByAddress: new Map([
      ["0x1111111111111111111111111111111111111111", "pool-1"],
    ]),
  });

  assert.deepEqual(candidates, []);
});

test("buildSyntheticGaugeClaimCandidates skips claim targets that are not mapped as gauges", () => {
  const candidates = buildSyntheticGaugeClaimCandidates({
    lifecycleRows: [
      {
        id: "ledger-1",
        txHash: "0xgov",
        classification: "claim",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {
          toAddress: "0x3333333333333333333333333333333333333333",
          methodLabel: "getReward",
          summary: "Aerodrome voting escrow claim",
        },
      },
    ],
    rewardTxHashSet: new Set<string>(),
    protocolContractPoolIdByAddress: new Map(),
  });

  assert.deepEqual(candidates, []);
});

test("buildSyntheticGaugeClaimEventKey stays within pool timeline event key limits", () => {
  const eventKey = buildSyntheticGaugeClaimEventKey({
    txHash: "0x01c4d754abe2037b25b7d880a1f3a4000983b1064f83d86081c52fc9679a4a01",
    ledgerEventId: "d5473da2-5bd8-47de-903b-c07d7338f7d2",
  });

  assert.equal(eventKey, "reward:0x01c4d754abe2037b25b7d880a1f3a4000983b1064f83d86081c52fc9679a4a01:d5473da2-5bd8-47de-903b-c07d7338f7d2");
  assert.ok(eventKey.length <= 128);
});

test("buildSyntheticGaugeClaimRewards values unmatched gauge claims for diagnostics", () => {
  const rewards = buildSyntheticGaugeClaimRewards({
    chainId: 8453,
    candidates: [
      {
        ledgerEventId: "ledger-1",
        txHash: "0xreward",
        occurredAt: new Date("2026-05-28T00:00:00.000Z"),
        poolId: "pool-1",
        gaugeAddress: "0x1111111111111111111111111111111111111111",
        methodLabel: "getreward",
        metadataJson: {
          toAddress: "0x1111111111111111111111111111111111111111",
          methodLabel: "getReward",
        },
      },
    ],
    movementsByLedgerEventId: new Map([
      ["ledger-1", [{
        ledgerEventId: "ledger-1",
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        amountRaw: "1000000000000000000",
        directionIn: true,
        amountUsd: null,
        metadataJson: {
          symbol: "AERO",
        },
      }]],
    ]),
    latestPriceByToken: new Map([
      ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", 2],
    ]),
    earliestPriceDayByToken: new Map([
      ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", "2026-05-28"],
    ]),
    priceByTokenAndDay: new Map([
      ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", new Map([["2026-05-28", 2]])],
    ]),
  });

  assert.deepEqual(rewards, [{
    eventKey: "reward:0xreward:ledger-1",
    poolId: "pool-1",
    txHash: "0xreward",
    occurredAt: new Date("2026-05-28T00:00:00.000Z"),
    amountUsd: 2,
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    amountRaw: "1000000000000000000",
    sourceLedgerEventId: "ledger-1",
    gaugeAddress: "0x1111111111111111111111111111111111111111",
    methodLabel: "getreward",
    metadataJson: {
      toAddress: "0x1111111111111111111111111111111111111111",
      methodLabel: "getReward",
    },
  }]);
});
