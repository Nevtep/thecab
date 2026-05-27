/**
 * Canonical source-of-funds waterfall allocator.
 *
 * This module is pure (no DB, no IO). It takes a token consumption (e.g. the
 * outflow leg of a manual_deposit or the input leg of a swap) plus the wallet's
 * available residual lots and matching source lots, and drains them in the
 * order mandated by the engine plan:
 *
 *   1. Residual lots of the same token whose `poolId` matches the candidate
 *      pool of the consumption (the pool the resulting deposit/swap is
 *      heading to). These are the strongest "rebalance same pool" signal.
 *   2. Source lots of type `cash_in` for the same token. Fresh capital that
 *      arrived from outside the wallet's protocol activity.
 *   3. Source/residual lots derived from liquidation or reward conversion
 *      (sourceType in {"liquidation", "claim", "reward_conversion"}).
 *   4. Residual lots of the same token attached to other pools, drained
 *      proportionally to their outstanding amount (pro rata).
 *   5. Anything else as "unknown" inventory with low confidence.
 *
 * Downstream callers turn these attribution slices into inferred actions
 * (`rebalance_same_pool`, `redeploy_same_pool`, `liquidation_from_residual`,
 * `new_capital_deposit`).
 */

export type WaterfallSourceKind =
  | "candidate_pool_residual"
  | "matching_cash_in"
  | "liquidation_or_reward"
  | "other_pool_residual"
  | "unknown";

export type WaterfallConfidence = "high" | "medium" | "low";

export type WaterfallLotSourceType =
  | "cash_in"
  | "swap"
  | "claim"
  | "reward_conversion"
  | "liquidation"
  | "manual_withdrawal"
  | "strategy_withdraw"
  | "unstake"
  | "other";

export type WaterfallResidualLot = {
  id: string;
  poolId: string | null;
  tokenAddress: string;
  amount: bigint;
  occurredAt: Date;
  sourceLedgerEventId: string;
  sourceType: WaterfallLotSourceType;
};

export type WaterfallSourceLot = {
  id: string;
  tokenAddress: string;
  amount: bigint;
  occurredAt: Date;
  sourceLedgerEventId: string;
  sourceType: WaterfallLotSourceType;
};

export type WaterfallConsumption = {
  consumingLedgerEventId: string;
  tokenAddress: string;
  amount: bigint;
  candidatePoolId: string | null;
  occurredAt: Date;
};

export type WaterfallAttribution = {
  source: WaterfallSourceKind;
  amount: bigint;
  confidence: WaterfallConfidence;
  residualLotId: string | null;
  sourceLotId: string | null;
  sourceLedgerEventId: string | null;
  poolId: string | null;
};

export type WaterfallAllocation = {
  consumingLedgerEventId: string;
  tokenAddress: string;
  totalRequested: bigint;
  attributions: WaterfallAttribution[];
  unallocatedAmount: bigint;
};

export type WaterfallInputs = {
  consumption: WaterfallConsumption;
  residualLots: WaterfallResidualLot[];
  sourceLots: WaterfallSourceLot[];
};

const LIQUIDATION_OR_REWARD_TYPES = new Set<WaterfallLotSourceType>([
  "claim",
  "liquidation",
  "reward_conversion",
]);

function normalizeToken(value: string): string {
  return value.toLowerCase();
}

function takeFromLot(
  remaining: bigint,
  lotAmount: bigint,
): { taken: bigint; lotRemainder: bigint } {
  if (remaining <= 0n || lotAmount <= 0n) {
    return { taken: 0n, lotRemainder: lotAmount };
  }
  const taken = remaining < lotAmount ? remaining : lotAmount;
  return { taken, lotRemainder: lotAmount - taken };
}

