import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSyntheticGaugeClaimCandidates,
  buildSyntheticGaugeClaimEventKey,
  resolvePoolRewardTargetPoolId,
} from "@/server/analysis/pool-read-models";

test("resolvePoolRewardTargetPoolId only uses deposit or strategy ownership", () => {
  assert.equal(resolvePoolRewardTargetPoolId({
    relatedId: "deposit-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), "pool-1");

  assert.equal(resolvePoolRewardTargetPoolId({
    relatedId: "strategy-1",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), "pool-2");

  assert.equal(resolvePoolRewardTargetPoolId({
    relatedId: "unresolved",
    depositToPoolId: new Map([["deposit-1", "pool-1"]]),
    strategyToPoolId: new Map([["strategy-1", "pool-2"]]),
  }), null);
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