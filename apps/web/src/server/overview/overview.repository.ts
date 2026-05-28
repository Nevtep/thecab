import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  approvalLinks,
  assetMovements,
  coverageReports,
  deposits,
  inferredActions,
  ledgerEvents,
  performanceSnapshots,
  portfolioSnapshots,
  pricePoints,
  protocolContracts,
  pools,
  rawProviderRecords,
  walletContexts,
} from "@/server/db/schema";
import type { OverviewRequest } from "@/server/overview/overview.types";

function normalizeAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? value.toLowerCase()
    : null;
}

type ScopedWalletInput = Pick<OverviewRequest, "walletAddress" | "chainId">;

function getSnapshotKind(metadataJson: Record<string, unknown> | null | undefined) {
  return typeof metadataJson?.snapshotKind === "string" ? metadataJson.snapshotKind : null;
}

function formatSnapshotUsd(value: number) {
  return value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function shouldExcludeLedgerEventFromOverviewUi(metadataJson: Record<string, unknown> | null | undefined) {
  return metadataJson?.excludeFromUiDefault === true;
}

export function shouldPreserveAnalyzedPortfolioSnapshot(input: {
  existingMetadataJson: Record<string, unknown> | null | undefined;
  nextMetadataJson: Record<string, unknown> | null | undefined;
}) {
  return getSnapshotKind(input.existingMetadataJson) === "analysis_engine_daily"
    && getSnapshotKind(input.nextMetadataJson) !== "analysis_engine_daily";
}

type AnalyzedPerformanceSnapshotRow = {
  capturedAt: Date;
  scope: string;
  valueUsd: string;
  metadataJson: Record<string, unknown>;
};

type MergedAnalyzedPerformanceSnapshotRow = {
  capturedAt: Date;
  totalValueUsd: string;
  deployedValueUsd: string | null;
  idleValueUsd: string | null;
  metadataJson: Record<string, unknown>;
};

export function mergeAnalyzedPerformanceSnapshotRows(
  rows: AnalyzedPerformanceSnapshotRow[],
): MergedAnalyzedPerformanceSnapshotRow[] {
  const rowsByCapturedAt = new Map<string, {
    capturedAt: Date;
    portfolio: AnalyzedPerformanceSnapshotRow | null;
    idle: AnalyzedPerformanceSnapshotRow | null;
  }>();

  for (const row of rows) {
    const key = row.capturedAt.toISOString();
    const existing = rowsByCapturedAt.get(key) ?? {
      capturedAt: row.capturedAt,
      portfolio: null,
      idle: null,
    };

    if (row.scope === "portfolio") {
      existing.portfolio = row;
    }

    if (row.scope === "idle") {
      existing.idle = row;
    }

    rowsByCapturedAt.set(key, existing);
  }

  const mergedRows: Array<MergedAnalyzedPerformanceSnapshotRow | null> = Array.from(rowsByCapturedAt.values())
    .map((row) => {
      const portfolioMetadata = row.portfolio?.metadataJson ?? {};
      const totalValueUsd = row.portfolio?.valueUsd ?? null;
      const idleValueUsd = row.idle?.valueUsd
        ?? (typeof portfolioMetadata.idleValueUsd === "number" || typeof portfolioMetadata.idleValueUsd === "string"
          ? String(portfolioMetadata.idleValueUsd)
          : null);
      const totalValue = totalValueUsd === null ? null : Number(totalValueUsd);
      const idleValue = idleValueUsd === null ? null : Number(idleValueUsd);
      const deployedValueUsd =
        totalValue !== null && idleValue !== null && Number.isFinite(totalValue) && Number.isFinite(idleValue)
          ? formatSnapshotUsd(totalValue - idleValue)
          : (() => {
              const depositValueUsd = portfolioMetadata.depositValueUsd;
              const strategyValueUsd = portfolioMetadata.strategyValueUsd;
              const hasDeployedValue =
                typeof depositValueUsd === "number" || typeof depositValueUsd === "string"
                || typeof strategyValueUsd === "number" || typeof strategyValueUsd === "string";

              return hasDeployedValue
                ? formatSnapshotUsd(Number(depositValueUsd ?? 0) + Number(strategyValueUsd ?? 0))
                : null;
            })();

      if (!row.portfolio || totalValueUsd === null) {
        return null;
      }

      return {
        capturedAt: row.capturedAt,
        totalValueUsd,
        deployedValueUsd,
        idleValueUsd,
        metadataJson: {
          ...portfolioMetadata,
          idleTokens: row.idle?.metadataJson.tokens ?? portfolioMetadata.idleTokens,
          snapshotKind: "analysis_engine_daily",
          source: "analyzed_history",
        },
      };
    });

  return mergedRows
    .filter((row): row is MergedAnalyzedPerformanceSnapshotRow => row !== null)
    .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());
}

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
  const [existingRow] = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(portfolioSnapshots.chainId, input.chainId),
        eq(portfolioSnapshots.capturedAt, input.capturedAt),
      ),
    )
    .limit(1);

  if (existingRow && shouldPreserveAnalyzedPortfolioSnapshot({
    existingMetadataJson: existingRow.metadataJson,
    nextMetadataJson: input.metadataJson ?? null,
  })) {
    return existingRow;
  }

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

