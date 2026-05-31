import assert from "node:assert/strict";
import test from "node:test";

process.env.MORALIS_API_KEY ??= "test-moralis-key";
process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
process.env.ANALYSIS_HISTORY_DAYS ??= "365";
process.env.ANALYSIS_SLICE_DAYS ??= "90";
process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";

import { buildSupplementalExplorerEvidenceMetadata } from "@/server/trigger/tasks/phase-activity.task";

test("buildSupplementalExplorerEvidenceMetadata preserves source refs and gap reasons", () => {
  const metadata = buildSupplementalExplorerEvidenceMetadata({
    chainId: 8453,
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    provider: "basescan",
    receipt: { status: "0x1", logs: [{ address: "0xpool" }] },
    logs: [{ address: "0xpool" }],
    internalTransfers: [],
    sourceRefs: [
      { provider: "basescan", endpoint: "eth_getTransactionReceipt", status: "complete" },
      { provider: "basescan", endpoint: "txlistinternal", status: "failed" },
    ],
    evidenceGapReasonCodes: ["missingExplorerInternalTransfers"],
  });

  assert.equal(metadata.receiptPresent, true);
  assert.equal(metadata.logCount, 1);
  assert.equal(metadata.internalTransferCount, 0);
  assert.deepEqual(metadata.evidenceGapReasonCodes, ["missingExplorerInternalTransfers"]);
});
