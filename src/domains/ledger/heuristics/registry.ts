export type HeuristicDefinition = {
  key: string;
  description: string;
  version: string;
  appliesTo: string[];
};

export const CLASSIFIER_VERSION = "2026-04-19.1";
export const HEURISTICS_VERSION = "2026-04-19.1";

export const HEURISTICS_REGISTRY: readonly HeuristicDefinition[] = [
  {
    key: "base-confirmation-window",
    description: "Applies a deterministic finalized-block confirmation window for replay-safe ingestion.",
    version: HEURISTICS_VERSION,
    appliesTo: ["reconstruction_runs", "raw_observations"]
  },
  {
    key: "contract-allowlist-candidate-scope",
    description: "Restricts candidate transaction scope to known wallet, token transfer, and supported protocol surfaces.",
    version: HEURISTICS_VERSION,
    appliesTo: ["candidate_transaction_discovery"]
  }
];

export function getCurrentRulesetMetadata() {
  return {
    classifierVersion: CLASSIFIER_VERSION,
    heuristicsVersion: HEURISTICS_VERSION,
    heuristics: HEURISTICS_REGISTRY
  };
}