export async function readOverviewAnalyzedPortfolioSnapshots(input: ScopedWalletInput & {
  startAt: Date;
  endAt: Date;
}) {
  const db = getDb();

  const rows = await db
    .select({
      capturedAt: performanceSnapshots.capturedAt,
      scope: performanceSnapshots.scope,
      valueUsd: performanceSnapshots.valueUsd,
      metadataJson: performanceSnapshots.metadataJson,
    })
    .from(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(performanceSnapshots.chainId, input.chainId),
        inArray(performanceSnapshots.scope, ["portfolio", "idle"]),
        eq(performanceSnapshots.resolution, "daily"),
        gte(performanceSnapshots.capturedAt, input.startAt),
        lte(performanceSnapshots.capturedAt, input.endAt),
      ),
    )
    .orderBy(desc(performanceSnapshots.capturedAt));

  return mergeAnalyzedPerformanceSnapshotRows(rows);
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

export async function readOverviewRealizedRewardEvents(input: ScopedWalletInput & {
  startAt: Date;
  endAt: Date;
}) {
  const db = getDb();

  const result = await db.execute<{
    occurredAt: Date;
    amountUsd: string | null;
    tokenAddress: string | null;
    rewardType: string;
    txHash: string;
  }>(sql`
    select
      re.occurred_at as "occurredAt",
      coalesce(
        re.amount_usd,
        bm.amount_usd,
        case
          when coalesce(re.token_address, bm.token_address) = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'
            and coalesce(re.amount_raw, bm.amount_raw) is not null
            and pp.price_usd is not null
          then (coalesce(re.amount_raw, bm.amount_raw)::numeric / 1000000000000000000::numeric) * pp.price_usd
          else null
        end
      )::text as "amountUsd",
      coalesce(re.token_address, bm.token_address) as "tokenAddress",
      re.reward_type as "rewardType",
      re.tx_hash as "txHash"
    from reward_events re
    left join lateral (
      select
        sum(
          coalesce(
            am.amount_usd,
            case
              when priced_movement.price_usd is null or am.amount_raw is null then null
              when am.token_address = '0x4200000000000000000000000000000000000006'
              then (am.amount_raw::numeric / 1000000000000000000::numeric) * priced_movement.price_usd
              when am.token_address = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'
              then (am.amount_raw::numeric / 1000000000000000000::numeric) * priced_movement.price_usd
              when am.token_address = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
              then (am.amount_raw::numeric / 1000000::numeric) * priced_movement.price_usd
              when am.token_address = '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'
              then (am.amount_raw::numeric / 100000000::numeric) * priced_movement.price_usd
              when am.token_address = '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
              then (am.amount_raw::numeric / 1000000::numeric) * priced_movement.price_usd
              else null
            end
          )
        ) as amount_usd,
        case when count(distinct am.token_address) = 1 then min(am.token_address) else null end as token_address,
        case when count(distinct am.token_address) = 1 then min(am.amount_raw) else null end as amount_raw
      from ledger_events le
      join asset_movements am on am.ledger_event_id = le.id
      left join lateral (
        select pp.price_usd
        from price_points pp
        where pp.chain_id = re.chain_id
          and pp.token_address = am.token_address
          and pp.priced_at <= re.occurred_at
        order by pp.priced_at desc
        limit 1
      ) priced_movement on true
      where le.chain_id = re.chain_id
        and le.tx_hash = re.tx_hash
        and am.wallet_address = re.wallet_address
        and am.direction_in = true
    ) bm on true
    left join lateral (
      select pp.price_usd
      from price_points pp
      where pp.chain_id = re.chain_id
        and pp.token_address = coalesce(re.token_address, bm.token_address)
        and pp.priced_at <= re.occurred_at
      order by pp.priced_at desc
      limit 1
    ) pp on true
    where re.wallet_address = ${input.walletAddress.toLowerCase()}
      and re.chain_id = ${input.chainId}
      and re.is_accrual_snapshot = false
      and re.occurred_at >= ${input.startAt}
      and re.occurred_at <= ${input.endAt}
      and not exists (
        select 1
        from ledger_events le_filtered
        where le_filtered.chain_id = re.chain_id
          and le_filtered.wallet_address = re.wallet_address
          and le_filtered.tx_hash = re.tx_hash
          and (
            le_filtered.classification = 'governance'
            or lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%voting escrow%'
            or lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%veaero%'
            or (
              lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%aerodrome%'
              and lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%escrow%'
            )
          )
      )
    order by re.occurred_at asc
  `);

  return result.rows.map((row) => ({
    ...row,
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt),
  }));
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
  startAt?: Date;
  endAt?: Date;
  limit?: number;
}) {
  const db = getDb();
  const filters = [
    eq(ledgerEvents.walletAddress, input.walletAddress.toLowerCase()),
    eq(ledgerEvents.chainId, input.chainId),
  ];

  if (input.startAt) {
    filters.push(gte(ledgerEvents.occurredAt, input.startAt));
  }

  if (input.endAt) {
    filters.push(lte(ledgerEvents.occurredAt, input.endAt));
  }

  const baseEventRowsQuery = db
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
    .where(and(...filters))
    .orderBy(desc(ledgerEvents.occurredAt), desc(ledgerEvents.createdAt));

  const queryLimit = typeof input.limit === "number" && Number.isFinite(input.limit) && input.limit > 0
    ? input.limit * 4
    : null;
  const rawEventRows = queryLimit !== null
    ? await baseEventRowsQuery.limit(queryLimit)
    : await baseEventRowsQuery;

  const eventRows = rawEventRows
    .filter((row) => !shouldExcludeLedgerEventFromOverviewUi(row.metadataJson))
    .slice(0, input.limit ?? rawEventRows.length);

  if (eventRows.length === 0) {
    return [];
  }

  const movementRows = await db
    .select({
      ledgerEventId: assetMovements.ledgerEventId,
      tokenAddress: assetMovements.tokenAddress,
      amountRaw: assetMovements.amountRaw,
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

  const depositRows = await db
    .select({
      mintTxHash: deposits.mintTxHash,
      tokenId: deposits.tokenId,
      metadataJson: deposits.metadataJson,
      poolLabel: pools.label,
    })
    .from(deposits)
    .leftJoin(pools, eq(deposits.poolId, pools.id))
    .where(
      and(
        eq(deposits.walletAddress, input.walletAddress.toLowerCase()),
        eq(deposits.chainId, input.chainId),
        inArray(deposits.mintTxHash, eventRows.map((row) => row.txHash)),
      ),
    );

  // Approval context is now persisted by the engine into `approval_links`
  // during canonical inference. Overview just reads it back; no RPC decoding
  // happens here.
  const approvalLinkRows = eventRows.length === 0
    ? []
    : await db
      .select({
        txHash: approvalLinks.txHash,
        tokenId: approvalLinks.tokenId,
        spenderAddress: approvalLinks.spenderAddress,
        spenderContractType: approvalLinks.spenderContractType,
        relatedPoolId: approvalLinks.relatedPoolId,
        poolLabel: pools.label,
      })
      .from(approvalLinks)
      .leftJoin(pools, eq(approvalLinks.relatedPoolId, pools.id))
      .where(
        and(
          eq(approvalLinks.walletAddress, input.walletAddress.toLowerCase()),
          eq(approvalLinks.chainId, input.chainId),
          inArray(
            approvalLinks.txHash,
            eventRows.map((row) => row.txHash.toLowerCase()),
          ),
        ),
      );

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

  const depositsByMintTxHash = new Map(
    depositRows
      .filter((row): row is typeof row & { mintTxHash: string } => typeof row.mintTxHash === "string" && row.mintTxHash.length > 0)
      .map((row) => [row.mintTxHash.toLowerCase(), row] as const),
  );
  const approvalContextByTxHash = new Map(
    approvalLinkRows.flatMap((row) => {
      if (!row.spenderContractType || !row.spenderContractType.toLowerCase().includes("gauge")) {
        return [];
      }
      return [[
        row.txHash.toLowerCase(),
        {
          tokenId: row.tokenId,
          spenderAddress: row.spenderAddress,
          spenderContractType: row.spenderContractType,
          protocol: "aerodrome",
          poolLabel: row.poolLabel,
        },
      ] as const];
    }),
  );

  // Inferred actions persisted by the engine drive rebalance labeling on the
  // Overview timeline. Each `rebalance_same_pool` action references the
  // deposit ledger event (`source_ledger_event_id`) and the upstream events
  // consumed by that deposit (`consuming_ledger_event_ids_json` — typically
  // the paired swap and the originating withdraw). Any ledger event in
  // either set is part of the rebalance flow and should display as such.
  const inferredActionRows = await db
    .select({
      actionType: inferredActions.actionType,
      primaryPoolId: inferredActions.primaryPoolId,
      sourceLedgerEventId: inferredActions.sourceLedgerEventId,
      consumingLedgerEventIdsJson: inferredActions.consumingLedgerEventIdsJson,
    })
    .from(inferredActions)
    .where(
      and(
        eq(inferredActions.walletAddress, input.walletAddress.toLowerCase()),
        eq(inferredActions.chainId, input.chainId),
        inArray(
          inferredActions.sourceLedgerEventId,
          eventRows.map((row) => row.id),
        ),
      ),
    );

  const rebalanceMembershipByLedgerEventId = new Map<string, { actionType: string; primaryPoolId: string | null }>();
  for (const action of inferredActionRows) {
    if (action.actionType !== "rebalance_same_pool") continue;
    const membership = { actionType: action.actionType, primaryPoolId: action.primaryPoolId };
    if (action.sourceLedgerEventId) {
      rebalanceMembershipByLedgerEventId.set(action.sourceLedgerEventId, membership);
    }
    for (const consumingId of action.consumingLedgerEventIdsJson ?? []) {
      rebalanceMembershipByLedgerEventId.set(consumingId, membership);
    }
  }

  return eventRows.map((row) => ({
    ...row,
    movements: movementsByLedgerEventId.get(row.id) ?? [],
    depositContext: (() => {
      const deposit = depositsByMintTxHash.get(row.txHash.toLowerCase());
      if (!deposit) {
        return null;
      }

      return {
        tokenId: deposit.tokenId,
        poolLabel: deposit.poolLabel ?? (typeof deposit.metadataJson.poolLabel === "string" ? deposit.metadataJson.poolLabel : null),
        protocol: typeof deposit.metadataJson.protocol === "string" ? deposit.metadataJson.protocol : null,
        primaryTokenSymbol:
          typeof deposit.metadataJson.primaryTokenSymbol === "string" ? deposit.metadataJson.primaryTokenSymbol : null,
        secondaryTokenSymbol:
          typeof deposit.metadataJson.secondaryTokenSymbol === "string" ? deposit.metadataJson.secondaryTokenSymbol : null,
      };
    })(),
    approvalContext: approvalContextByTxHash.get(row.txHash.toLowerCase()) ?? null,
    rebalanceMembership: rebalanceMembershipByLedgerEventId.get(row.id) ?? null,
  }));
}