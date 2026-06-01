import { engineV2GovernanceLocks } from "@/server/db/schema";

export function shouldBackfillGovernanceLockOrigin(input: {
  eventType: string;
  tokenId?: string | null;
  hasKnownLock?: boolean;
}) {
  return Boolean(
    input.tokenId
    && !input.hasKnownLock
    && [
      "governance_deposit_managed",
      "governance_vote",
      "governance_poke",
      "governance_bribe_claim",
      "governance_fee_claim",
      "governance_rebase_claim",
    ].includes(input.eventType),
  );
}

export function governanceLockFromTransferBackfill(input: {
  chainId: number;
  walletAddress: string;
  votingEscrowAddress: string;
  tokenId: string;
  originTxHash: string;
  source: "nft_transfer_history" | "decoded_tx_backfill" | "eth_getLogs";
  provenance?: "protocol_grant" | "wallet_transfer" | "unknown";
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2GovernanceLocks.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    votingEscrowAddress: input.votingEscrowAddress.toLowerCase(),
    lockTokenId: input.tokenId,
    ownerAddress: input.walletAddress.toLowerCase(),
    originTxHash: input.originTxHash.toLowerCase(),
    originKind: input.source,
    coverageStatus: input.provenance === "unknown" ? "partial" : "full",
    confidence: input.provenance === "unknown" ? "medium" : "high",
    metadataJson: { provenance: input.provenance ?? "unknown", ...input.evidenceJson },
  };
}
