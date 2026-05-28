import assert from "node:assert/strict";
import test from "node:test";

import {
  mapDepositDetailRows,
  mapDepositSummaryRow,
  type DepositDetailRowRecord,
} from "@/server/deposits/deposits.repository";

function createSummaryRow(overrides: Partial<DepositDetailRowRecord> = {}): DepositDetailRowRecord {
  return {
    depositId: "deposit-1",
    poolId: "pool-1",
    poolLabel: "WETH / cbBTC 100",
    positionLabel: "WETH / cbBTC · CL · 100 #71093441",
    poolKind: "cl",
    feeTierBps: 100,
    tokenId: "71093441",
    token0Address: "0x4200000000000000000000000000000000000006",
    token0Symbol: "WETH",
    token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    token1Symbol: "cbBTC",
    status: "open_active",
    openedAt: new Date("2026-05-20T22:45:21.000Z"),
    closedAt: null,
    openedByTransferIn: false,
    openedValueUsd: "1000.5",
    currentValueUsd: "1250.25",
    capitalEnteredUsd: "1000.5",
    capitalWithdrawnUsd: "0",
    totalRewardsUsd: "25.5",
    realizedPnlUsd: "50.25",
    unrealizedPnlUsd: "174.0",
    totalReturnUsd: "249.75",
    totalReturnPct: "0.249625",
    estimatedAnnualizedReturnPct: "0.12",
    tickLower: -266400,
    tickUpper: -265900,
    isInRange: true,
    rangeLowerPrice: "0.0269757447",
    rangeUpperPrice: "0.0283587498",
    coverageStatus: "full",
    confidence: "high",
    coverageReasonCodes: ["transferInOrigin"],
    coveredStartDayUtc: "2026-05-20",
    coveredEndDayUtc: "2026-05-28",
    mellowStrategyCrossLinkId: null,
    ...overrides,
  };
}

test("mapDepositSummaryRow normalizes persisted summary values", () => {
  const mapped = mapDepositSummaryRow(createSummaryRow({
    poolKind: "mystery",
    status: "bogus",
    coverageStatus: "weird",
    confidence: "n/a",
    totalReturnPct: "",
    estimatedAnnualizedReturnPct: "",
    rangeLowerPrice: "bad",
    coverageReasonCodes: null,
  }));

  assert.equal(mapped.poolKind, "unknown");
  assert.equal(mapped.status, "open_active");
  assert.equal(mapped.coverageStatus, "unknown");
  assert.equal(mapped.confidence, "unknown");
  assert.equal(mapped.totalReturnPct, null);
  assert.equal(mapped.estimatedAnnualizedReturnPct, null);
  assert.equal(mapped.rangeLowerPrice, null);
  assert.deepEqual(mapped.coverageReasonCodes, []);
  assert.equal(mapped.currentValueUsd, 1250.25);
});

test("mapDepositDetailRows combines decomposition fallback and lifecycle normalization", () => {
  const mapped = mapDepositDetailRows({
    row: createSummaryRow({
      status: "closed",
      closedAt: new Date("2026-05-28T00:00:00.000Z"),
      mellowStrategyCrossLinkId: "strategy-1",
    }),
    decompositionRow: {
      totalReturnUsd: "300",
      rewardsUsd: "20",
      feesUsd: "10",
      assetPriceEffectUsd: "40",
      rebalanceEffectUsd: "50",
      realizedPnlUsd: "80",
      unrealizedPnlUsd: "90",
      unattributedUsd: "10",
      unattributedReasonCodes: ["priceUnavailable"],
      componentPercentages: { rewards: 0.1 },
    },
    lifecycleRows: [{
      id: "event-1",
      sequenceIndex: 1,
      eventType: "unexpected_event",
      occurredAt: null,
      txHash: "0x123",
      logIndex: 5,
      blockNumber: 123,
      usdValue: "12.5",
      signedTokenDeltas: [{
        tokenAddress: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        direction: "weird",
        amountRaw: "1000000000000000000",
        amountFormatted: "1",
        usdValue: "12.5",
        priceSource: "pricePointFallback",
      }],
      priceSource: "event",
      confidence: "degraded",
      inferredActionId: null,
      coverageReasonCodes: null,
      metadataJson: { kind: "test" },
    }],
  });

  assert.equal(mapped.status, "closed");
  assert.equal(mapped.decomposition.totalReturnUsd, 300);
  assert.deepEqual(mapped.decomposition.unattributedReasonCodes, ["priceUnavailable"]);
  assert.equal(mapped.lifecycle[0]?.eventType, "claim_reward");
  assert.equal(mapped.lifecycle[0]?.occurredAt, new Date(0).toISOString());
  assert.equal(mapped.lifecycle[0]?.signedTokenDeltas[0]?.direction, "in");
  assert.equal(mapped.lifecycle[0]?.signedTokenDeltas[0]?.usdValue, 12.5);
  assert.equal(mapped.mellowStrategyCrossLinkId, "strategy-1");
});