import { accountGovernance, accountRewards } from "@/server/analysis/engine-v2/accounting";
import { governanceLockFromTransferBackfill, shouldBackfillGovernanceLockOrigin } from "@/server/analysis/engine-v2/enrichment";

export function runKnownBugsRegression() {
  const walletAddress = "0x0000000000000000000000000000000000000001";
  const shouldBackfill = shouldBackfillGovernanceLockOrigin({
    eventType: "governance_deposit_managed",
    tokenId: "113464",
    hasKnownLock: false,
  });
  const lockBackfill = governanceLockFromTransferBackfill({
    chainId: 8453,
    walletAddress,
    votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
    tokenId: "113464",
    originTxHash: "0x0000000000000000000000000000000000000000000000000000000000000060",
    source: "nft_transfer_history",
    provenance: "protocol_grant",
    evidenceJson: {
      decodedTransferTxProvider: "moralis_transaction_decoded",
      protocolKnownAddressKind: "protocol-grants",
    },
  });
  if (!shouldBackfill || lockBackfill.metadataJson?.provenance !== "protocol_grant") {
    throw new Error("ENGINE_V2_KNOWN_BUG_LOCK_GRANT_BACKFILL_FAILED");
  }

  const governance = accountGovernance({
    events: [{
      id: "managed",
      chainId: 8453,
      walletAddress,
      eventType: "governance_deposit_managed",
      eventFamily: "governance",
      occurredAt: new Date("2026-01-02T00:00:00.000Z"),
      txHash: "0xmanaged",
      sequenceIndex: 0,
      coverageStatus: "full",
      confidence: "high",
      reasonCodes: [],
      metadataJson: {
        votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
        lockTokenId: "113464",
        managedTokenId: "10298",
      },
    }],
  });
  if (governance.managedLinks[0]?.managedTokenId !== "10298") {
    throw new Error("ENGINE_V2_KNOWN_BUG_MANAGED_LOCK_LINK_FAILED");
  }

  const rewards = accountRewards({
    events: [{
      id: "claim",
      chainId: 8453,
      walletAddress,
      eventType: "governance_claimBribes",
      eventFamily: "governance",
      occurredAt: new Date("2026-01-03T00:00:00.000Z"),
      txHash: "0xclaim",
      sequenceIndex: 0,
      coverageStatus: "partial",
      confidence: "medium",
      reasonCodes: ["missing_distributor_pool_link"],
      metadataJson: { rewardId: "claim:0", rewardType: "governance_bribe", amountUsd: "1" },
    }],
    links: [{ domainEventId: "claim", entityType: "governance_lock", entityId: "lock-113464" }],
  });
  if (rewards[0]?.poolContribution !== "unresolved" || rewards[0]?.affectsTotals !== true) {
    throw new Error("ENGINE_V2_KNOWN_BUG_CLAIM_ITEM_COVERAGE_FAILED");
  }

  return {
    lockOrigin: lockBackfill.originKind,
    managedLinkCount: governance.managedLinks.length,
    unresolvedClaimItemCount: rewards.filter((reward) => reward.poolContribution === "unresolved").length,
  };
}
