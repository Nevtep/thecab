import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderPageIdentity,
  hashProviderResponse,
} from "@/server/analysis/engine-v2/collection/collection.repository";
import { summarizeCanonicalTransactions } from "@/server/analysis/engine-v2/canonicalization/canonical-transactions";

test("createProviderPageIdentity lowercases wallet identity and preserves request hash", () => {
  assert.deepEqual(
    createProviderPageIdentity({
      chainId: 8453,
      walletAddress: "0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954",
      sourceProvider: "moralis",
      sourceEndpoint: "/verbose",
      requestHash: "abc",
    }),
    {
      chainId: 8453,
      walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
      sourceProvider: "moralis",
      sourceEndpoint: "/verbose",
      requestHash: "abc",
    },
  );
});

test("summarizeCanonicalTransactions reports provider rows and duplicates", () => {
  const summary = summarizeCanonicalTransactions([
    { hash: "0xabc" },
    { hash: "0xabc" },
    { hash: "0xdef" },
  ]);

  assert.deepEqual(summary, {
    providerRowCount: 3,
    distinctTxCount: 2,
    duplicateTxCount: 1,
  });
});

test("hashProviderResponse is deterministic for persisted raw evidence", () => {
  assert.equal(hashProviderResponse({ a: 1 }), hashProviderResponse({ a: 1 }));
});
