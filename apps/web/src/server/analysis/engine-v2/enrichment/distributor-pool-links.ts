import { engineV2DistributorPoolLinks } from "@/server/db/schema";

export function distributorPoolLinkValues(input: {
  chainId: number;
  distributorAddress: string;
  poolAddress: string;
  gaugeAddress?: string | null;
  distributorKind?: "bribe" | "fee" | "unknown";
  sourceTxHash?: string | null;
  sourceLogIndex?: number | null;
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2DistributorPoolLinks.$inferInsert {
  return {
    chainId: input.chainId,
    distributorAddress: input.distributorAddress.toLowerCase(),
    poolAddress: input.poolAddress.toLowerCase(),
    gaugeAddress: input.gaugeAddress?.toLowerCase() ?? null,
    distributorKind: input.distributorKind ?? "unknown",
    sourceTxHash: input.sourceTxHash?.toLowerCase() ?? null,
    sourceLogIndex: input.sourceLogIndex ?? null,
    evidenceJson: input.evidenceJson ?? {},
  };
}

export function distributorPoolLinkFromGaugeCreated(input: {
  chainId: number;
  txHash: string;
  logIndex: number;
  params: Record<string, string | undefined>;
}) {
  const poolAddress = input.params.pool;
  const distributorAddress = input.params.bribeVotingReward ?? input.params.feeVotingReward;
  if (!poolAddress || !distributorAddress) return null;

  return distributorPoolLinkValues({
    chainId: input.chainId,
    distributorAddress,
    poolAddress,
    gaugeAddress: input.params.gauge ?? null,
    distributorKind: input.params.bribeVotingReward ? "bribe" : "fee",
    sourceTxHash: input.txHash,
    sourceLogIndex: input.logIndex,
    evidenceJson: { source: "Voter.GaugeCreated", params: input.params },
  });
}
