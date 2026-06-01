import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalInternalTransactionValues,
  canonicalLogValues,
  toCanonicalTransactionValues,
} from "@/server/analysis/engine-v2/canonicalization";

test("toCanonicalTransactionValues preserves raw transaction evidence", () => {
  const values = toCanonicalTransactionValues({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    sourceEndpoint: "/verbose",
    transaction: {
      hash: "0xABC",
      block_number: "123",
      block_timestamp: "2026-01-01T00:00:00.000Z",
      transaction_index: "7",
      from_address: "0x0000000000000000000000000000000000000001",
      to_address: "0x0000000000000000000000000000000000000002",
      value: "10",
      input: "0x12345678",
      receipt_status: "1",
    },
  });

  assert.equal(values.txHash, "0xabc");
  assert.equal(values.blockNumber, "123");
  assert.equal(values.transactionIndex, 7);
  assert.equal(values.valueNativeRaw, "10");
  assert.equal(values.input, "0x12345678");
});

test("canonical evidence extracts logs and internal transactions", () => {
  const transaction = {
    hash: "0xabc",
    logs: [{ log_index: "5", address: "0x0000000000000000000000000000000000000002", topic0: "0xtopic" }],
    internal_transactions: [{ type: "CALL", from: "0x0000000000000000000000000000000000000001", to: "0x0000000000000000000000000000000000000002", value: "1" }],
  };

  assert.equal(canonicalLogValues(transaction)[0]?.logIndex, 5);
  assert.equal(canonicalInternalTransactionValues(transaction)[0]?.traceIndex, 0);
});
