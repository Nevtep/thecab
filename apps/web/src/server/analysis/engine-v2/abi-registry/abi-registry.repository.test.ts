import assert from "node:assert/strict";
import test from "node:test";

import { ensureAbiForSeed } from "./abi-registry.repository";
import { protocolKnownAddressRowsForSeeds } from "./protocol-bootstrap";
import { selectorEventRowsFromAbi } from "./selector-event-index";

const transferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

test("selectorEventRowsFromAbi persists function selectors and event topics", () => {
  const rows = selectorEventRowsFromAbi({
    contractAbiId: "abi-1",
    chainId: 8453,
    address: "0x0000000000000000000000000000000000000001",
    abi: transferAbi,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.selectorOrTopic, "0xa9059cbb");
  assert.equal(rows[0]?.signature, "transfer(address,uint256)");
  assert.equal(rows[1]?.selectorOrTopic, "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
  assert.equal(rows[1]?.signature, "Transfer(address,address,uint256)");
});

test("protocolKnownAddressRowsForSeeds bootstraps protocol provenance without user pools", () => {
  const rows = protocolKnownAddressRowsForSeeds(8453);

  assert.ok(rows.some((row) => row.label === "Voter" && row.addressKind === "governance-voter"));
  assert.ok(rows.some((row) => row.address === "0x51e171d2fde9b37bbbb624a53ef54959422388e4" && row.addressKind === "protocol-grants"));
  assert.equal(rows.some((row) => row.addressKind === "pool"), false);
});

test("ensureAbiForSeed is DB-first and does not fetch on cache hit", async () => {
  let fetched = false;
  const result = await ensureAbiForSeed({
    chainId: 8453,
    apiKey: "unused",
    seed: {
      protocol: "aerodrome",
      label: "Cached",
      address: "0x0000000000000000000000000000000000000001",
      expectedKind: "observed-contract",
    },
    repository: {
      getContractAbi: async () => ({
        chainId: 8453,
        address: "0x0000000000000000000000000000000000000001",
        label: "Cached",
        protocol: "aerodrome",
        expectedKind: "observed-contract",
        fetchedAt: "2026-01-01T00:00:00.000Z",
        sources: { basescanApi: "", basescanCode: "" },
        source: {
          contractName: "Cached",
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
        abi: transferAbi,
        warnings: [],
      }),
      putFetchedAbi: async () => {
        fetched = true;
        return null;
      },
    },
    fetcher: async () => {
      fetched = true;
      throw new Error("should not fetch");
    },
  });

  assert.equal(result.status, "hit");
  assert.equal(fetched, false);
});
