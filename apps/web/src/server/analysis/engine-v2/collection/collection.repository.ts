import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  engineV2CollectionRuns,
  engineV2ProviderPages,
} from "@/server/db/schema";

import type { EngineV2Db } from "../repositories/types";

export function hashProviderResponse(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function createProviderPageIdentity(input: {
  chainId: number;
  walletAddress: string;
  sourceProvider: string;
  sourceEndpoint: string;
  requestHash: string;
}) {
  return {
    ...input,
    walletAddress: input.walletAddress.toLowerCase(),
  };
}

export async function createCollectionRun(input: {
  db: EngineV2Db;
  analysisRunId?: string | null;
  chainId: number;
  walletAddress: string;
  sourceEndpoint: string;
  sourceQueryJson?: Record<string, unknown>;
}) {
  const [row] = await input.db
    .insert(engineV2CollectionRuns)
    .values({
      analysisRunId: input.analysisRunId ?? null,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      sourceEndpoint: input.sourceEndpoint,
      sourceQueryJson: input.sourceQueryJson ?? {},
      status: "running",
    })
    .returning();

  return row;
}

export async function upsertProviderPage(input: {
  db: EngineV2Db;
  collectionRunId: string;
  chainId: number;
  walletAddress: string;
  sourceProvider: string;
  sourceEndpoint: string;
  requestHash: string;
  cursorIn?: string | null;
  cursorOut?: string | null;
  pageIndex: number;
  rawJson: Record<string, unknown>;
}) {
  const responseHash = hashProviderResponse(input.rawJson);
  const [row] = await input.db
    .insert(engineV2ProviderPages)
    .values({
      collectionRunId: input.collectionRunId,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      sourceProvider: input.sourceProvider,
      sourceEndpoint: input.sourceEndpoint,
      requestHash: input.requestHash,
      responseHash,
      cursorIn: input.cursorIn ?? null,
      cursorOut: input.cursorOut ?? null,
      pageIndex: input.pageIndex,
      rawJson: input.rawJson,
    })
    .onConflictDoUpdate({
      target: [
        engineV2ProviderPages.chainId,
        engineV2ProviderPages.walletAddress,
        engineV2ProviderPages.sourceProvider,
        engineV2ProviderPages.requestHash,
      ],
      set: {
        responseHash,
        cursorOut: input.cursorOut ?? null,
        rawJson: input.rawJson,
        fetchedAt: sql`now()`,
      },
    })
    .returning();

  return row;
}

export async function markCollectionRunComplete(input: {
  db: EngineV2Db;
  collectionRunId: string;
  providerRowCount: number;
  distinctTxCount: number;
  duplicateTxCount: number;
  lastCursor?: string | null;
}) {
  const [row] = await input.db
    .update(engineV2CollectionRuns)
    .set({
      status: "complete",
      providerRowCount: input.providerRowCount,
      distinctTxCount: input.distinctTxCount,
      duplicateTxCount: input.duplicateTxCount,
      lastCursor: input.lastCursor ?? null,
      coverageStatus: "full",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(engineV2CollectionRuns.id, input.collectionRunId))
    .returning();

  return row;
}
