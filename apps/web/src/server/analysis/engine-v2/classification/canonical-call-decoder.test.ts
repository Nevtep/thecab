import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";

import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";

import { decodeCanonicalTransactionCalls } from "./canonical-call-decoder";

const target = "0x0000000000000000000000000000000000000002";
const abi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    type: "function",
    name: "batch",
    stateMutability: "nonpayable",
    inputs: [{ name: "targets", type: "address[]" }, { name: "data", type: "bytes[]" }],
    outputs: [],
  },
] as const;

function entry(): AbiRegistryEntry {
  return {
    chainId: 8453,
    address: target,
    label: "Test Contract",
    protocol: "test",
    expectedKind: "observed-contract",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    sources: { basescanApi: "", basescanCode: "" },
    source: {
      contractName: "Test",
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

test("decodeCanonicalTransactionCalls decodes direct calls", () => {
  const data = encodeFunctionData({ abi, functionName: "deposit", args: [1n] });
  const calls = decodeCanonicalTransactionCalls({
    tx: { hash: "0x1", to_address: target, input: data },
    registry: new Map([[target, entry()]]),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.functionName, "deposit");
  assert.equal(calls[0]?.decodeStatus, "decoded");
});

test("decodeCanonicalTransactionCalls expands multicall bytes children", () => {
  const child = encodeFunctionData({ abi, functionName: "deposit", args: [2n] });
  const data = encodeFunctionData({ abi, functionName: "multicall", args: [[child]] });
  const calls = decodeCanonicalTransactionCalls({
    tx: { hash: "0x1", to_address: target, input: data },
    registry: new Map([[target, entry()]]),
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.functionName, "multicall");
  assert.equal(calls[1]?.callPath, "0.0");
  assert.equal(calls[1]?.functionName, "deposit");
});

test("decodeCanonicalTransactionCalls decodes target-specific batch children with child ABI", () => {
  const childTarget = "0x0000000000000000000000000000000000000003";
  const child = encodeFunctionData({ abi, functionName: "deposit", args: [3n] });
  const data = encodeFunctionData({ abi, functionName: "batch", args: [[childTarget], [child]] });
  const calls = decodeCanonicalTransactionCalls({
    tx: { hash: "0x1", to_address: target, input: data },
    registry: new Map([[target, entry()], [childTarget, { ...entry(), address: childTarget }]]),
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.targetAddress, childTarget);
  assert.equal(calls[1]?.functionName, "deposit");
});
