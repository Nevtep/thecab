import assert from "node:assert/strict";
import test from "node:test";

import { enrichmentNeedNaturalKey } from "./enrichment.repository";
import { planEnrichmentNeedsForClassification } from "./enrichment-planner";

test("planEnrichmentNeedsForClassification maps missing evidence to deduped needs", () => {
  const needs = planEnrichmentNeedsForClassification({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0xabc",
    classification: {
      eventType: "governance_fee_claim",
      eventFamily: "governance",
      coverageStatus: "partial",
      confidence: "high",
      reasonCodes: ["missing_distributor_pool_link", "missing_historical_price"],
      evidence: {},
    },
  });

  assert.deepEqual(needs.map((need) => need.needType).sort(), ["distributor_pool_link", "historical_price"]);
  assert.equal(enrichmentNeedNaturalKey(needs[0]!), enrichmentNeedNaturalKey({ ...needs[0]! }));
});

test("planEnrichmentNeedsForClassification targets explicit distributor addresses when governance metadata provides them", () => {
  const needs = planEnrichmentNeedsForClassification({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0xdef",
    classification: {
      eventType: "governance_fee_claim",
      eventFamily: "governance",
      coverageStatus: "partial",
      confidence: "high",
      reasonCodes: ["missing_distributor_pool_link"],
      evidence: {},
      metadataJson: {
        distributorAddress: "0x0000000000000000000000000000000000000002",
        distributorAddresses: ["0x0000000000000000000000000000000000000002"],
      },
    },
  });

  assert.equal(needs.length, 1);
  assert.equal(needs[0]?.targetType, "distributor");
  assert.equal(needs[0]?.targetId, "0x0000000000000000000000000000000000000002");
});

