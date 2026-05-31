import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDIDATE_SCHEMA_VERSION,
  classifySupplementalExplorerEvidence,
  detectEconomicExclusionReason,
  isHistoryRecordEconomicallyExcluded,
} from "@/server/analysis/txClassification";

test("CANDIDATE_SCHEMA_VERSION is a positive integer", () => {
  assert.equal(typeof CANDIDATE_SCHEMA_VERSION, "number");
  assert.ok(CANDIDATE_SCHEMA_VERSION >= 1);
  assert.equal(Math.floor(CANDIDATE_SCHEMA_VERSION), CANDIDATE_SCHEMA_VERSION);
});

test("detectEconomicExclusionReason flags records tagged as airdrop via category", () => {
  assert.equal(detectEconomicExclusionReason({ category: "airdrop" }), "airdrop_spam");
  assert.equal(detectEconomicExclusionReason({ category: "Airdrop" }), "airdrop_spam");
});

test("detectEconomicExclusionReason flags records tagged as airdrop via method_label", () => {
  assert.equal(
    detectEconomicExclusionReason({ category: "token receive", method_label: "Airdrop" }),
    "airdrop_spam",
  );
});

test("detectEconomicExclusionReason returns null for legitimate reward-shaped records", () => {
  assert.equal(
    detectEconomicExclusionReason({
      category: "token receive",
      method_label: "getReward",
      summary: "Received 7,392.30 AERO from gauge",
    }),
    null,
  );
});

test("detectEconomicExclusionReason returns null for non-string fields", () => {
  assert.equal(detectEconomicExclusionReason({}), null);
  assert.equal(detectEconomicExclusionReason({ category: null, method_label: undefined }), null);
});

test("isHistoryRecordEconomicallyExcluded mirrors detectEconomicExclusionReason", () => {
  assert.equal(isHistoryRecordEconomicallyExcluded({ category: "airdrop" }), true);
  assert.equal(isHistoryRecordEconomicallyExcluded({ category: "token receive" }), false);
});

test("classifySupplementalExplorerEvidence records evidence without inferring ownership", () => {
  const result = classifySupplementalExplorerEvidence({
    receipt: { status: "0x1", logs: [{ address: "0xpool" }] },
    logs: [{ address: "0xpool" }],
    internalTransfers: [{ from: "0xrouter", to: "0xpool" }],
    evidenceGapReasonCodes: [],
  });

  assert.equal(result.supplementalEvidenceUsed, true);
  assert.deepEqual(result.evidenceUsedReasonCodes, [
    "explorerReceipt",
    "explorerLogs",
    "explorerInternalTransfers",
  ]);
  assert.deepEqual(result.conflictReasonCodes, []);
});

test("classifySupplementalExplorerEvidence surfaces missing and conflicting explorer evidence", () => {
  assert.deepEqual(
    classifySupplementalExplorerEvidence(null).evidenceGapReasonCodes,
    ["missingExplorerEvidence"],
  );

  const reverted = classifySupplementalExplorerEvidence({
    receipt: { status: "0x0" },
    logs: [],
    internalTransfers: [],
  });

  assert.equal(reverted.supplementalEvidenceUsed, true);
  assert.ok(reverted.conflictReasonCodes.includes("revertedTransaction"));
});
