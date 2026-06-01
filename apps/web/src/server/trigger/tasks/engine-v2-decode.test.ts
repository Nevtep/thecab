import assert from "node:assert/strict";
import test from "node:test";

import { ERC20_TRANSFER_TOPIC } from "@/server/analysis/decoded-history/constants";

import { runEngineV2EnsureAbiRegistry } from "./engine-v2-decode.task";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("runEngineV2EnsureAbiRegistry discovers ABI seeds from protocol log emitters and transfer token evidence", async () => {
  const ensuredSeeds: Array<{ address: string; sourceHint: string | null | undefined }> = [];

  const result = await runEngineV2EnsureAbiRegistry({
    chainId: 8453,
    walletAddress,
  }, {
    apiKey: "test-api-key",
    abiRegistryRepository: {
      getContractAbi: async () => null,
      putFetchedAbi: async () => null,
    },
    loadTransactions: async () => [{
      hash: "0x1",
      from_address: walletAddress,
      to_address: "0x00000000000000000000000000000000000000aa",
      receipt_status: "1",
      input: "0x",
      logs: [
        {
          address: "0x0000000000000000000000000000000000000010",
          topic0: "0x1111111111111111111111111111111111111111111111111111111111111111",
          decoded_event: {
            signature: "Swap(address,uint256,uint256)",
          },
        },
        {
          address: "0x0000000000000000000000000000000000000020",
          topic0: ERC20_TRANSFER_TOPIC,
          decoded_event: {
            signature: "Transfer(address,address,uint256)",
            params: [
              { name: "from", value: walletAddress },
              { name: "to", value: "0x0000000000000000000000000000000000000002" },
              { name: "value", value: "1" },
            ],
          },
        },
      ],
    }],
    loadRegistry: async () => new Map(),
    ensureAbi: async ({ seed }) => {
      ensuredSeeds.push({ address: String(seed.address).toLowerCase(), sourceHint: seed.sourceHint });
      return { status: "miss", reason: "test" };
    },
    trigger: async () => undefined,
  });

  assert.equal(result.abiSeedCount, 4);
  assert.equal(result.observedSeedCount, 2);
  assert.ok(ensuredSeeds.some((seed) => seed.address === "0x0000000000000000000000000000000000000010" && seed.sourceHint?.includes("Observed log emitter Swap(address,uint256,uint256)")));
  assert.ok(ensuredSeeds.some((seed) => seed.address === "0x0000000000000000000000000000000000000020" && seed.sourceHint === "Observed transfer token contract"));
});