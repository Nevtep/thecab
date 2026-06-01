export {
  engineV2CollectDecodedHistoryPageTask,
  engineV2FinalizeCollectionTask,
  engineV2StartCollectionTask,
} from "./engine-v2-collection.task";
export { engineV2CanonicalizeHistoryTask } from "./engine-v2-canonicalize.task";
export {
  engineV2DecodeCanonicalCallsTask,
  engineV2EnsureAbiRegistryTask,
  engineV2ProtocolBootstrapTask,
} from "./engine-v2-decode.task";
export { engineV2ClassifyChronologicalTask } from "./engine-v2-classification.task";
export { engineV2PlanEnrichmentTask, engineV2RunEnrichmentBatchTask } from "./engine-v2-enrichment.task";
export { engineV2AccountChronologicalTask, engineV2MaterializeReadModelsTask } from "./engine-v2-materialization.task";

export const ENGINE_V2_TRIGGER_TASK_IDS = [
  "engine-v2-start-collection",
  "engine-v2-collect-decoded-history-page",
  "engine-v2-finalize-collection",
  "engine-v2-canonicalize-history",
  "engine-v2-protocol-bootstrap",
  "engine-v2-ensure-abi-registry",
  "engine-v2-decode-canonical-calls",
  "engine-v2-classify-chronological",
  "engine-v2-plan-enrichment",
  "engine-v2-run-enrichment-batch",
  "engine-v2-account-chronological",
  "engine-v2-materialize-read-models",
] as const;
