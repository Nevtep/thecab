import Decimal from "decimal.js";

import { type AccountingCoverageSummary, type MoneyValue } from "@/domains/accounting/model/accounting-snapshot";
import { createTraceAccumulator, mergeTrace, type TraceAccumulator } from "@/domains/accounting/model/accounting-trace";
import {
  type PoolAccountingSummary,
  type PositionAccountingSummary,
  type StrategyAccountingSummary
} from "@/domains/accounting/model/scope-accounting-summary";
import { type CurrentHoldingValuation, type ValuedMovement } from "@/domains/accounting/model/valued-movement";
import { AccountingExclusionService } from "@/domains/accounting/services/accounting-exclusion-service";
import { PositionAccountingService } from "@/domains/accounting/services/position-accounting-service";

type ScopeAccumulator = {
  currentValueUsd: Decimal;
  costBasisUsd: Decimal;
  capitalEnteredUsd: Decimal;
  capitalWithdrawnUsd: Decimal;
  realizedPnlUsd: Decimal;
  pricedValueUsd: Decimal;
  unpricedComponentsCount: number;
  reasonCodes: Set<string>;
  trace: TraceAccumulator;
};

function money(amount: Decimal): MoneyValue {
  return {
    currency: "usd",
    amount: amount.toFixed(4)
  };
}

function createAccumulator(): ScopeAccumulator {
  return {
    currentValueUsd: new Decimal(0),
    costBasisUsd: new Decimal(0),
    capitalEnteredUsd: new Decimal(0),
    capitalWithdrawnUsd: new Decimal(0),
    realizedPnlUsd: new Decimal(0),
    pricedValueUsd: new Decimal(0),
    unpricedComponentsCount: 0,
    reasonCodes: new Set<string>(),
    trace: createTraceAccumulator()
  };
}

function toCoverageSummary(exclusionService: AccountingExclusionService, input: ScopeAccumulator): AccountingCoverageSummary {
  return exclusionService.buildCoverageSummary({
    pricedValueUsd: input.pricedValueUsd.toFixed(4),
    excludedValueUsd: null,
    reasonCodes: [...input.reasonCodes],
    unpricedComponentsCount: input.unpricedComponentsCount
  });
}

function accumulateMovement(accumulator: ScopeAccumulator, movement: ValuedMovement) {
  if (movement.eventValueUsd) {
    const eventValueUsd = new Decimal(movement.eventValueUsd);
    if (movement.direction === "out" && movement.movementRole === "principal") {
      accumulator.capitalEnteredUsd = accumulator.capitalEnteredUsd.plus(eventValueUsd);
    }

    if (movement.direction === "in" && movement.movementRole === "principal") {
      accumulator.capitalWithdrawnUsd = accumulator.capitalWithdrawnUsd.plus(eventValueUsd);
    }

    if (movement.movementRole !== "principal" && movement.direction === "in") {
      accumulator.realizedPnlUsd = accumulator.realizedPnlUsd.plus(eventValueUsd);
    }
  } else {
    accumulator.unpricedComponentsCount += 1;
    accumulator.reasonCodes.add(movement.coverage.reasonCode);
  }

  accumulator.trace.ledgerRecordIds.add(movement.ledgerRecordId);
  if (movement.pricePointId) {
    accumulator.trace.pricePointIds.add(movement.pricePointId);
  }
}

function accumulateHolding(accumulator: ScopeAccumulator, holding: CurrentHoldingValuation) {
  if (holding.currentValueUsd) {
    accumulator.currentValueUsd = accumulator.currentValueUsd.plus(new Decimal(holding.currentValueUsd));
    accumulator.pricedValueUsd = accumulator.pricedValueUsd.plus(new Decimal(holding.currentValueUsd));
  } else {
    accumulator.unpricedComponentsCount += 1;
    accumulator.reasonCodes.add(holding.coverage.reasonCode);
  }

  accumulator.costBasisUsd = accumulator.costBasisUsd.plus(new Decimal(holding.costBasisUsd));
  for (const ledgerRecordId of holding.traceLedgerRecordIds) {
    accumulator.trace.ledgerRecordIds.add(ledgerRecordId);
  }
  if (holding.pricePointId) {
    accumulator.trace.pricePointIds.add(holding.pricePointId);
  }
}

