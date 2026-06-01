import { planEnrichmentNeedsForClassification } from "@/server/analysis/engine-v2/enrichment";

export function runEnrichmentRegression() {
  const needs = planEnrichmentNeedsForClassification({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0xfixture",
    classification: {
      eventType: "governance_fee_claim",
      eventFamily: "governance",
      coverageStatus: "partial",
      confidence: "high",
      reasonCodes: ["missing_distributor_pool_link"],
      evidence: {},
    },
  });
  if (needs.length !== 1 || needs[0]?.needType !== "distributor_pool_link") {
    throw new Error("ENGINE_V2_ENRICHMENT_REGRESSION_FAILED");
  }

  return { plannedNeedCount: needs.length, needTypes: needs.map((need) => need.needType) };
}

