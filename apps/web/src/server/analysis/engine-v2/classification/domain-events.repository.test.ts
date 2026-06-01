import assert from "node:assert/strict";
import test from "node:test";

import { toDomainEventLinkValues, toDomainEventValues } from "./domain-events.repository";

test("toDomainEventValues preserves parent-child event evidence", () => {
  const values = toDomainEventValues({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    canonicalTransactionId: "tx-id",
    canonicalCallId: "call-id",
    parentEventId: "parent-id",
    txHash: "0xabc",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    sequenceIndex: 1,
    classification: {
      eventType: "governance_fee_claim",
      eventFamily: "governance",
      coverageStatus: "partial",
      confidence: "high",
      reasonCodes: ["missing_distributor_pool_link"],
      evidence: { functionName: "claimFees" },
    },
  });

  assert.equal(values.parentEventId, "parent-id");
  assert.equal(values.eventType, "governance_fee_claim");
  assert.deepEqual(values.reasonCodes, ["missing_distributor_pool_link"]);
});

test("toDomainEventLinkValues stores explicit entity links", () => {
  const values = toDomainEventLinkValues({
    domainEventId: "event-id",
    chainId: 8453,
    entityType: "governance_lock",
    entityId: "8453:0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4:110971",
    evidenceJson: { source: "decoded_call_arg" },
  });

  assert.equal(values.linkKind, "explicit");
  assert.equal(values.confidence, "high");
});

