import { task, tasks } from "@trigger.dev/sdk/v3";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { persistEnrichmentNeeds, type EngineV2EnrichmentNeedInput } from "@/server/analysis/engine-v2/enrichment";
import { engineV2EnrichmentBatchPayloadSchema, engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";

export type EngineV2EnrichmentDeps = {
  planNeeds?: (input: { chainId: number; walletAddress: string }) => Promise<EngineV2EnrichmentNeedInput[]>;
  persistNeeds?: typeof persistEnrichmentNeeds;
  loadQueuedNeeds?: (input: { chainId: number; walletAddress: string; needTypes?: string[]; limit: number }) => Promise<EngineV2EnrichmentNeedInput[]>;
  resolveNeed?: (need: EngineV2EnrichmentNeedInput) => Promise<"resolved" | "unresolved" | "failed">;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
};

export async function runEngineV2PlanEnrichment(rawPayload: unknown, deps: EngineV2EnrichmentDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_enrichment",
      progressPct: 66,
    });
  }
  const needs = await (deps.planNeeds?.(payload) ?? Promise.resolve([]));
  const result = await (deps.persistNeeds ?? persistEnrichmentNeeds)({
    db: getDb(),
    needs,
  });
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-run-enrichment-batch", payload, {
    idempotencyKey: `engine-v2-run-enrichment:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

  return result;
}

export async function runEngineV2RunEnrichmentBatch(rawPayload: unknown, deps: EngineV2EnrichmentDeps = {}) {
  const payload = engineV2EnrichmentBatchPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_enrichment",
      progressPct: 74,
    });
  }
  const needs = await (deps.loadQueuedNeeds?.({
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    needTypes: payload.needTypes,
    limit: payload.limit,
  }) ?? Promise.resolve([]));
  const boundedNeeds = needs.slice(0, payload.limit);
  const results = [];
  for (const need of boundedNeeds) {
    results.push(await (deps.resolveNeed?.(need) ?? Promise.resolve("unresolved")));
  }

  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-account-chronological", payload, {
    idempotencyKey: `engine-v2-account:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

  return {
    attemptedCount: boundedNeeds.length,
    resolvedCount: results.filter((result) => result === "resolved").length,
    unresolvedCount: results.filter((result) => result === "unresolved").length,
    failedCount: results.filter((result) => result === "failed").length,
  };
}

export const engineV2PlanEnrichmentTask = task({
  id: "engine-v2-plan-enrichment",
  run: async (payload: unknown) => runEngineV2PlanEnrichment(payload),
});

export const engineV2RunEnrichmentBatchTask = task({
  id: "engine-v2-run-enrichment-batch",
  run: async (payload: unknown) => runEngineV2RunEnrichmentBatch(payload),
});
