import { runCanonicalHistoryRegression } from "./canonical-history-regression";
import { runClassificationRegression } from "./classification-regression";
import { runEnrichmentRegression } from "./enrichment-regression";
import { runReadModelRegression } from "./read-model-regression";

export function runEngineV2Regression(input: {
  fixtureDirectory: string;
  walletAddress?: string;
}) {
  const canonicalHistory = runCanonicalHistoryRegression(input.fixtureDirectory);
  const classification = runClassificationRegression(input);
  const enrichment = runEnrichmentRegression();
  const readModels = runReadModelRegression();

  return {
    ok: true,
    canonicalHistory,
    classification,
    enrichment,
    readModels,
  };
}
