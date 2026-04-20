import Decimal from "decimal.js";

import { type PortfolioAccountingSnapshot } from "@/domains/accounting/model/accounting-snapshot";
import { type CurrentHoldingValuation, type ValuedMovement } from "@/domains/accounting/model/valued-movement";
import { AccountingExclusionService } from "@/domains/accounting/services/accounting-exclusion-service";

function money(amount: Decimal) {
  return {
    currency: "usd" as const,
    amount: amount.toFixed(4)
  };
}

export class PortfolioAccountingService {
  private readonly exclusionService = new AccountingExclusionService();

  buildPortfolioSnapshot(input: {
    contractVersion: string;
    sessionId: string;
    acceptedRunId: string;
    asOf: Date;
    movements: ValuedMovement[];
    currentHoldings: CurrentHoldingValuation[];
    discarded: Array<{ reasonCode: string }>;
    poolSummaries: PortfolioAccountingSnapshot["pools"];
  }) {
    let capitalEnteredUsd = new Decimal(0);
    let capitalWithdrawnUsd = new Decimal(0);
    let realizedPnlUsd = new Decimal(0);
    let currentValueUsd = new Decimal(0);
    let idleBalanceValueUsd = new Decimal(0);
    let costBasisUsd = new Decimal(0);
    let pricedValueUsd = new Decimal(0);
    let unpricedComponentsCount = 0;
    const reasonCodes = new Set<string>();
    const ledgerRecordIds = new Set<string>();
    const pricePointIds = new Set<string>();

    for (const movement of input.movements) {
      ledgerRecordIds.add(movement.ledgerRecordId);
      if (movement.pricePointId) {
        pricePointIds.add(movement.pricePointId);
      }

      if (movement.eventType === "external_deposit" && movement.eventValueUsd) {
        capitalEnteredUsd = capitalEnteredUsd.plus(new Decimal(movement.eventValueUsd));
      }

      if (movement.eventType === "external_withdrawal" && movement.eventValueUsd) {
        capitalWithdrawnUsd = capitalWithdrawnUsd.plus(new Decimal(movement.eventValueUsd));
      }

      if (movement.movementRole !== "principal" && movement.direction === "in" && movement.eventValueUsd) {
        realizedPnlUsd = realizedPnlUsd.plus(new Decimal(movement.eventValueUsd));
      }

      if (!movement.eventValueUsd) {
        unpricedComponentsCount += 1;
        reasonCodes.add(movement.coverage.reasonCode);
      }
    }

    const idleBalances = input.currentHoldings
      .filter((holding) => holding.holdingType === "idle_balance" || holding.holdingType === "residual_holding")
      .map((holding) => {
        for (const ledgerRecordId of holding.traceLedgerRecordIds) {
          ledgerRecordIds.add(ledgerRecordId);
        }
        if (holding.pricePointId) {
          pricePointIds.add(holding.pricePointId);
        }

        const currentValueUsdForHolding = holding.currentValueUsd ? new Decimal(holding.currentValueUsd) : new Decimal(0);
        const costBasisUsdForHolding = new Decimal(holding.costBasisUsd);
        currentValueUsd = currentValueUsd.plus(currentValueUsdForHolding);
        idleBalanceValueUsd = idleBalanceValueUsd.plus(currentValueUsdForHolding);
        costBasisUsd = costBasisUsd.plus(costBasisUsdForHolding);
        if (holding.currentValueUsd) {
          pricedValueUsd = pricedValueUsd.plus(currentValueUsdForHolding);
        } else {
          unpricedComponentsCount += 1;
          reasonCodes.add(holding.coverage.reasonCode);
        }

        return {
          tokenAddress: holding.tokenAddress,
          symbol: holding.symbol,
          amountRaw: holding.amount,
          currentValue: holding.currentValueUsd ? money(new Decimal(holding.currentValueUsd)) : null,
          coverageStatus: holding.currentValueUsd ? "priced" : "unpriced",
          reasonCode: holding.coverage.reasonCode,
          candidatePoolIds: [],
          traceRefs: {
            ledgerRecordIds: holding.traceLedgerRecordIds,
            pricePointIds: holding.pricePointId ? [holding.pricePointId] : []
          }
        };
      });

    for (const holding of input.currentHoldings.filter(
      (entry) => entry.holdingType === "position" && entry.positionInstanceId !== null
    )) {
      for (const ledgerRecordId of holding.traceLedgerRecordIds) {
        ledgerRecordIds.add(ledgerRecordId);
      }
      if (holding.pricePointId) {
        pricePointIds.add(holding.pricePointId);
      }

      if (holding.currentValueUsd) {
        currentValueUsd = currentValueUsd.plus(new Decimal(holding.currentValueUsd));
        pricedValueUsd = pricedValueUsd.plus(new Decimal(holding.currentValueUsd));
      } else {
        unpricedComponentsCount += 1;
        reasonCodes.add(holding.coverage.reasonCode);
      }

      costBasisUsd = costBasisUsd.plus(new Decimal(holding.costBasisUsd));
    }

    for (const discardedItem of input.discarded) {
      reasonCodes.add(discardedItem.reasonCode);
    }

    const coverageSummary = this.exclusionService.buildCoverageSummary({
      pricedValueUsd: pricedValueUsd.toFixed(4),
      excludedValueUsd: null,
      reasonCodes: [...reasonCodes],
      unpricedComponentsCount: unpricedComponentsCount + input.discarded.length
    });

    return {
      contractVersion: input.contractVersion,
      sessionId: input.sessionId,
      acceptedRunId: input.acceptedRunId,
      asOf: input.asOf.toISOString(),
      quoteCurrency: "usd" as const,
      totalValue: money(currentValueUsd),
      capitalEntered: money(capitalEnteredUsd),
      capitalWithdrawn: money(capitalWithdrawnUsd),
      realizedPnl: money(realizedPnlUsd),
      unrealizedPnl: money(currentValueUsd.minus(costBasisUsd)),
      idleBalanceValue: money(idleBalanceValueUsd),
      coverageSummary,
      pools: input.poolSummaries,
      idleBalances,
      traceRefs: {
        ledgerRecordIds: [...ledgerRecordIds],
        pricePointIds: [...pricePointIds]
      }
    };
  }
}