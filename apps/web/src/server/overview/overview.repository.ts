import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  assetMovements,
  coverageReports,
  ledgerEvents,
  portfolioSnapshots,
  pricePoints,
  protocolContracts,
  rawProviderRecords,
  walletContexts,
} from "@/server/db/schema";
import type { OverviewRequest } from "@/server/overview/overview.types";

type ScopedWalletInput = Pick<OverviewRequest, "walletAddress" | "chainId">;

export async function readOverviewFreshness(input: ScopedWalletInput) {
  const db = getDb();
  const rows = await db
    .select()
    .from(walletContexts)
    .where(
      and(
        eq(walletContexts.walletAddress, input.walletAddress.toLowerCase()),
        eq(walletContexts.chainId, input.chainId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertOverviewFreshness(
  input: ScopedWalletInput & {
    lastAnalyzedAt?: Date | null;
    lastSuccessfulRunId?: string | null;
    metadataJson?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(walletContexts)
    .values({
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      lastAnalyzedAt: input.lastAnalyzedAt ?? null,
      lastSuccessfulRunId: input.lastSuccessfulRunId ?? null,
      metadataJson: input.metadataJson ?? {},
    })
    .onConflictDoUpdate({
      target: [walletContexts.chainId, walletContexts.walletAddress],
      set: {
        lastAnalyzedAt: input.lastAnalyzedAt ?? null,
        lastSuccessfulRunId: input.lastSuccessfulRunId ?? null,
        metadataJson: input.metadataJson ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function insertOverviewCoverageReport(
  input: ScopedWalletInput & {
    runId?: string | null;
    scope: string;
    status: string;
    confidence?: string;
    details?: string | null;
    metadataJson?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(coverageReports)
    .values({
      runId: input.runId ?? null,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: input.scope,
      status: input.status,
      confidence: input.confidence ?? "medium",
      details: input.details ?? null,
      metadataJson: input.metadataJson ?? {},
    })
    .returning();

  return row;
}

export async function insertOverviewRawProviderRecord(
  input: ScopedWalletInput & {
    runId?: string | null;
    provider: string;
    endpoint: string;
    requestJson?: Record<string, unknown>;
    responseJson?: Record<string, unknown>;
    confidence?: string;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(rawProviderRecords)
    .values({
      runId: input.runId ?? null,
      provider: input.provider,
      endpoint: input.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      requestJson: input.requestJson ?? {},
      responseJson: input.responseJson ?? {},
      confidence: input.confidence ?? "high",
    })
    .returning();

  return row;
}

export async function readLatestOverviewRawProviderRecord(input: ScopedWalletInput & {
  provider: string;
  endpoint: string;
  maxAgeMs?: number;
}) {
  const db = getDb();
  const filters = [
    eq(rawProviderRecords.walletAddress, input.walletAddress.toLowerCase()),
    eq(rawProviderRecords.chainId, input.chainId),
    eq(rawProviderRecords.provider, input.provider),
    eq(rawProviderRecords.endpoint, input.endpoint),
  ];

  if (typeof input.maxAgeMs === "number" && Number.isFinite(input.maxAgeMs) && input.maxAgeMs > 0) {
    filters.push(gte(rawProviderRecords.createdAt, new Date(Date.now() - input.maxAgeMs)));
  }

  const rows = await db
    .select()
    .from(rawProviderRecords)
    .where(and(...filters))
    .orderBy(desc(rawProviderRecords.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertOverviewPricePoint(
  input: ScopedWalletInput & {
    tokenAddress: string;
    pricedAt: Date;
    priceUsd: string;
    source?: string;
    resolution?: string;
    confidence?: string;
    metadataJson?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(pricePoints)
    .values({
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      pricedAt: input.pricedAt,
      source: input.source ?? "alchemy",
      resolution: input.resolution ?? "spot",
      confidence: input.confidence ?? "high",
      priceUsd: input.priceUsd,
      metadataJson: input.metadataJson ?? {},
    })
    .onConflictDoUpdate({
      target: [
        pricePoints.chainId,
        pricePoints.tokenAddress,
        pricePoints.pricedAt,
        pricePoints.source,
        pricePoints.resolution,
      ],
      set: {
        confidence: input.confidence ?? "high",
        priceUsd: input.priceUsd,
        metadataJson: input.metadataJson ?? {},
      },
    })
    .returning();

  return row;
}

export async function readLatestOverviewPricePoints(input: {
  chainId: number;
  tokenAddresses: string[];
}) {
  if (input.tokenAddresses.length === 0) {
    return [];
  }

  const db = getDb();
  const normalizedAddresses = Array.from(new Set(input.tokenAddresses.map((address) => address.toLowerCase())));
  const rows = await db
    .select({
      tokenAddress: pricePoints.tokenAddress,
      priceUsd: pricePoints.priceUsd,
      pricedAt: pricePoints.pricedAt,
      confidence: pricePoints.confidence,
    })
    .from(pricePoints)
    .where(
      and(
        eq(pricePoints.chainId, input.chainId),
        inArray(pricePoints.tokenAddress, normalizedAddresses),
      ),
    )
    .orderBy(desc(pricePoints.pricedAt));

  const latestRows = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestRows.has(row.tokenAddress)) {
      latestRows.set(row.tokenAddress, row);
    }
  }

  return Array.from(latestRows.values());
}

export async function readOverviewPricePointsInRange(input: {
  chainId: number;
  tokenAddresses: string[];
  startAt: Date;
  endAt: Date;
  resolution: string;
}) {
  if (input.tokenAddresses.length === 0) {
    return [];
  }

  const db = getDb();
  const normalizedAddresses = Array.from(new Set(input.tokenAddresses.map((address) => address.toLowerCase())));

  return db
    .select({
      tokenAddress: pricePoints.tokenAddress,
      pricedAt: pricePoints.pricedAt,
      priceUsd: pricePoints.priceUsd,
      confidence: pricePoints.confidence,
    })
    .from(pricePoints)
    .where(
      and(
        eq(pricePoints.chainId, input.chainId),
        inArray(pricePoints.tokenAddress, normalizedAddresses),
        gte(pricePoints.pricedAt, input.startAt),
        lte(pricePoints.pricedAt, input.endAt),
        eq(pricePoints.resolution, input.resolution),
      ),
    )
    .orderBy(desc(pricePoints.pricedAt));
}

export async function getLatestOverviewCoverageReport(input: ScopedWalletInput, scope = "overview") {
  const db = getDb();
  const rows = await db
    .select()
    .from(coverageReports)
    .where(
      and(
        eq(coverageReports.walletAddress, input.walletAddress.toLowerCase()),
        eq(coverageReports.chainId, input.chainId),
        eq(coverageReports.scope, scope),
      ),
    )
    .orderBy(desc(coverageReports.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function insertOverviewPortfolioSnapshot(
  input: ScopedWalletInput & {
    capturedAt: Date;
    totalValueUsd: string;
    deployedValueUsd?: string | null;
    idleValueUsd?: string | null;
    metadataJson?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [row] = await db
    .insert(portfolioSnapshots)
    .values({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      capturedAt: input.capturedAt,
      totalValueUsd: input.totalValueUsd,
      deployedValueUsd: input.deployedValueUsd ?? null,
      idleValueUsd: input.idleValueUsd ?? null,
      metadataJson: input.metadataJson ?? {},
    })
    .onConflictDoUpdate({
      target: [portfolioSnapshots.chainId, portfolioSnapshots.walletAddress, portfolioSnapshots.capturedAt],
      set: {
        totalValueUsd: input.totalValueUsd,
        deployedValueUsd: input.deployedValueUsd ?? null,
        idleValueUsd: input.idleValueUsd ?? null,
        metadataJson: input.metadataJson ?? {},
      },
    })
    .returning();

  return row;
}

export async function getLatestOverviewPortfolioSnapshot(input: ScopedWalletInput) {
  const db = getDb();
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(portfolioSnapshots.chainId, input.chainId),
      ),
    )
    .orderBy(desc(portfolioSnapshots.capturedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function readOverviewPortfolioSnapshots(input: ScopedWalletInput & {
  startAt: Date;
  endAt: Date;
}) {
  const db = getDb();

  return db
    .select({
      capturedAt: portfolioSnapshots.capturedAt,
      totalValueUsd: portfolioSnapshots.totalValueUsd,
      deployedValueUsd: portfolioSnapshots.deployedValueUsd,
      idleValueUsd: portfolioSnapshots.idleValueUsd,
      metadataJson: portfolioSnapshots.metadataJson,
    })
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(portfolioSnapshots.chainId, input.chainId),
        gte(portfolioSnapshots.capturedAt, input.startAt),
        lte(portfolioSnapshots.capturedAt, input.endAt),
      ),
    )
    .orderBy(portfolioSnapshots.capturedAt);
}

export async function readKnownProtocolContracts(input: Pick<OverviewRequest, "chainId">) {
  const db = getDb();
  return db
    .select({
      chainId: protocolContracts.chainId,
      address: protocolContracts.address,
      protocol: protocolContracts.protocol,
      contractType: protocolContracts.contractType,
      metadataJson: protocolContracts.metadataJson,
    })
    .from(protocolContracts)
    .where(eq(protocolContracts.chainId, input.chainId));
}

export async function readRecentOverviewAnalyzedActivity(input: ScopedWalletInput & {
  limit?: number;
}) {
  const db = getDb();
  const eventRows = await db
    .select({
      id: ledgerEvents.id,
      txHash: ledgerEvents.txHash,
      eventType: ledgerEvents.eventType,
      occurredAt: ledgerEvents.occurredAt,
      classification: ledgerEvents.classification,
      confidence: ledgerEvents.confidence,
      metadataJson: ledgerEvents.metadataJson,
    })
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.walletAddress, input.walletAddress.toLowerCase()),
        eq(ledgerEvents.chainId, input.chainId),
      ),
    )
    .orderBy(desc(ledgerEvents.occurredAt), desc(ledgerEvents.createdAt))
    .limit(input.limit ?? 10);

  if (eventRows.length === 0) {
    return [];
  }

  const movementRows = await db
    .select({
      ledgerEventId: assetMovements.ledgerEventId,
      directionIn: assetMovements.directionIn,
      amountUsd: assetMovements.amountUsd,
      metadataJson: assetMovements.metadataJson,
    })
    .from(assetMovements)
    .where(
      and(
        eq(assetMovements.chainId, input.chainId),
        inArray(assetMovements.ledgerEventId, eventRows.map((row) => row.id)),
      ),
    )
    .orderBy(assetMovements.ledgerEventId, assetMovements.movementIndex);

  const movementsByLedgerEventId = new Map<string, typeof movementRows>();
  for (const movement of movementRows) {
    const ledgerEventId = movement.ledgerEventId;
    if (!ledgerEventId) {
      continue;
    }

    const existingMovements = movementsByLedgerEventId.get(ledgerEventId);
    if (existingMovements) {
      existingMovements.push(movement);
      continue;
    }

    movementsByLedgerEventId.set(ledgerEventId, [movement]);
  }

  return eventRows.map((row) => ({
    ...row,
    movements: movementsByLedgerEventId.get(row.id) ?? [],
  }));
}