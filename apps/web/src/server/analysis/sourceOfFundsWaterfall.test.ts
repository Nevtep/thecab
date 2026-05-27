import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  allocateSourceOfFunds,
  classifyInferredDepositAction,
  type WaterfallAllocation,
  type WaterfallResidualLot,
  type WaterfallSourceLot,
} from "./sourceOfFundsWaterfall";

const TOKEN_A = "0x0000000000000000000000000000000000000a01";
const TOKEN_B = "0x0000000000000000000000000000000000000b02";
const POOL_X = "11111111-1111-1111-1111-111111111111";
const POOL_Y = "22222222-2222-2222-2222-222222222222";

function date(iso: string): Date {
  return new Date(iso);
}

function residual(
  overrides: Partial<WaterfallResidualLot> & { amount: bigint; id: string },
): WaterfallResidualLot {
  return {
    poolId: null,
    tokenAddress: TOKEN_A,
    occurredAt: date("2025-01-01T00:00:00Z"),
    sourceLedgerEventId: `ledger-${overrides.id}`,
    sourceType: "manual_withdrawal",
    ...overrides,
  };
}

function source(
  overrides: Partial<WaterfallSourceLot> & { amount: bigint; id: string },
): WaterfallSourceLot {
  return {
    tokenAddress: TOKEN_A,
    occurredAt: date("2025-01-01T00:00:00Z"),
    sourceLedgerEventId: `ledger-${overrides.id}`,
    sourceType: "cash_in",
    ...overrides,
  };
}

test("waterfall drains candidate pool residuals first", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({ id: "r-other", poolId: POOL_Y, amount: 500n, occurredAt: date("2025-01-02T00:00:00Z") }),
    residual({ id: "r-candidate", poolId: POOL_X, amount: 200n, occurredAt: date("2025-01-03T00:00:00Z") }),
  ];
  const sourceLots: WaterfallSourceLot[] = [
    source({ id: "s-cash", amount: 1_000n, occurredAt: date("2025-01-02T12:00:00Z") }),
  ];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 150n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-01-04T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  assert.equal(allocation.attributions.length, 1);
  assert.equal(allocation.attributions[0]?.source, "candidate_pool_residual");
  assert.equal(allocation.attributions[0]?.residualLotId, "r-candidate");
  assert.equal(allocation.attributions[0]?.amount, 150n);
  assert.equal(allocation.unallocatedAmount, 0n);
  assert.equal(residualLots.find((l) => l.id === "r-candidate")?.amount, 50n);
  assert.equal(residualLots.find((l) => l.id === "r-other")?.amount, 500n);
  assert.equal(sourceLots[0]?.amount, 1_000n);
});

test("waterfall falls through to matching cash-in once candidate residual is exhausted", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({ id: "r-candidate", poolId: POOL_X, amount: 50n }),
  ];
  const sourceLots: WaterfallSourceLot[] = [
    source({ id: "s-cash", amount: 200n, sourceType: "cash_in" }),
  ];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 175n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-02-01T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  assert.equal(allocation.attributions.length, 2);
  assert.equal(allocation.attributions[0]?.source, "candidate_pool_residual");
  assert.equal(allocation.attributions[0]?.amount, 50n);
  assert.equal(allocation.attributions[1]?.source, "matching_cash_in");
  assert.equal(allocation.attributions[1]?.amount, 125n);
  assert.equal(allocation.unallocatedAmount, 0n);
});

test("waterfall prefers liquidation/reward inventory before other-pool residuals", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({ id: "r-liq", poolId: POOL_Y, amount: 100n, sourceType: "liquidation" }),
    residual({ id: "r-other", poolId: POOL_Y, amount: 100n, sourceType: "manual_withdrawal" }),
  ];
  const sourceLots: WaterfallSourceLot[] = [];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 150n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-03-01T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  assert.equal(allocation.attributions[0]?.source, "liquidation_or_reward");
  assert.equal(allocation.attributions[0]?.amount, 100n);
  assert.equal(allocation.attributions[1]?.source, "other_pool_residual");
  assert.equal(allocation.attributions[1]?.amount, 50n);
});

test("waterfall splits same-token across multiple pools pro rata when other-pool residuals are used", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({ id: "r-y", poolId: POOL_Y, amount: 300n }),
    residual({ id: "r-z", poolId: "33333333-3333-3333-3333-333333333333", amount: 100n }),
  ];
  const sourceLots: WaterfallSourceLot[] = [];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 200n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-04-01T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  const sumByLot = new Map<string, bigint>();
  for (const attribution of allocation.attributions) {
    if (attribution.residualLotId !== null) {
      sumByLot.set(attribution.residualLotId, (sumByLot.get(attribution.residualLotId) ?? 0n) + attribution.amount);
    }
  }

  assert.equal(allocation.unallocatedAmount, 0n);
  assert.equal(sumByLot.get("r-y"), 150n); // 300 / 400 * 200 = 150
  assert.equal(sumByLot.get("r-z"), 50n); // 100 / 400 * 200 = 50
});

