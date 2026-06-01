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
  assert.equal(result?.coverageStatus, "partial");
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

