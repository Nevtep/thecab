import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";

import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";

import { classifyGovernanceTransaction } from "./governance-classifier";

const walletAddress = "0x0000000000000000000000000000000000000001";
const voter = "0x0000000000000000000000000000000000000002";
const abi = [
  {
    type: "function",
    name: "depositManaged",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "mTokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "pools", type: "address[]" },
      { name: "weights", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimFees",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fees", type: "address[][]" },
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
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

const rewardsDistributor = "0x0000000000000000000000000000000000000004";
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
    abi,
    warnings: [],
  };
}

test("classifyGovernanceTransaction identifies depositManaged with explicit lock and managed ids", () => {
  const result = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[voter, voterEntry()]]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: voter,
      receipt_status: "1",
      input: encodeFunctionData({ abi, functionName: "depositManaged", args: [113464n, 10298n] }),
    },
  });

  assert.equal(result?.eventType, "governance_deposit_managed");
  assert.equal(result?.coverageStatus, "full");
  assert.equal(result?.metadataJson?.managedTokenId, "10298");
  assert.equal(result?.evidence.noTimeWindowOwnershipInference, true);
});

test("classifyGovernanceTransaction identifies vote with high confidence", () => {
  const result = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[voter, voterEntry()]]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: voter,
      receipt_status: "1",
      input: encodeFunctionData({
        abi,
        functionName: "vote",
        args: [110971n, ["0x0000000000000000000000000000000000000003"], [1n]],
      }),
    },
  });

  assert.equal(result?.eventType, "governance_vote");
  assert.equal(result?.confidence, "high");
});

test("classifyGovernanceTransaction identifies nested claimFees and persists explicit distributor metadata", () => {
  const nestedClaim = encodeFunctionData({
    abi,
    functionName: "claimFees",
    args: [[[
      "0x0000000000000000000000000000000000000005",
    ]], [[
      "0x0000000000000000000000000000000000000006",
    ]], 110971n],
  });
  const result = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[voter, voterEntry()]]),
    tx: {
      hash: "0x2",
      from_address: walletAddress,
      to_address: voter,
      receipt_status: "1",
      input: encodeFunctionData({ abi, functionName: "multicall", args: [[nestedClaim]] }),
    },
  });

  assert.equal(result?.eventType, "governance_fee_claim");
  assert.equal(result?.coverageStatus, "partial");
  assert.deepEqual(result?.reasonCodes, ["missing_distributor_pool_link"]);
  assert.equal(result?.metadataJson?.lockTokenId, "110971");
  assert.equal(result?.metadataJson?.distributorAddress, "0x0000000000000000000000000000000000000005");
});

test("classifyGovernanceTransaction identifies RewardsDistributor.claim without legacy partial value effect", () => {
  const result = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[
      rewardsDistributor,
      {
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
      },
    ]]),
    tx: {
      hash: "0x3",
      from_address: walletAddress,
      to_address: rewardsDistributor,
      receipt_status: "1",
      input: encodeFunctionData({ abi: rewardsDistributorAbi, functionName: "claim", args: [113464n] }),
    },
  });

  assert.equal(result?.eventType, "governance_rebase_claim");
  assert.equal(result?.coverageStatus, "full");
  assert.deepEqual(result?.reasonCodes, []);
  assert.equal(result?.metadataJson?.lockTokenId, "113464");
});

test("classifyGovernanceTransaction does not override failed RewardsDistributor claims", () => {
  const result = classifyGovernanceTransaction({
    walletAddress,
    registry: new Map([[
      rewardsDistributor,
      {
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
      },
    ]]),
    tx: {
      hash: "0x4",
      from_address: walletAddress,
      to_address: rewardsDistributor,
      receipt_status: "0",
      input: encodeFunctionData({ abi: rewardsDistributorAbi, functionName: "claim", args: [113464n] }),
    },
  });

  assert.equal(result, null);
});

