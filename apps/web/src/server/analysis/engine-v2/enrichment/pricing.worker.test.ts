import assert from "node:assert/strict";
import test from "node:test";

import { compareProviderPrices, toPricePointValues } from "./pricing.worker";

test("toPricePointValues separates historical and unavailable prices", () => {
  const row = toPricePointValues({
    chainId: 8453,
    tokenAddress: "0x0000000000000000000000000000000000000001",
    blockNumber: "123",
    sourceProvider: "alchemy",
    resolution: "historical",
  });

  assert.equal(row.status, "unavailable");
  assert.equal(row.resolution, "historical");
});

test("compareProviderPrices surfaces provider divergence", () => {
  assert.deepEqual(compareProviderPrices({ primaryUsd: 100, validationUsd: 130, toleranceBps: 100 }), {
    status: "diverged",
    reasonCodes: ["provider_price_divergence"],
  });
});

