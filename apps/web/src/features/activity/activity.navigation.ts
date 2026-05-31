import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

export function getActivityHref(input: {
  chainId?: number;
  selectedActivityId?: string | null;
  surface?: string | null;
  action?: string | null;
  poolId?: string | null;
  depositId?: string | null;
  strategyId?: string | null;
  rewardEventId?: string | null;
  governanceEventId?: string | null;
} = {}) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId ?? SUPPORTED_CHAIN_ID));
  if (input.selectedActivityId) params.set("selected", input.selectedActivityId);
  if (input.surface) params.set("surface", input.surface);
  if (input.action) params.set("action", input.action);
  if (input.poolId) params.set("poolId", input.poolId);
  if (input.depositId) params.set("depositId", input.depositId);
  if (input.strategyId) params.set("strategyId", input.strategyId);
  if (input.rewardEventId) params.set("rewardEventId", input.rewardEventId);
  if (input.governanceEventId) params.set("governanceEventId", input.governanceEventId);
  return `/activity?${params.toString()}`;
}