export class ScopeAccountingService {
  private readonly exclusionService = new AccountingExclusionService();
  private readonly positionAccountingService = new PositionAccountingService();

  buildScopeSummaries(input: {
    projection: {
      pools: Array<{
        poolId: string;
        displayName: string;
        strategies: Array<{
          strategyId: string;
          strategyType: "manual" | "mellow_auto";
          positions: Array<{
            positionInstanceId: string;
            positionType: "manual_cl" | "mellow_exposure";
          }>;
        }>;
      }>;
    };
    records: Array<{
      ledgerRecordId: string;
      poolId: string | null;
      strategyId: string | null;
      positionInstanceId: string | null;
      eventType: string;
    }>;
    movements: ValuedMovement[];
    currentHoldings: CurrentHoldingValuation[];
    residuals: Array<{
      latestSourceLedgerRecordId: string | null;
      candidatePoolIds: string[];
    }>;
  }) {
    const movementAccumulators = new Map<string, ScopeAccumulator>();
    const holdingAccumulators = new Map<string, ScopeAccumulator>();

    for (const movement of input.movements) {
      if (!movement.poolId || !movement.strategyId || !movement.positionInstanceId) {
        continue;
      }

      for (const scopeKey of [
        `pool:${movement.poolId}`,
        `strategy:${movement.strategyId}`,
        `position:${movement.positionInstanceId}`
      ]) {
        const accumulator = movementAccumulators.get(scopeKey) ?? createAccumulator();
        accumulateMovement(accumulator, movement);
        movementAccumulators.set(scopeKey, accumulator);
      }
    }

    for (const holding of input.currentHoldings) {
      if (holding.holdingType !== "position") {
        continue;
      }

      const scopeKey = holding.subjectId;
      const accumulator = holdingAccumulators.get(scopeKey) ?? createAccumulator();
      accumulateHolding(accumulator, holding);
      holdingAccumulators.set(scopeKey, accumulator);
    }

    const poolSummaries: PoolAccountingSummary[] = [];
    for (const pool of input.projection.pools) {
      const poolAccumulator = createAccumulator();
      const strategySummaries: StrategyAccountingSummary[] = [];

      for (const strategy of pool.strategies) {
        const strategyAccumulator = createAccumulator();
        const positionSummaries: PositionAccountingSummary[] = [];

        for (const position of strategy.positions) {
          const movementAccumulator = movementAccumulators.get(`position:${position.positionInstanceId}`) ?? createAccumulator();
          const holdingAccumulator = holdingAccumulators.get(`position:${position.positionInstanceId}`) ?? createAccumulator();
          const combined = createAccumulator();
          combined.capitalEnteredUsd = movementAccumulator.capitalEnteredUsd;
          combined.capitalWithdrawnUsd = movementAccumulator.capitalWithdrawnUsd;
          combined.realizedPnlUsd = movementAccumulator.realizedPnlUsd;
          combined.currentValueUsd = holdingAccumulator.currentValueUsd;
          combined.costBasisUsd = holdingAccumulator.costBasisUsd;
          combined.pricedValueUsd = holdingAccumulator.pricedValueUsd;
          combined.unpricedComponentsCount = movementAccumulator.unpricedComponentsCount + holdingAccumulator.unpricedComponentsCount;
          combined.reasonCodes = new Set([...movementAccumulator.reasonCodes, ...holdingAccumulator.reasonCodes]);
          mergeTrace(combined.trace, movementAccumulator.trace);
          mergeTrace(combined.trace, holdingAccumulator.trace);

          const unrealizedPnlUsd = combined.currentValueUsd.minus(combined.costBasisUsd);
          const summary: PositionAccountingSummary = {
            positionInstanceId: position.positionInstanceId,
            positionType: position.positionType,
            currentValue: money(combined.currentValueUsd),
            capitalEntered: money(combined.capitalEnteredUsd),
            capitalWithdrawn: money(combined.capitalWithdrawnUsd),
            realizedPnl: money(combined.realizedPnlUsd),
            unrealizedPnl: money(unrealizedPnlUsd),
            precisionStatus: this.positionAccountingService.determinePrecisionStatus({
              positionInstanceId: position.positionInstanceId,
              records: input.records,
              residuals: input.residuals
            }),
            coverageSummary: toCoverageSummary(this.exclusionService, combined),
            traceRefs: {
              ledgerRecordIds: [...combined.trace.ledgerRecordIds],
              pricePointIds: [...combined.trace.pricePointIds]
            }
          };
          positionSummaries.push(summary);

          strategyAccumulator.currentValueUsd = strategyAccumulator.currentValueUsd.plus(combined.currentValueUsd);
          strategyAccumulator.costBasisUsd = strategyAccumulator.costBasisUsd.plus(combined.costBasisUsd);
          strategyAccumulator.capitalEnteredUsd = strategyAccumulator.capitalEnteredUsd.plus(combined.capitalEnteredUsd);
          strategyAccumulator.capitalWithdrawnUsd = strategyAccumulator.capitalWithdrawnUsd.plus(combined.capitalWithdrawnUsd);
          strategyAccumulator.realizedPnlUsd = strategyAccumulator.realizedPnlUsd.plus(combined.realizedPnlUsd);
          strategyAccumulator.pricedValueUsd = strategyAccumulator.pricedValueUsd.plus(combined.pricedValueUsd);
          strategyAccumulator.unpricedComponentsCount += combined.unpricedComponentsCount;
          for (const reasonCode of combined.reasonCodes) {
            strategyAccumulator.reasonCodes.add(reasonCode);
          }
          mergeTrace(strategyAccumulator.trace, combined.trace);
        }

        const strategySummary: StrategyAccountingSummary = {
          strategyId: strategy.strategyId,
          strategyType: strategy.strategyType,
          currentValue: money(strategyAccumulator.currentValueUsd),
          capitalEntered: money(strategyAccumulator.capitalEnteredUsd),
          capitalWithdrawn: money(strategyAccumulator.capitalWithdrawnUsd),
          realizedPnl: money(strategyAccumulator.realizedPnlUsd),
          unrealizedPnl: money(strategyAccumulator.currentValueUsd.minus(strategyAccumulator.costBasisUsd)),
          coverageSummary: toCoverageSummary(this.exclusionService, strategyAccumulator),
          positions: positionSummaries,
          traceRefs: {
            ledgerRecordIds: [...strategyAccumulator.trace.ledgerRecordIds],
            pricePointIds: [...strategyAccumulator.trace.pricePointIds]
          }
        };
        strategySummaries.push(strategySummary);

        poolAccumulator.currentValueUsd = poolAccumulator.currentValueUsd.plus(strategyAccumulator.currentValueUsd);
        poolAccumulator.costBasisUsd = poolAccumulator.costBasisUsd.plus(strategyAccumulator.costBasisUsd);
        poolAccumulator.capitalEnteredUsd = poolAccumulator.capitalEnteredUsd.plus(strategyAccumulator.capitalEnteredUsd);
        poolAccumulator.capitalWithdrawnUsd = poolAccumulator.capitalWithdrawnUsd.plus(strategyAccumulator.capitalWithdrawnUsd);
        poolAccumulator.realizedPnlUsd = poolAccumulator.realizedPnlUsd.plus(strategyAccumulator.realizedPnlUsd);
        poolAccumulator.pricedValueUsd = poolAccumulator.pricedValueUsd.plus(strategyAccumulator.pricedValueUsd);
        poolAccumulator.unpricedComponentsCount += strategyAccumulator.unpricedComponentsCount;
        for (const reasonCode of strategyAccumulator.reasonCodes) {
          poolAccumulator.reasonCodes.add(reasonCode);
        }
        mergeTrace(poolAccumulator.trace, strategyAccumulator.trace);
      }

      poolSummaries.push({
        poolId: pool.poolId,
        displayName: pool.displayName,
        currentValue: money(poolAccumulator.currentValueUsd),
        capitalEntered: money(poolAccumulator.capitalEnteredUsd),
        capitalWithdrawn: money(poolAccumulator.capitalWithdrawnUsd),
        realizedPnl: money(poolAccumulator.realizedPnlUsd),
        unrealizedPnl: money(poolAccumulator.currentValueUsd.minus(poolAccumulator.costBasisUsd)),
        coverageSummary: toCoverageSummary(this.exclusionService, poolAccumulator),
        strategies: strategySummaries,
        traceRefs: {
          ledgerRecordIds: [...poolAccumulator.trace.ledgerRecordIds],
          pricePointIds: [...poolAccumulator.trace.pricePointIds]
        }
      });
    }

    return poolSummaries;
  }
}