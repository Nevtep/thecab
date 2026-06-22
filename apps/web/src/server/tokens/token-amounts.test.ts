import assert from "node:assert/strict";
import test from "node:test";

import { formatRawTokenAmount } from "@/server/tokens/token-amounts";

test("formatRawTokenAmount formats common ERC20 decimal scales deterministically", () => {
  assert.equal(formatRawTokenAmount({ amountRaw: "123456789", tokenDecimals: 6 }), "123.456789");
  assert.equal(formatRawTokenAmount({ amountRaw: "123456789", tokenDecimals: 8 }), "1.23456789");
  assert.equal(formatRawTokenAmount({ amountRaw: "14171535420739919393", tokenDecimals: 18 }), "14.171535420739919393");
});

test("formatRawTokenAmount preserves ERC721 token ids and rejects unknown ERC20 decimals", () => {
  assert.equal(formatRawTokenAmount({ amountRaw: "71663333", tokenDecimals: 0, assetType: "erc721" }), "71663333");
  assert.equal(formatRawTokenAmount({ amountRaw: "1000", tokenDecimals: null }), null);
  assert.equal(formatRawTokenAmount({ amountRaw: "not-a-number", tokenDecimals: 18 }), null);
});

