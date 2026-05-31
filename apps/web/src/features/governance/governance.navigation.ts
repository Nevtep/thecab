import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

export function getGovernanceHref(input: {
  chainId?: number;
  selectedGovernanceId?: string | null;
  selectedKind?: "event" | "reward" | "epoch" | "metric" | null;
  governanceEventId?: string | null;
  rewardEventId?: string | null;
  poolId?: string | null;
  epochId?: string | null;
  eventType?: string | null;
  rewardType?: string | null;
  protocolSurface?: string | null;
  coverage?: string | null;
  confidence?: string | null;
} = {}) {
  const params = new URLSearchParams();
  params.set("chainId", String(input.chainId ?? SUPPORTED_CHAIN_ID));
  if (input.selectedKind) params.set("kind", input.selectedKind);
  if (input.selectedGovernanceId) params.set("selected", input.selectedGovernanceId);
  if (input.governanceEventId) params.set("governanceEventId", input.governanceEventId);
  if (input.rewardEventId) params.set("rewardEventId", input.rewardEventId);
  if (input.poolId) params.set("poolId", input.poolId);
  if (input.epochId) params.set("epochId", input.epochId);
  if (input.eventType) params.set("eventType", input.eventType);
  if (input.rewardType) params.set("rewardType", input.rewardType);
  if (input.protocolSurface) params.set("protocolSurface", input.protocolSurface);
  if (input.coverage) params.set("coverage", input.coverage);
  if (input.confidence) params.set("confidence", input.confidence);
  return `/governance?${params.toString()}`;
}
