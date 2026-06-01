import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMoralisDecodedHistoryPath,
  buildMoralisDecodedHistoryQuery,
  hashMoralisDecodedHistoryRequest,
  parseMoralisDecodedHistoryPage,
} from "@/server/analysis/engine-v2/collection/moralis-history";

test("Moralis decoded history request uses verbose ASC internal transaction query", () => {
  assert.equal(
    buildMoralisDecodedHistoryPath("0x0000000000000000000000000000000000000001"),
    "/0x0000000000000000000000000000000000000001/verbose",
  );
  assert.deepEqual(
    buildMoralisDecodedHistoryQuery({
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      cursor: "next",
      fromBlock: "46571258",
    }),
    {
      order: "ASC",
      include: "internal_transactions",
      limit: 100,
      cursor: "next",
      from_block: "46571258",
    },
  );
});

test("parseMoralisDecodedHistoryPage extracts result rows and cursor", () => {
  const parsed = parseMoralisDecodedHistoryPage({
    cursor: "next",
    result: [{ hash: "0xabc" }],
  });

  assert.equal(parsed.cursor, "next");
  assert.equal(parsed.providerRowCount, 1);
  assert.equal(parsed.transactions[0]?.hash, "0xabc");
});

test("hashMoralisDecodedHistoryRequest is wallet-case insensitive", () => {
  const lower = hashMoralisDecodedHistoryRequest({
    chainId: 8453,
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
  });
  const mixed = hashMoralisDecodedHistoryRequest({
    chainId: 8453,
    walletAddress: "0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954",
  });

  assert.equal(lower, mixed);
});

test("hashMoralisDecodedHistoryRequest changes when fromBlock changes", () => {
  const older = hashMoralisDecodedHistoryRequest({
    chainId: 8453,
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
    fromBlock: "100",
  });
  const newer = hashMoralisDecodedHistoryRequest({
    chainId: 8453,
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
    fromBlock: "101",
  });

  assert.notEqual(older, newer);
});
