import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeResidualConsumptionAction,
} from "@/server/analysis/canonicalInference";
import type { WaterfallAllocation } from "@/server/analysis/sourceOfFundsWaterfall";

const POOL_X = "11111111-1111-1111-1111-111111111111";
const POOL_Y = "22222222-2222-2222-2222-222222222222";

function buildAllocation(
  consumingLedgerEventId: string,
  attributions: Array<{
    source: "candidate_pool_residual" | "matching_cash_in" | "liquidation_or_reward" | "other_pool_residual" | "unknown";
    amount: bigint;
    poolId?: string | null;
  }>,
): WaterfallAllocation {
  const totalRequested = attributions.reduce((sum, attribution) => sum + attribution.amount, 0n);
  return {
    consumingLedgerEventId,
    tokenAddress: "0x0000000000000000000000000000000000000a01",
    totalRequested,
    attributions: attributions.map((attribution, index) => ({
      source: attribution.source,
      amount: attribution.amount,
      confidence: attribution.source === "unknown" ? "low" : "high",
      residualLotId: attribution.poolId ? `residual-${index}` : null,
      sourceLotId: attribution.poolId ? null : `source-${index}`,
      sourceLedgerEventId: `ledger-${index}`,
      poolId: attribution.poolId ?? null,
    })),
    unallocatedAmount: attributions
      .filter((attribution) => attribution.source === "unknown")
      .reduce((sum, attribution) => sum + attribution.amount, 0n),
  };
}

test("summarizeResidualConsumptionAction marks same-pool swaps as rebalance_same_pool", () => {
  const result = summarizeResidualConsumptionAction({
    classification: "swap",
    candidatePoolId: POOL_X,
    legAllocations: [
      buildAllocation("swap-1", [
        { source: "candidate_pool_residual", amount: 400n, poolId: POOL_X },
        { source: "matching_cash_in", amount: 600n },
      ]),
    ],
  });

  assert.deepEqual(result, {
    actionType: "rebalance_same_pool",
    primaryPoolId: POOL_X,
    classificationBasis: "residual_flow",
    allocationBreakdown: [
      { source: "candidate_pool_residual", amount: 400n },
      { source: "matching_cash_in", amount: 600n },
    ],
    candidatePoolResidualConsumedRaw: 400n,
    candidatePoolResidualShare: 0.4,
    mixedFunding: true,
    excessAllocationBuckets: [{ source: "matching_cash_in", amount: 600n }],
    counterpartyPoolId: POOL_X,
    sourcePoolBreakdown: [{ poolId: POOL_X, amount: 400n }],
  });
});

test("summarizeResidualConsumptionAction marks unrelated swaps as liquidation_from_residual", () => {
  const result = summarizeResidualConsumptionAction({
    classification: "swap",
    candidatePoolId: POOL_X,
    legAllocations: [
      buildAllocation("swap-1", [
        { source: "other_pool_residual", amount: 500n, poolId: POOL_Y },
        { source: "matching_cash_in", amount: 500n },
      ]),
    ],
  });

  assert.deepEqual(result, {
    actionType: "liquidation_from_residual",
    primaryPoolId: POOL_Y,
    classificationBasis: "residual_flow",
    allocationBreakdown: [
      { source: "matching_cash_in", amount: 500n },
      { source: "other_pool_residual", amount: 500n },
    ],
    candidatePoolResidualConsumedRaw: 0n,
    candidatePoolResidualShare: 0,
    mixedFunding: false,
    excessAllocationBuckets: [
      { source: "matching_cash_in", amount: 500n },
      { source: "other_pool_residual", amount: 500n },
    ],
    counterpartyPoolId: POOL_X,
    sourcePoolBreakdown: [{ poolId: POOL_Y, amount: 500n }],
  });
});

test("summarizeResidualConsumptionAction marks external transfers as cash_out_from_residual", () => {
  const result = summarizeResidualConsumptionAction({
    classification: "cash_out",
    candidatePoolId: null,
    legAllocations: [
      buildAllocation("cashout-1", [
        { source: "other_pool_residual", amount: 300n, poolId: POOL_Y },
        { source: "unknown", amount: 200n },
      ]),
    ],
  });

  assert.deepEqual(result, {
    actionType: "cash_out_from_residual",
    primaryPoolId: POOL_Y,
    classificationBasis: "residual_flow",
    allocationBreakdown: [
      { source: "other_pool_residual", amount: 300n },
      { source: "unknown", amount: 200n },
    ],
    candidatePoolResidualConsumedRaw: 0n,
    candidatePoolResidualShare: 0,
    mixedFunding: false,
    excessAllocationBuckets: [
      { source: "other_pool_residual", amount: 300n },
      { source: "unknown", amount: 200n },
    ],
    counterpartyPoolId: null,
    sourcePoolBreakdown: [{ poolId: POOL_Y, amount: 300n }],
  });
});