type MoneyValue = {
  amount: string;
};

type PoolLike = {
  currentValue: MoneyValue;
  strategies?: Array<{
    strategyType: "manual" | "mellow_auto";
    currentValue: MoneyValue;
  }>;
};

type ReconciliationInput = {
  totalValue: MoneyValue;
  poolValues: PoolLike[];
  idleResidualValue: MoneyValue;
};

export type ReconciliationResult = {
  isReconciled: boolean;
  expectedTotal: string;
  reportedTotal: string;
  delta: string;
};

function toNumber(amount: string) {
  return Number.parseFloat(amount || "0");
}

function fixed4(value: number) {
  return value.toFixed(4);
}

export class DashboardReconciliationService {
  reconcile(input: ReconciliationInput): ReconciliationResult {
    const poolsTotal = input.poolValues.reduce((sum, pool) => sum + toNumber(pool.currentValue.amount), 0);
    const expected = poolsTotal + toNumber(input.idleResidualValue.amount);
    const reported = toNumber(input.totalValue.amount);
    const delta = reported - expected;

    return {
      isReconciled: Math.abs(delta) < 0.0001,
      expectedTotal: fixed4(expected),
      reportedTotal: fixed4(reported),
      delta: fixed4(delta)
    };
  }

  assertPoolStrategyReconciliation(pool: PoolLike & { poolId?: string }) {
    if (!pool.strategies || pool.strategies.length === 0) {
      return;
    }

    const strategyTypes = new Set(pool.strategies.map((strategy) => strategy.strategyType));
    if (strategyTypes.size !== pool.strategies.length && strategyTypes.size > 1) {
      throw new Error(`Strategy separation is ambiguous for pool ${pool.poolId ?? "unknown"}.`);
    }

    const sumStrategies = pool.strategies.reduce(
      (total, strategy) => total + toNumber(strategy.currentValue.amount),
      0
    );
    const poolValue = toNumber(pool.currentValue.amount);

    if (Math.abs(sumStrategies - poolValue) >= 0.0001) {
      throw new Error(
        `Pool strategy reconciliation failed for pool ${pool.poolId ?? "unknown"}: ` +
          `strategies=${fixed4(sumStrategies)} pool=${fixed4(poolValue)}`
      );
    }
  }

  assertPortfolioReconciliation(input: {
    totalValue: MoneyValue;
    pools: PoolLike[];
    idleResidualValue: MoneyValue;
  }) {
    const result = this.reconcile({
      totalValue: input.totalValue,
      poolValues: input.pools,
      idleResidualValue: input.idleResidualValue
    });

    if (!result.isReconciled) {
      throw new Error(
        `Portfolio reconciliation failed: expected=${result.expectedTotal} reported=${result.reportedTotal} delta=${result.delta}`
      );
    }
  }
}
