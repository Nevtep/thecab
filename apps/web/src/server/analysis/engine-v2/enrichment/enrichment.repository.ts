import { createHash } from "node:crypto";

import { engineV2EnrichmentNeeds } from "@/server/db/schema";

export type EngineV2EnrichmentNeedInput = {
  chainId: number;
  walletAddress: string;
  needType: string;
  priority?: number;
  sourceDomainEventId?: string | null;
  targetType: string;
  targetId: string;
  reasonCodes?: string[];
  requestJson?: Record<string, unknown>;
};

export function enrichmentNeedNaturalKey(input: EngineV2EnrichmentNeedInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      needType: input.needType,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCodes: [...(input.reasonCodes ?? [])].sort(),
    }))
    .digest("hex");
}

export function toEnrichmentNeedValues(input: EngineV2EnrichmentNeedInput): typeof engineV2EnrichmentNeeds.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    needType: input.needType,
    priority: input.priority ?? 100,
    sourceDomainEventId: input.sourceDomainEventId ?? null,
    naturalKey: enrichmentNeedNaturalKey(input),
    status: "queued",
    reasonCodes: input.reasonCodes ?? [],
    requestJson: {
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.requestJson ?? {}),
    },
  };
}

export async function persistEnrichmentNeeds(input: {
  db: { insert(table: unknown): { values(value: unknown): { onConflictDoNothing(): Promise<unknown> } } };
  needs: EngineV2EnrichmentNeedInput[];
}) {
  if (input.needs.length === 0) return { queuedCount: 0 };
  await input.db.insert(engineV2EnrichmentNeeds)
    .values(input.needs.map(toEnrichmentNeedValues))
    .onConflictDoNothing();

  return { queuedCount: input.needs.length };
}
