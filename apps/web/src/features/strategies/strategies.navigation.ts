import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

export function buildStrategiesListHref(input: {
  chainId: number;
  poolId?: string | null;
  selectedStrategyId?: string | null;
}): string {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  if (input.poolId) {
    params.set("pool", input.poolId);
  }
  if (input.selectedStrategyId) {
    params.set("selectedStrategyId", input.selectedStrategyId);
  }
  return `/strategies?${params.toString()}`;
}

export function buildStrategyDetailHref(input: {
  chainId: number;
  strategyId: string;
}): string {
  const params = new URLSearchParams({ chainId: String(input.chainId) });
  return `/strategies/${input.strategyId}?${params.toString()}`;
}

export function getStrategiesListHref(chainId = SUPPORTED_CHAIN_ID): string {
  return buildStrategiesListHref({ chainId });
}

export function getStrategyDetailHref(strategyId: string, chainId = SUPPORTED_CHAIN_ID): string {
  return buildStrategyDetailHref({ chainId, strategyId });
}
