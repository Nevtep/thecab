import assert from "node:assert/strict";
import test from "node:test";

import { toTokenMetadataValues } from "./token-metadata.worker";

test("toTokenMetadataValues preserves spam hints and token category", () => {
  const row = toTokenMetadataValues({
    chainId: 8453,
    metadata: {
      tokenAddress: "0x0000000000000000000000000000000000000001",
      symbol: "AERO",
      decimals: 18,
      category: "exchange",
      verified: true,
      possibleSpam: false,
      rawJson: { source: "fixture" },
    },
  });

  assert.equal(row.tokenAddress, "0x0000000000000000000000000000000000000001");
  assert.equal(row.possibleSpam, false);
  assert.equal(row.category, "exchange");
});