function drainResidualLots(args: {
  lots: WaterfallResidualLot[];
  remaining: bigint;
  source: WaterfallSourceKind;
  confidence: WaterfallConfidence;
}): { remaining: bigint; attributions: WaterfallAttribution[] } {
  const attributions: WaterfallAttribution[] = [];
  let remaining = args.remaining;

  // Deterministic order: oldest first; ties broken by lot id ascending.
  const ordered = [...args.lots].sort((a, b) => {
    const t = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  for (const lot of ordered) {
    if (remaining <= 0n) break;
    const { taken, lotRemainder } = takeFromLot(remaining, lot.amount);
    if (taken <= 0n) continue;
    attributions.push({
      source: args.source,
      amount: taken,
      confidence: args.confidence,
      residualLotId: lot.id,
      sourceLotId: null,
      sourceLedgerEventId: lot.sourceLedgerEventId,
      poolId: lot.poolId,
    });
    lot.amount = lotRemainder;
    remaining -= taken;
  }

  return { remaining, attributions };
}

function drainResidualLotsProRata(args: {
  lots: WaterfallResidualLot[];
  remaining: bigint;
  source: WaterfallSourceKind;
  confidence: WaterfallConfidence;
}): { remaining: bigint; attributions: WaterfallAttribution[] } {
  const attributions: WaterfallAttribution[] = [];
  let remaining = args.remaining;
  if (remaining <= 0n || args.lots.length === 0) {
    return { remaining, attributions };
  }

  const totalAvailable = args.lots.reduce((acc, lot) => acc + (lot.amount > 0n ? lot.amount : 0n), 0n);
  if (totalAvailable <= 0n) {
    return { remaining, attributions };
  }

  const target = remaining < totalAvailable ? remaining : totalAvailable;
  // Deterministic order for stable rounding-tail assignment.
  const ordered = [...args.lots]
    .filter((lot) => lot.amount > 0n)
    .sort((a, b) => {
      const t = a.occurredAt.getTime() - b.occurredAt.getTime();
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });

  let allocatedSoFar = 0n;
  for (let i = 0; i < ordered.length; i += 1) {
    const lot = ordered[i];
    if (lot === undefined) continue;
    const isLast = i === ordered.length - 1;
    const share = isLast ? target - allocatedSoFar : (target * lot.amount) / totalAvailable;
    if (share <= 0n) continue;
    const { taken, lotRemainder } = takeFromLot(share, lot.amount);
    if (taken <= 0n) continue;
    attributions.push({
      source: args.source,
      amount: taken,
      confidence: args.confidence,
      residualLotId: lot.id,
      sourceLotId: null,
      sourceLedgerEventId: lot.sourceLedgerEventId,
      poolId: lot.poolId,
    });
    lot.amount = lotRemainder;
    allocatedSoFar += taken;
    remaining -= taken;
  }

  return { remaining, attributions };
}

function drainSourceLots(args: {
  lots: WaterfallSourceLot[];
  remaining: bigint;
  source: WaterfallSourceKind;
  confidence: WaterfallConfidence;
}): { remaining: bigint; attributions: WaterfallAttribution[] } {
  const attributions: WaterfallAttribution[] = [];
  let remaining = args.remaining;
  const ordered = [...args.lots].sort((a, b) => {
    const t = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  for (const lot of ordered) {
    if (remaining <= 0n) break;
    const { taken, lotRemainder } = takeFromLot(remaining, lot.amount);
    if (taken <= 0n) continue;
    attributions.push({
      source: args.source,
      amount: taken,
      confidence: args.confidence,
      residualLotId: null,
      sourceLotId: lot.id,
      sourceLedgerEventId: lot.sourceLedgerEventId,
      poolId: null,
    });
    lot.amount = lotRemainder;
    remaining -= taken;
  }

  return { remaining, attributions };
}

/**
 * Drain the available residual and source inventory for the consumption token
 * in canonical waterfall order. The provided `residualLots` and `sourceLots`
 * arrays are mutated so the caller can chain multiple consumptions in time
 * order and accumulate state.
 */
export function allocateSourceOfFunds(inputs: WaterfallInputs): WaterfallAllocation {
  const token = normalizeToken(inputs.consumption.tokenAddress);
  const consumptionTime = inputs.consumption.occurredAt.getTime();

  const residualSameToken = inputs.residualLots.filter(
    (lot) =>
      lot.amount > 0n &&
      normalizeToken(lot.tokenAddress) === token &&
      lot.occurredAt.getTime() <= consumptionTime,
  );
  const sourceSameToken = inputs.sourceLots.filter(
    (lot) =>
      lot.amount > 0n &&
      normalizeToken(lot.tokenAddress) === token &&
      lot.occurredAt.getTime() <= consumptionTime,
  );

  const candidatePoolId = inputs.consumption.candidatePoolId;

  const candidatePoolResiduals = candidatePoolId
    ? residualSameToken.filter((lot) => lot.poolId === candidatePoolId)
    : [];
  const matchingCashIns = sourceSameToken.filter((lot) => lot.sourceType === "cash_in");
  const liquidationOrRewardResiduals = residualSameToken.filter(
    (lot) => lot.poolId !== candidatePoolId && LIQUIDATION_OR_REWARD_TYPES.has(lot.sourceType),
  );
  const liquidationOrRewardSources = sourceSameToken.filter(
    (lot) => LIQUIDATION_OR_REWARD_TYPES.has(lot.sourceType),
  );
  const otherPoolResiduals = residualSameToken.filter(
    (lot) =>
      lot.poolId !== candidatePoolId &&
      !LIQUIDATION_OR_REWARD_TYPES.has(lot.sourceType),
  );

  const attributions: WaterfallAttribution[] = [];
  let remaining = inputs.consumption.amount;

  // Tier 1: candidate pool residual lots (high confidence rebalance/redeploy origin).
  const tier1 = drainResidualLots({
    lots: candidatePoolResiduals,
    remaining,
    source: "candidate_pool_residual",
    confidence: "high",
  });
  attributions.push(...tier1.attributions);
  remaining = tier1.remaining;

  const tier2 = drainSourceLots({
    lots: matchingCashIns,
    remaining,
    source: "matching_cash_in",
    confidence: "high",
  });
  attributions.push(...tier2.attributions);
  remaining = tier2.remaining;

  const tier3a = drainResidualLots({
    lots: liquidationOrRewardResiduals,
    remaining,
    source: "liquidation_or_reward",
    confidence: "medium",
  });
  attributions.push(...tier3a.attributions);
  remaining = tier3a.remaining;

  const tier3b = drainSourceLots({
    lots: liquidationOrRewardSources,
    remaining,
    source: "liquidation_or_reward",
    confidence: "medium",
  });
  attributions.push(...tier3b.attributions);
  remaining = tier3b.remaining;

  const tier4 = drainResidualLotsProRata({
    lots: otherPoolResiduals,
    remaining,
    source: "other_pool_residual",
    confidence: "medium",
  });
  attributions.push(...tier4.attributions);
  remaining = tier4.remaining;

  // Tier 5: unknown inventory is reported only as unallocated; we do not invent
  // a fake source lot. Callers persist this as a low-confidence "unknown" leg.
  if (remaining > 0n) {
    attributions.push({
      source: "unknown",
      amount: remaining,
      confidence: "low",
      residualLotId: null,
      sourceLotId: null,
      sourceLedgerEventId: null,
      poolId: null,
    });
  }

  return {
    consumingLedgerEventId: inputs.consumption.consumingLedgerEventId,
    tokenAddress: token,
    totalRequested: inputs.consumption.amount,
    attributions,
    unallocatedAmount: remaining,
  };
}

export type InferredDepositActionInput = {
  /** Pool the deposit is being made into. */
  targetPoolId: string;
  /** Allocations for every token leg of the deposit. */
  legAllocations: WaterfallAllocation[];
  /**
   * True when at least one of the funding legs was preceded (within the same
   * tx graph) by a swap that consumed candidate-pool residual liquidity in
   * the paired token. Caller is responsible for determining this from the
   * cross-leg residual/source trail; the allocator alone cannot.
   */
  pairedSwapConsumedCandidateResidual: boolean;
};

export type InferredDepositAction =
  | { actionType: "rebalance_same_pool"; confidence: WaterfallConfidence }
  | { actionType: "redeploy_same_pool"; confidence: WaterfallConfidence }
  | { actionType: "new_capital_deposit"; confidence: WaterfallConfidence }
  | { actionType: "unknown_source_deposit"; confidence: "low" };

/**
 * Classify a deposit's funding semantics from its waterfall allocations.
 *
 * Semantics (per Phase 0 contract):
 *   - rebalance_same_pool: the deposit's funding traces back to the same
 *     pool's residual liquidity, via a paired-token swap.
 *   - redeploy_same_pool: the deposit is funded directly by the same pool's
 *     residual liquidity in the same token (no swap needed).
 *   - new_capital_deposit: the dominant funding is cash_in.
 *   - unknown_source_deposit: the dominant funding could not be attributed.
 */
export function classifyInferredDepositAction(
  input: InferredDepositActionInput,
): InferredDepositAction {
  const totals = new Map<WaterfallSourceKind, bigint>();
  let grandTotal = 0n;
  for (const alloc of input.legAllocations) {
    for (const attribution of alloc.attributions) {
      totals.set(
        attribution.source,
        (totals.get(attribution.source) ?? 0n) + attribution.amount,
      );
      grandTotal += attribution.amount;
    }
  }

  if (grandTotal === 0n) {
    return { actionType: "unknown_source_deposit", confidence: "low" };
  }

  const share = (kind: WaterfallSourceKind): number => {
    const v = totals.get(kind) ?? 0n;
    if (v === 0n) return 0;
    // bigint -> number ratio with enough precision for share thresholds
    return Number((v * 10000n) / grandTotal) / 10000;
  };

  const candidatePoolShare = share("candidate_pool_residual");
  const cashInShare = share("matching_cash_in");
  const unknownShare = share("unknown");

  // Rebalance: candidate-pool residual via paired swap is the dominant funding.
  if (input.pairedSwapConsumedCandidateResidual && candidatePoolShare >= 0.5) {
    return { actionType: "rebalance_same_pool", confidence: "high" };
  }

  // Redeploy: direct same-pool residual without needing a paired swap.
  if (!input.pairedSwapConsumedCandidateResidual && candidatePoolShare >= 0.5) {
    return { actionType: "redeploy_same_pool", confidence: "high" };
  }

  if (cashInShare >= 0.5) {
    return { actionType: "new_capital_deposit", confidence: "high" };
  }

  if (unknownShare >= 0.5) {
    return { actionType: "unknown_source_deposit", confidence: "low" };
  }

  return { actionType: "new_capital_deposit", confidence: "medium" };
}
