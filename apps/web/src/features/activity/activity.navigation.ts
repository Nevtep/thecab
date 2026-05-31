import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

export function getActivityHref(input: {
  chainId?: number;
  selectedActivityId?: string | null;
  surface?: string | null;
  action?: string | null;
} = {}) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId ?? SUPPORTED_CHAIN_ID));
  if (input.selectedActivityId) params.set("selected", input.selectedActivityId);
  if (input.surface) params.set("surface", input.surface);
  if (input.action) params.set("action", input.action);
  return `/activity?${params.toString()}`;
}
