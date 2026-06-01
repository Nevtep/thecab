import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";

import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";

import { classifyStrategyTransaction } from "./strategy-classifier";

const walletAddress = "0x0000000000000000000000000000000000000001";
const wrapper = "0x0000000000000000000000000000000000000002";
const abi = [{
  type: "function",
  name: "mint",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
}] as const;

test("classifyStrategyTransaction keeps Mellow wrapper activity out of manual deposits", () => {
  const entry: AbiRegistryEntry = {
    chainId: 8453,
    address: wrapper,
    label: "Mellow Strategy Wrapper",
    protocol: "mellow",
    expectedKind: "strategy-wrapper",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    sources: { basescanApi: "", basescanCode: "" },
    source: {
      contractName: "LpWrapper",
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
  const result = classifyStrategyTransaction({
    walletAddress,
    registry: new Map([[wrapper, entry]]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: wrapper,
      receipt_status: "1",
      input: encodeFunctionData({ abi, functionName: "mint" }),
    },
  });

  assert.equal(result?.eventType, "strategy_deposit");
  assert.equal(result?.evidence.manualDepositExcluded, true);
});

