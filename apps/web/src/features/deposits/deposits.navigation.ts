const ENABLE_STRATEGIES_ROUTE = false;

export function getStrategiesListHref(): string | null {
  return ENABLE_STRATEGIES_ROUTE ? "/strategies" : null;
}

export function getStrategyDetailHref(strategyId: string): string | null {
  return ENABLE_STRATEGIES_ROUTE ? `/strategies/${strategyId}` : null;
}

export function buildDepositsPoolHref(input: { chainId: number; poolId: string }) {
  const params = new URLSearchParams({
    chainId: String(input.chainId),
    pool: input.poolId,
  });
  return `/deposits?${params.toString()}`;
}
