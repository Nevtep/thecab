import { ENGINE_V2_VERSION } from "@/server/analysis/engine-v2/types";
import { engineV2ClassificationTraces } from "@/server/db/schema";

import type { EngineV2Classification } from "./base-classifiers";

export function toClassificationTraceValues(input: {
  canonicalTransactionId: string;
  chainId: number;
  txHash: string;
  classification: EngineV2Classification;
  matchedRule?: string;
}) {
  return {
    canonicalTransactionId: input.canonicalTransactionId,
    chainId: input.chainId,
    txHash: input.txHash.toLowerCase(),
    classifierVersion: ENGINE_V2_VERSION,
    matchedRule: input.matchedRule ?? input.classification.eventType,
    coverageStatus: input.classification.coverageStatus,
    confidence: input.classification.confidence,
    reasonCodes: input.classification.reasonCodes,
    evidenceJson: input.classification.evidence,
  } satisfies typeof engineV2ClassificationTraces.$inferInsert;
}

export async function persistClassificationTrace(input: {
  db: { insert(table: unknown): { values(value: unknown): { onConflictDoNothing?(): Promise<unknown> } | Promise<unknown> } };
  canonicalTransactionId: string;
  chainId: number;
  txHash: string;
  classification: EngineV2Classification;
  matchedRule?: string;
}) {
  const result = input.db.insert(engineV2ClassificationTraces).values(toClassificationTraceValues(input));
  if ("onConflictDoNothing" in result && typeof result.onConflictDoNothing === "function") {
    await result.onConflictDoNothing();
    return;
  }

  await result;
}
