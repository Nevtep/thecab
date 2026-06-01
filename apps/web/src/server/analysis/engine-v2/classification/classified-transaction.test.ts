import assert from "node:assert/strict";
import test from "node:test";

import { toClassifiedTransactionValues } from "@/server/analysis/engine-v2/classification/classified-transaction";

const walletAddress = "0x0000000000000000000000000000000000000001" as const;

test("toClassifiedTransactionValues preserves the research snapshot fields for persistence", () => {
  const values = toClassifiedTransactionValues({
    canonicalTransactionId: "00000000-0000-4000-8000-000000000001",
    chainId: 8453,
    walletAddress,
    registry: new Map(),
    sequenceIndex: 7,
    tx: {
      hash: "0xabc",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      value: "1",
      block_timestamp: "2026-01-01T00:00:00.000Z",
      block_number: "123",
      transaction_index: "4",
      logs: [],
    },
  });

  assert.equal(values.chainId, 8453);
  assert.equal(values.walletAddress, walletAddress);
  assert.equal(values.txHash, "0xabc");
  assert.equal(values.sequenceIndex, 7);
  assert.equal(values.blockNumber, "123");
  assert.equal(values.transactionIndex, 4);
  assert.equal(values.selector, "0x");
  assert.equal(values.classification, "cash_in_native");
  assert.equal(values.confidence, "high");
  assert.equal(values.reason, "native transfer into wallet");
  assert.equal(values.needsResolution, false);
  assert.deepEqual(values.decodedArgsJson, []);
  assert.equal(values.transferCount, 0);
  assert.equal(values.inboundTransferCount, 0);
  assert.equal(values.outboundTransferCount, 0);
  assert.equal(values.approvalCount, 0);
});