import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

export function getStrategiesListHref(chainId = SUPPORTED_CHAIN_ID): string {
  return `/strategies?chainId=${chainId}`;
}

export function getStrategyDetailHref(strategyId: string, chainId = SUPPORTED_CHAIN_ID): string {
  return `/strategies/${strategyId}?chainId=${chainId}`;
}

export function buildDepositsPoolHref(input: { chainId: number; poolId: string }) {
  const params = new URLSearchParams({
    chainId: String(input.chainId),
    pool: input.poolId,
  });
  return `/deposits?${params.toString()}`;
}
