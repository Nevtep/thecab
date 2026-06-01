import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";

import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";

import { classifyManualDepositTransaction } from "./manual-deposit-classifier";

const walletAddress = "0x0000000000000000000000000000000000000001";
const manager = "0x0000000000000000000000000000000000000002";
const abi = [{
  type: "function",
  name: "mint",
  stateMutability: "payable",
  inputs: [],
  outputs: [],
}] as const;

test("classifyManualDepositTransaction requires explicit position-manager evidence", () => {
  const entry: AbiRegistryEntry = {
    chainId: 8453,
    address: manager,
    label: "NonfungiblePositionManager",
    protocol: "aerodrome",
    expectedKind: "position-manager",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    sources: { basescanApi: "", basescanCode: "" },
    source: {
      contractName: "NonfungiblePositionManager",
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
  const result = classifyManualDepositTransaction({
    walletAddress,
    registry: new Map([[manager, entry]]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: manager,
      receipt_status: "1",
      input: encodeFunctionData({ abi, functionName: "mint" }),
    },
  });

  assert.equal(result?.eventType, "manual_position_created");
  assert.equal(result?.evidence.governanceInternalLogGuard, true);
});

