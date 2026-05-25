import { createHash } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";

export function buildRawProviderRequestHash(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  requestJson: Record<string, unknown>;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      provider: input.provider,
      endpoint: input.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress?.toLowerCase() ?? null,
      requestJson: input.requestJson,
    }))
    .digest("hex");
}

export async function insertRawProviderRecord(input: {
  runId?: string | null;
  sliceId?: string | null;
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  requestJson?: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  confidence?: string;
}) {
  const requestJson = input.requestJson ?? {};
  const db = getDb();
  const [row] = await db
    .insert(rawProviderRecords)
    .values({
      runId: input.runId ?? null,
      sliceId: input.sliceId ?? null,
      provider: input.provider,
      endpoint: input.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress?.toLowerCase() ?? null,
      requestHash: buildRawProviderRequestHash({
        provider: input.provider,
        endpoint: input.endpoint,
        chainId: input.chainId,
        walletAddress: input.walletAddress,
        requestJson,
      }),
      requestJson,
      responseJson: input.responseJson ?? {},
      confidence: input.confidence ?? "high",
    })
    .returning();

  return row;
}

export async function readLatestRawProviderRecord(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  requestJson?: Record<string, unknown>;
}) {
  const db = getDb();
  const walletPredicate = input.walletAddress
    ? eq(rawProviderRecords.walletAddress, input.walletAddress.toLowerCase())
    : isNull(rawProviderRecords.walletAddress);
  const requestHash = buildRawProviderRequestHash({
    provider: input.provider,
    endpoint: input.endpoint,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    requestJson: input.requestJson ?? {},
  });
  const rows = await db
    .select()
    .from(rawProviderRecords)
    .where(
      and(
        eq(rawProviderRecords.provider, input.provider),
        eq(rawProviderRecords.endpoint, input.endpoint),
        eq(rawProviderRecords.chainId, input.chainId),
        walletPredicate,
        eq(rawProviderRecords.requestHash, requestHash),
      ),
    )
    .orderBy(desc(rawProviderRecords.fetchedAt), desc(rawProviderRecords.createdAt))
    .limit(1);

  return rows[0] ?? null;
}