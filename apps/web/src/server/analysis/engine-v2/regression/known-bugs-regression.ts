import { encodeFunctionData } from "viem";

import { accountGovernance, accountRewards } from "@/server/analysis/engine-v2/accounting";
import { classifyGovernanceTransaction } from "@/server/analysis/engine-v2/classification";
import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";
import { governanceLockFromTransferBackfill, shouldBackfillGovernanceLockOrigin } from "@/server/analysis/engine-v2/enrichment";

const voter = "0x00000000000000000000000000000000000000bb";
const rewardsDistributor = "0x00000000000000000000000000000000000000cc";
const voterAbi = [
  {
    type: "function",
    name: "depositManaged",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "mTokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimFees",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fees", type: "address[]" },
      { name: "tokens", type: "address[][]" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [],
  },
] as const;
const rewardsDistributorAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
] as const;

function voterEntry(): AbiRegistryEntry {
  return {
    chainId: 8453,
    address: voter,
    label: "Voter",
    protocol: "aerodrome",
    expectedKind: "governance-voter",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    sources: { basescanApi: "", basescanCode: "" },
    source: {
      contractName: "Voter",
      compilerVersion: null,
      optimizationUsed: null,
      runs: null,
      constructorArguments: null,
      evmVersion: null,
      library: null,
      licenseType: null,
      proxy: false,
      implementation: null,
      swarmSource: null,
    },
    abi: voterAbi,
    warnings: [],
  };
}

function rewardsDistributorEntry(): AbiRegistryEntry {
  return {
    chainId: 8453,
    address: rewardsDistributor,
    label: "RewardsDistributor",
    protocol: "aerodrome",
    expectedKind: "governance-rebase",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    sources: { basescanApi: "", basescanCode: "" },
    source: {
      contractName: "RewardsDistributor",
      compilerVersion: null,
      optimizationUsed: null,
      runs: null,
      constructorArguments: null,
      evmVersion: null,
      library: null,
      licenseType: null,
      proxy: false,
      implementation: null,
      swarmSource: null,
    },
    abi: rewardsDistributorAbi,
    warnings: [],
  };
}

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

  const depositManagedClassification = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[voter, voterEntry()]]),
    tx: {
      hash: "0xmanaged",
      from_address: walletAddress,
      to_address: voter,
      receipt_status: "1",
      input: encodeFunctionData({ abi: voterAbi, functionName: "depositManaged", args: [113464n, 10298n] }),
    },
  });
  if (depositManagedClassification?.coverageStatus !== "full" || depositManagedClassification.metadataJson?.managedTokenId !== "10298") {
    throw new Error("ENGINE_V2_KNOWN_BUG_DEPOSIT_MANAGED_CLASSIFICATION_FAILED");
  }

  const governance = accountGovernance({
    events: [
      {
        id: "lock-110971",
        chainId: 8453,
        walletAddress,
        eventType: "governance_vote",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xvote",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
          lockTokenId: "110971",
        },
      },
      {
        id: "managed",
        chainId: 8453,
        walletAddress,
        eventType: "governance_deposit_managed",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xmanaged",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
          lockTokenId: "113464",
          managedTokenId: "10298",
        },
      },
    ],
  });
  if (governance.managedLinks[0]?.managedTokenId !== "10298" || governance.locks.length !== 2) {
    throw new Error("ENGINE_V2_KNOWN_BUG_MANAGED_LOCK_LINK_FAILED");
  }

  const nestedClaimFeesClassification = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[voter, voterEntry()]]),
    tx: {
      hash: "0xclaimfees",
      from_address: walletAddress,
      to_address: voter,
      receipt_status: "1",
      input: encodeFunctionData({
        abi: voterAbi,
        functionName: "multicall",
        args: [[encodeFunctionData({
          abi: voterAbi,
          functionName: "claimFees",
          args: [["0x00000000000000000000000000000000000000dd"], [["0x00000000000000000000000000000000000000ee"]], 110971n],
        })]],
      }),
    },
  });
  if (nestedClaimFeesClassification?.eventType !== "governance_fee_claim" || nestedClaimFeesClassification.metadataJson?.lockTokenId !== "110971") {
    throw new Error("ENGINE_V2_KNOWN_BUG_NESTED_CLAIM_FEES_FAILED");
  }

  const rebaseClassification = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[rewardsDistributor, rewardsDistributorEntry()]]),
    tx: {
      hash: "0xrebase",
      from_address: walletAddress,
      to_address: rewardsDistributor,
      receipt_status: "1",
      input: encodeFunctionData({ abi: rewardsDistributorAbi, functionName: "claim", args: [113464n] }),
    },
  });
  if (rebaseClassification?.coverageStatus !== "full") {
    throw new Error("ENGINE_V2_KNOWN_BUG_REBASE_CLASSIFICATION_FAILED");
  }

  const rewards = accountRewards({
    events: [
      {
        id: "claim-0",
        chainId: 8453,
        walletAddress,
        eventType: "governance_bribe_claim",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        txHash: "0xclaim",
        sequenceIndex: 0,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missing_distributor_pool_link"],
        metadataJson: { rewardId: "claim:0", rewardType: "governance_bribe", lockTokenId: "113464", amountUsd: "1", itemIndex: 0 },
      },
      {
        id: "claim-1",
        chainId: 8453,
        walletAddress,
        eventType: "governance_bribe_claim",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:01.000Z"),
        txHash: "0xclaim",
        sequenceIndex: 1,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missing_distributor_pool_link"],
        metadataJson: { rewardId: "claim:1", rewardType: "governance_bribe", lockTokenId: "113464", amountUsd: "2", itemIndex: 1 },
      },
    ],
    links: [
      { domainEventId: "claim-0", entityType: "governance_lock", entityId: "lock-113464" },
      { domainEventId: "claim-1", entityType: "governance_lock", entityId: "lock-113464" },
    ],
  });
  if (rewards[0]?.poolContribution !== "unresolved" || rewards[0]?.affectsTotals !== true || rewards.length !== 2) {
    throw new Error("ENGINE_V2_KNOWN_BUG_CLAIM_ITEM_COVERAGE_FAILED");
  }

  return {
    lockOrigin: lockBackfill.originKind,
    lockCount: governance.locks.length,
    managedLinkCount: governance.managedLinks.length,
    depositManagedCoverage: depositManagedClassification.coverageStatus,
    claimItemCount: rewards.length,
    nestedClaimFeesEventType: nestedClaimFeesClassification.eventType,
    rebaseCoverage: rebaseClassification.coverageStatus,
    unresolvedClaimItemCount: rewards.filter((reward) => reward.poolContribution === "unresolved").length,
  };
}