test("waterfall emits an unknown attribution for the leftover when nothing covers the request", () => {
  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 1_000n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-05-01T00:00:00Z"),
    },
    residualLots: [],
    sourceLots: [],
  });

  assert.equal(allocation.attributions.length, 1);
  assert.equal(allocation.attributions[0]?.source, "unknown");
  assert.equal(allocation.attributions[0]?.confidence, "low");
  assert.equal(allocation.unallocatedAmount, 1_000n);
});

function buildAllocation(
  consumingLedgerEventId: string,
  amounts: Array<{ source: import("./sourceOfFundsWaterfall").WaterfallSourceKind; amount: bigint }>,
): WaterfallAllocation {
  const total = amounts.reduce((acc, a) => acc + a.amount, 0n);
  return {
    consumingLedgerEventId,
    tokenAddress: TOKEN_A,
    totalRequested: total,
    attributions: amounts.map((a) => ({
      source: a.source,
      amount: a.amount,
      confidence: a.source === "unknown" ? "low" : a.source === "candidate_pool_residual" ? "high" : "medium",
      residualLotId: null,
      sourceLotId: null,
      sourceLedgerEventId: null,
      poolId: null,
    })),
    unallocatedAmount: amounts.find((a) => a.source === "unknown")?.amount ?? 0n,
  };
}

test("classifyInferredDepositAction marks rebalance_same_pool when paired swap consumed candidate residual", () => {
  const result = classifyInferredDepositAction({
    targetPoolId: POOL_X,
    legAllocations: [
      buildAllocation("leg-1", [
        { source: "candidate_pool_residual", amount: 800n },
        { source: "matching_cash_in", amount: 200n },
      ]),
    ],
    pairedSwapConsumedCandidateResidual: true,
  });

  assert.equal(result.actionType, "rebalance_same_pool");
  assert.equal(result.confidence, "high");
});

test("classifyInferredDepositAction marks redeploy_same_pool when funded directly by same-pool residual", () => {
  const result = classifyInferredDepositAction({
    targetPoolId: POOL_X,
    legAllocations: [
      buildAllocation("leg-1", [{ source: "candidate_pool_residual", amount: 1_000n }]),
    ],
    pairedSwapConsumedCandidateResidual: false,
  });

  assert.equal(result.actionType, "redeploy_same_pool");
  assert.equal(result.confidence, "high");
});

test("classifyInferredDepositAction marks new_capital_deposit when cash-in dominates", () => {
  const result = classifyInferredDepositAction({
    targetPoolId: POOL_X,
    legAllocations: [
      buildAllocation("leg-1", [
        { source: "matching_cash_in", amount: 900n },
        { source: "unknown", amount: 100n },
      ]),
    ],
    pairedSwapConsumedCandidateResidual: false,
  });

  assert.equal(result.actionType, "new_capital_deposit");
});

test("classifyInferredDepositAction returns unknown_source_deposit when unknown dominates", () => {
  const result = classifyInferredDepositAction({
    targetPoolId: POOL_X,
    legAllocations: [
      buildAllocation("leg-1", [{ source: "unknown", amount: 1_000n }]),
    ],
    pairedSwapConsumedCandidateResidual: false,
  });

  assert.equal(result.actionType, "unknown_source_deposit");
  assert.equal(result.confidence, "low");
});

test("waterfall ignores residual/source lots that occur after the consumption time", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({
      id: "r-future",
      poolId: POOL_X,
      amount: 500n,
      occurredAt: date("2026-01-01T00:00:00Z"),
    }),
  ];
  const sourceLots: WaterfallSourceLot[] = [];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 100n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-06-01T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  assert.equal(allocation.attributions.length, 1);
  assert.equal(allocation.attributions[0]?.source, "unknown");
  assert.equal(allocation.unallocatedAmount, 100n);
});

test("waterfall only consumes inventory in the same token as the consumption", () => {
  const residualLots: WaterfallResidualLot[] = [
    residual({ id: "r-wrong-token", poolId: POOL_X, amount: 500n, tokenAddress: TOKEN_B }),
  ];
  const sourceLots: WaterfallSourceLot[] = [
    source({ id: "s-wrong-token", amount: 500n, tokenAddress: TOKEN_B }),
  ];

  const allocation = allocateSourceOfFunds({
    consumption: {
      consumingLedgerEventId: "consumer-1",
      tokenAddress: TOKEN_A,
      amount: 100n,
      candidatePoolId: POOL_X,
      occurredAt: date("2025-07-01T00:00:00Z"),
    },
    residualLots,
    sourceLots,
  });

  assert.equal(allocation.attributions[0]?.source, "unknown");
  assert.equal(residualLots[0]?.amount, 500n);
  assert.equal(sourceLots[0]?.amount, 500n);
});
