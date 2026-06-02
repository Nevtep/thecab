import { and, eq, notInArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { engineV2ReadModelRows } from "@/server/db/schema";

import type { EngineV2ReadModelRowInput } from "./activity-materializer";

export function engineV2ReadModelsEnabled() {
  return true;
}

export function toReadModelRowValues(input: EngineV2ReadModelRowInput): typeof engineV2ReadModelRows.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    surface: input.surface,
    rowKey: input.rowKey,
    sourceDomainEventId: input.sourceDomainEventId ?? null,
    coverageStatus: input.coverageStatus,
    confidence: input.confidence,
    rowJson: input.rowJson,
    evidenceJson: input.evidenceJson,
  };
}

export type EngineV2ReadModelDb = {
  delete?(table: unknown): {
    where(condition: unknown): Promise<unknown>;
  };
  insert(table: unknown): {
    values(values: unknown[]): {
      onConflictDoUpdate(config: unknown): Promise<unknown>;
    };
  };
};

export async function persistReadModelRows(input: {
  db: EngineV2ReadModelDb;
  rows: EngineV2ReadModelRowInput[];
}) {
  if (input.rows.length === 0) return;

  if (typeof input.db.delete === "function") {
    const rowKeysBySurface = input.rows.reduce<Map<string, string[]>>((acc, row) => {
      const current = acc.get(row.surface) ?? [];
      current.push(row.rowKey);
      acc.set(row.surface, current);
      return acc;
    }, new Map());
    const chainId = input.rows[0]?.chainId ?? 0;
    const walletAddress = input.rows[0]?.walletAddress.toLowerCase() ?? "";

    for (const [surface, rowKeys] of rowKeysBySurface) {
      await input.db.delete(engineV2ReadModelRows).where(and(
        eq(engineV2ReadModelRows.chainId, chainId),
        eq(engineV2ReadModelRows.walletAddress, walletAddress),
        eq(engineV2ReadModelRows.surface, surface),
        notInArray(engineV2ReadModelRows.rowKey, rowKeys),
      ));
    }
  }

  await input.db.insert(engineV2ReadModelRows)
    .values(input.rows.map(toReadModelRowValues))
    .onConflictDoUpdate({
      target: [
        engineV2ReadModelRows.chainId,
        engineV2ReadModelRows.walletAddress,
        engineV2ReadModelRows.surface,
        engineV2ReadModelRows.rowKey,
      ],
      set: {
        sourceDomainEventId: sql`excluded.source_domain_event_id`,
        coverageStatus: sql`excluded.coverage_status`,
        confidence: sql`excluded.confidence`,
        rowJson: sql`excluded.row_json`,
        evidenceJson: sql`excluded.evidence_json`,
        materializedAt: sql`now()`,
      },
    });
}

export async function readEngineV2SurfaceRows<T>(input: {
  chainId: number;
  walletAddress: string;
  surface: string;
  enabled?: boolean;
}): Promise<T[] | null> {
  if (input.enabled !== true && !engineV2ReadModelsEnabled()) return null;
  const db = getDb();
  const rows = await db
    .select({ rowJson: engineV2ReadModelRows.rowJson })
    .from(engineV2ReadModelRows)
    .where(and(
      eq(engineV2ReadModelRows.chainId, input.chainId),
      eq(engineV2ReadModelRows.walletAddress, input.walletAddress.toLowerCase()),
      eq(engineV2ReadModelRows.surface, input.surface),
    ));
  if (rows.length === 0) return null;
  return rows.map((item) => item.rowJson as T);
}
