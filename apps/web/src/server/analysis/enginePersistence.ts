import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  assetMovements,
  deposits,
  ledgerEvents,
  performanceSnapshots,
  poolMetricsSnapshots,
  pools,
  portfolioSnapshots,
  rewardEvents,
  strategies,
  strategyExposures,
} from "@/server/db/schema";
import { insertProcessedTxs, listProcessedTxs } from "@/server/analysis/processed-tx.repository";
import { insertRawProviderRecord } from "@/server/providers/raw-provider-records.repository";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type ManualPositionArtifacts = {
  positions: Array<{
    tokenId: string;
    poolAddress: string | null;
    token0Address: string;
    token1Address: string;
    tickSpacing: number;
    tickLower: number;
    tickUpper: number;
    liquidity: string;
    currentTick: number | null;
    valueUsd: number | null;
  }>;
} | null;

type MellowWrapperArtifacts = {
  wrappers: Array<{
    wrapperAddress: string;
    strategyLabel: string;
    tokenId: string | null;
    feeTierLabel: string | null;
    shareBalanceRaw: string;
    token0Address: string;
    token1Address: string;
    token0AmountRaw: string;
    token1AmountRaw: string;
    valueUsd: number | null;
  }>;
} | null;

type RawProviderSnapshot = {
  provider: string;
  endpoint: string;
  requestJson: Record<string, unknown>;
  responseJson: Record<string, unknown>;
};

export type SliceHistoryRecord = Record<string, unknown>;

type SliceWindow = {
  sliceStartUtc: Date;
  sliceEndUtc: Date;
};

export function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumericString(value: number | string | null | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseHistoryTimestamp(record: SliceHistoryRecord) {
  const raw = asString(record.block_timestamp) ?? asString(record.block_time);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractHistoryHash(record: SliceHistoryRecord) {
  return (asString(record.transaction_hash) ?? asString(record.hash))?.toLowerCase() ?? null;
}

function extractHistoryTransferAmountRaw(record: Record<string, unknown>) {
  return (
    asString(record.value) ??
    asString(record.amount) ??
    toNumericString(asNumber(record.amount_raw)) ??
    toNumericString(asNumber(record.value_decimal))
  );
}

function extractHistoryTransferTokenAddress(record: Record<string, unknown>) {
  return (
    asString(record.token_address) ??
    asString(record.contract_address) ??
    asString(record.address) ??
    (record.native_transfer === true ? "0x0000000000000000000000000000000000000000" : null)
  )?.toLowerCase() ?? null;
}

function extractHistoryTransferAmountUsd(record: Record<string, unknown>) {
  return asNumber(record.value_usd) ?? asNumber(record.usd_value) ?? asNumber(record.amount_usd);
}

function buildAssetMovementRows(input: {
  walletAddress: string;
  chainId: number;
  ledgerEventId: string;
  historyRecord: SliceHistoryRecord;
}) {
  const walletAddress = input.walletAddress.toLowerCase();
  const transfers = [
    ...asRecordArray(input.historyRecord.erc20_transfers).map((record) => ({ record, source: "erc20" as const })),
    ...asRecordArray(input.historyRecord.native_transfers).map((record) => ({ record, source: "native" as const })),
  ];

  return transfers.flatMap(({ record, source }, index) => {
    const tokenAddress = extractHistoryTransferTokenAddress(record);
    const amountRaw = extractHistoryTransferAmountRaw(record);
    const toAddress = asString(record.to_address)?.toLowerCase() ?? null;
    const fromAddress = asString(record.from_address)?.toLowerCase() ?? null;

    if (!tokenAddress || !amountRaw || (toAddress !== walletAddress && fromAddress !== walletAddress)) {
      return [];
    }

    return [{
      chainId: input.chainId,
      ledgerEventId: input.ledgerEventId,
      movementIndex: index,
      walletAddress,
      tokenAddress,
      directionIn: toAddress === walletAddress,
      amountRaw,
      amountUsd: extractHistoryTransferAmountUsd(record)?.toString() ?? null,
      metadataJson: {
        source,
        symbol: asString(record.token_symbol) ?? asString(record.symbol),
        name: asString(record.token_name) ?? asString(record.name),
        fromAddress,
        toAddress,
      },
    }];
  });
}

function isWithinSlice(date: Date | null, window: SliceWindow) {
  if (!date) {
    return false;
  }

  return date >= window.sliceStartUtc && date < window.sliceEndUtc;
}

function isRewardLikeRecord(record: SliceHistoryRecord) {
  const fields = [
    asString(record.category),
    asString(record.method_label),
    asString(record.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return fields.includes("reward") || fields.includes("claim") || fields.includes("collect");
}

async function upsertPool(input: {
  chainId: number;
  poolAddress: string;
  label: string;
  token0Address?: string | null;
  token1Address?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const db = getDb();
  const [row] = await db
    .insert(pools)
    .values({
      chainId: input.chainId,
      poolAddress: input.poolAddress.toLowerCase(),
      label: input.label,
      token0Address: input.token0Address?.toLowerCase() ?? null,
      token1Address: input.token1Address?.toLowerCase() ?? null,
      metadataJson: input.metadataJson ?? {},
    })
    .onConflictDoUpdate({
      target: [pools.chainId, pools.poolAddress],
      set: {
        label: input.label,
        token0Address: input.token0Address?.toLowerCase() ?? null,
        token1Address: input.token1Address?.toLowerCase() ?? null,
        metadataJson: input.metadataJson ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function persistRawProviderSnapshots(input: {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
  records: RawProviderSnapshot[];
}) {
  if (input.records.length === 0) {
    return [];
  }

  return Promise.all(input.records.map((record) =>
    insertRawProviderRecord({
      runId: input.runId,
      sliceId: input.sliceId,
      provider: record.provider,
      endpoint: record.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      requestJson: record.requestJson,
      responseJson: record.responseJson,
      confidence: "medium",
    }),
  ));
}

export async function persistProtocolPositions(input: {
  walletAddress: string;
  chainId: number;
  positions: OverviewProtocolPosition[];
  manualArtifacts?: ManualPositionArtifacts;
  mellowArtifacts?: MellowWrapperArtifacts;
}) {
  const db = getDb();
  const manualByTokenId = new Map((input.manualArtifacts?.positions ?? []).map((item) => [item.tokenId, item] as const));
  const mellowByWrapper = new Map(
    (input.mellowArtifacts?.wrappers ?? []).map((item) => [item.wrapperAddress.toLowerCase(), item] as const),
  );
  const poolTotals = new Map<string, { poolId: string; valueUsd: number }>();
  const depositIds: string[] = [];
  const strategyIds: string[] = [];

  for (const position of input.positions) {
    if (position.family === "manual_deposit" && position.tokenId && position.metadata.positionContractAddress) {
      const manual = manualByTokenId.get(position.tokenId);
      let poolId: string | null = null;

      if (manual?.poolAddress) {
        const pool = await upsertPool({
          chainId: input.chainId,
          poolAddress: manual.poolAddress,
          label: position.poolLabel ?? position.label,
          token0Address: manual.token0Address,
          token1Address: manual.token1Address,
          metadataJson: {
            protocol: position.protocol,
            feeTierLabel: position.metadata.feeTierLabel,
          },
        });
        poolId = pool.id;

        const currentTotal = poolTotals.get(poolId)?.valueUsd ?? 0;
        poolTotals.set(poolId, {
          poolId,
          valueUsd: currentTotal + (position.valueUsd ?? 0),
        });
      }

      const [deposit] = await db
        .insert(deposits)
        .values({
          chainId: input.chainId,
          walletAddress: input.walletAddress.toLowerCase(),
          poolId,
          positionManagerAddress: position.metadata.positionContractAddress.toLowerCase(),
          tokenId: position.tokenId,
          status: "open",
          coverageStatus: position.coverageStatus,
          metadataJson: {
            label: position.label,
            protocol: position.protocol,
            poolLabel: position.poolLabel,
            valueUsd: position.valueUsd,
            valueUpdatedAt: position.valueUpdatedAt,
            primaryTokenSymbol: position.primaryTokenSymbol,
            secondaryTokenSymbol: position.secondaryTokenSymbol,
            primaryTokenAmount: position.primaryTokenAmount,
            secondaryTokenAmount: position.secondaryTokenAmount,
            metadata: position.metadata,
          },
        })
        .onConflictDoUpdate({
          target: [deposits.chainId, deposits.positionManagerAddress, deposits.tokenId],
          targetWhere: sql`${deposits.tokenId} is not null and ${deposits.positionManagerAddress} is not null`,
          set: {
            poolId,
            status: "open",
            coverageStatus: position.coverageStatus,
            metadataJson: {
              label: position.label,
              protocol: position.protocol,
              poolLabel: position.poolLabel,
              valueUsd: position.valueUsd,
              valueUpdatedAt: position.valueUpdatedAt,
              primaryTokenSymbol: position.primaryTokenSymbol,
              secondaryTokenSymbol: position.secondaryTokenSymbol,
              primaryTokenAmount: position.primaryTokenAmount,
              secondaryTokenAmount: position.secondaryTokenAmount,
              metadata: position.metadata,
            },
            updatedAt: new Date(),
          },
        })
        .returning();

      depositIds.push(deposit.id);
      continue;
    }

    if (position.family === "strategy_exposure" && position.metadata.wrapperAddress) {
      const wrapperAddress = position.metadata.wrapperAddress.toLowerCase();
      const wrapper = mellowByWrapper.get(wrapperAddress);
      const [strategy] = await db
        .insert(strategies)
        .values({
          chainId: input.chainId,
          label: position.strategyLabel ?? position.label,
          protocol: position.protocol,
          wrapperAddress,
          coverageStatus: position.coverageStatus,
          metadataJson: {
            label: position.label,
            poolLabel: position.poolLabel,
            valueUsd: position.valueUsd,
            valueUpdatedAt: position.valueUpdatedAt,
            metadata: position.metadata,
          },
        })
        .onConflictDoUpdate({
          target: [strategies.chainId, strategies.wrapperAddress],
          targetWhere: sql`${strategies.wrapperAddress} is not null`,
          set: {
            label: position.strategyLabel ?? position.label,
            coverageStatus: position.coverageStatus,
            metadataJson: {
              label: position.label,
              poolLabel: position.poolLabel,
              valueUsd: position.valueUsd,
              valueUpdatedAt: position.valueUpdatedAt,
              metadata: position.metadata,
            },
            updatedAt: new Date(),
          },
        })
        .returning();

      strategyIds.push(strategy.id);

      await db
        .insert(strategyExposures)
        .values({
          chainId: input.chainId,
          strategyId: strategy.id,
          walletAddress: input.walletAddress.toLowerCase(),
          wrapperAddress,
          sharesRaw: toNumericString(wrapper?.shareBalanceRaw) ?? "0",
          underlying0AmountRaw: toNumericString(wrapper?.token0AmountRaw),
          underlying1AmountRaw: toNumericString(wrapper?.token1AmountRaw),
          coverageStatus: position.coverageStatus,
          metadataJson: {
            label: position.label,
            strategyLabel: position.strategyLabel,
            poolLabel: position.poolLabel,
            valueUsd: position.valueUsd,
            valueUpdatedAt: position.valueUpdatedAt,
            token0Address: wrapper?.token0Address?.toLowerCase() ?? null,
            token1Address: wrapper?.token1Address?.toLowerCase() ?? null,
            metadata: position.metadata,
          },
        })
        .onConflictDoUpdate({
          target: [
            strategyExposures.chainId,
            strategyExposures.strategyId,
            strategyExposures.walletAddress,
            strategyExposures.wrapperAddress,
          ],
          set: {
            sharesRaw: toNumericString(wrapper?.shareBalanceRaw) ?? "0",
            underlying0AmountRaw: toNumericString(wrapper?.token0AmountRaw),
            underlying1AmountRaw: toNumericString(wrapper?.token1AmountRaw),
            coverageStatus: position.coverageStatus,
            metadataJson: {
              label: position.label,
              strategyLabel: position.strategyLabel,
              poolLabel: position.poolLabel,
              valueUsd: position.valueUsd,
              valueUpdatedAt: position.valueUpdatedAt,
              token0Address: wrapper?.token0Address?.toLowerCase() ?? null,
              token1Address: wrapper?.token1Address?.toLowerCase() ?? null,
              metadata: position.metadata,
            },
            updatedAt: new Date(),
          },
        });
    }
  }

  return {
    depositIds,
    strategyIds,
    poolTotals: Array.from(poolTotals.values()),
  };
}

export async function persistSliceHistory(input: {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  history: SliceHistoryRecord[];
  forceReprocessTxHashes?: string[];
}) {
  const recordsInWindow = input.history.filter((record) =>
    isWithinSlice(parseHistoryTimestamp(record), {
      sliceStartUtc: input.sliceStartUtc,
      sliceEndUtc: input.sliceEndUtc,
    }) && Boolean(extractHistoryHash(record)),
  );

  const txHashes = recordsInWindow
    .map((record) => extractHistoryHash(record))
    .filter((value): value is string => Boolean(value));
  const forceReprocessTxHashes = new Set((input.forceReprocessTxHashes ?? []).map((txHash) => txHash.toLowerCase()));
  const seen = new Set((await listProcessedTxs({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    txHashes,
  }))
    .map((row) => row.txHash.toLowerCase())
    .filter((txHash) => !forceReprocessTxHashes.has(txHash)));

  const unseen = recordsInWindow.filter((record) => {
    const txHash = extractHistoryHash(record);
    return txHash ? !seen.has(txHash) : false;
  });

  const dedupedUnseen = Array.from(
    new Map(
      unseen.map((record) => [extractHistoryHash(record) as string, record] as const),
    ).values(),
  );

  const db = getDb();
  let assetMovementCount = 0;
  if (dedupedUnseen.length > 0) {
    const insertedLedgerEvents = await db
      .insert(ledgerEvents)
      .values(
        dedupedUnseen.map((record) => ({
          chainId: input.chainId,
          txHash: extractHistoryHash(record) as string,
          logIndex: 0,
          eventType: "wallet_activity",
          walletAddress: input.walletAddress.toLowerCase(),
          occurredAt: parseHistoryTimestamp(record) ?? input.sliceEndUtc,
          confidence: "medium",
          metadataJson: {
            runId: input.runId,
            sliceId: input.sliceId,
            category: asString(record.category),
            methodLabel: asString(record.method_label),
            summary: asString(record.summary),
            fromAddress: asString(record.from_address)?.toLowerCase() ?? null,
            toAddress: asString(record.to_address)?.toLowerCase() ?? null,
            blockNumber: asString(record.block_number) ?? asString(record.blockNumber),
            blockTimestamp:
              asString(record.block_timestamp) ?? asString(record.block_time),
          },
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
      });

    const ledgerEventIdByHash = new Map(insertedLedgerEvents.map((row) => [row.txHash.toLowerCase(), row.id] as const));
    const assetMovementRows = dedupedUnseen.flatMap((record) => {
      const txHash = extractHistoryHash(record);
      const ledgerEventId = txHash ? ledgerEventIdByHash.get(txHash) : null;
      if (!ledgerEventId) {
        return [];
      }

      return buildAssetMovementRows({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        ledgerEventId,
        historyRecord: record,
      });
    });

    if (assetMovementRows.length > 0) {
      await db.insert(assetMovements).values(assetMovementRows).onConflictDoNothing();
      assetMovementCount = assetMovementRows.length;
    }

    await insertProcessedTxs(
      dedupedUnseen.map((record) => ({
        chainId: input.chainId,
        txHash: extractHistoryHash(record) as string,
        walletAddress: input.walletAddress,
        blockNumber: asString(record.block_number) ?? "0",
        firstRunId: input.runId,
        firstSliceId: input.sliceId,
      })),
    );
  }

  return {
    txCountSeen: recordsInWindow.length,
    txCountProcessed: dedupedUnseen.length,
    assetMovementCount,
    rewardCandidates: dedupedUnseen.filter(isRewardLikeRecord).map((record) => ({
      txHash: extractHistoryHash(record) as string,
      occurredAt: parseHistoryTimestamp(record) ?? input.sliceEndUtc,
      category: asString(record.category),
      summary: asString(record.summary),
    })),
  };
}

export async function classifyRunLedgerEvents(input: {
  walletAddress: string;
  chainId: number;
  txHashes: string[];
  runId: string;
}) {
  if (input.txHashes.length === 0) {
    return 0;
  }

  const db = getDb();
  const rows = await db
    .select({
      id: ledgerEvents.id,
      metadataJson: ledgerEvents.metadataJson,
    })
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.walletAddress, input.walletAddress.toLowerCase()),
        eq(ledgerEvents.chainId, input.chainId),
        inArray(ledgerEvents.txHash, input.txHashes.map((txHash) => txHash.toLowerCase())),
      ),
    );

  let updated = 0;
  for (const row of rows) {
    const text = [
      asString(row.metadataJson.category),
      asString(row.metadataJson.methodLabel),
      asString(row.metadataJson.summary),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const classification = text.includes("reward") || text.includes("claim") || text.includes("collect")
      ? "claim"
      : text.includes("swap") && (text.includes("deposit") || text.includes("mint"))
        ? "rebalance_deposit"
        : text.includes("swap") && (text.includes("withdraw") || text.includes("burn") || text.includes("decrease"))
          ? "rebalance_withdraw"
          : (text.includes("mellow") || text.includes("strategy")) && (text.includes("withdraw") || text.includes("unstake") || text.includes("burn"))
            ? "strategy_withdraw"
            : (text.includes("mellow") || text.includes("strategy")) && (text.includes("deposit") || text.includes("stake") || text.includes("mint"))
              ? "strategy_deposit"
              : text.includes("withdraw") || text.includes("unstake") || text.includes("burn") || text.includes("decrease")
                ? "manual_withdrawal"
                : text.includes("deposit") || text.includes("stake") || text.includes("mint") || text.includes("increase")
                  ? "manual_deposit"
                  : "other";

    await db
      .update(ledgerEvents)
      .set({
        classification,
        classificationRunId: input.runId,
      })
      .where(eq(ledgerEvents.id, row.id));
    updated += 1;
  }

  return updated;
}

export async function persistRewardCandidates(input: {
  walletAddress: string;
  chainId: number;
  rewardCandidates: Array<{
    txHash: string;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
  }>;
}) {
  if (input.rewardCandidates.length === 0) {
    return 0;
  }

  const db = getDb();
  await db
    .insert(rewardEvents)
    .values(
      input.rewardCandidates.map((candidate) => ({
        chainId: input.chainId,
        walletAddress: input.walletAddress.toLowerCase(),
        txHash: candidate.txHash.toLowerCase(),
        logIndex: 0,
        rewardType: candidate.category?.toLowerCase().includes("reward") ? "reward_claim" : "claim",
        occurredAt: candidate.occurredAt,
        metadataJson: {
          category: candidate.category,
          summary: candidate.summary,
        },
      })),
    )
    .onConflictDoNothing();

  return input.rewardCandidates.length;
}

function toUtcDayBucket(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSyntheticRewardSnapshotTxHash(input: {
  chainId: number;
  walletAddress: string;
  depositOrStrategyId: string;
  dayUtc: string;
  rewardType: string;
}) {
  const hash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 64);

  return `0x${hash}`;
}

export async function persistResolvedRewardEvents(input: {
  walletAddress: string;
  chainId: number;
  sliceEndUtc: Date;
  claims: Array<{
    txHash: string;
    logIndex: number;
    rewardType: string;
    depositOrStrategyId: string | null;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
    protocol: string | null;
    targetType: "deposit" | "strategy" | null;
    targetTokenId?: string | null;
    targetWrapperAddress?: string | null;
  }>;
  accrualSnapshots: Array<{
    depositOrStrategyId: string;
    rewardType: string;
    protocol: string | null;
    targetType: "deposit" | "strategy";
    targetTokenId?: string | null;
    targetWrapperAddress?: string | null;
  }>;
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const accrualSnapshotDayUtc = toUtcDayBucket(new Date(input.sliceEndUtc.getTime() - 24 * 60 * 60 * 1000));

  if (input.claims.length > 0) {
    await db
      .insert(rewardEvents)
      .values(
        input.claims.map((claim) => ({
          chainId: input.chainId,
          walletAddress,
          txHash: claim.txHash.toLowerCase(),
          logIndex: claim.logIndex,
          rewardType: claim.rewardType,
          depositOrStrategyId: claim.depositOrStrategyId,
          occurredAt: claim.occurredAt,
          metadataJson: {
            category: claim.category,
            summary: claim.summary,
            protocol: claim.protocol,
            targetType: claim.targetType,
            targetTokenId: claim.targetTokenId ?? null,
            targetWrapperAddress: claim.targetWrapperAddress ?? null,
            valuationMethod: "event",
          },
        })),
      )
      .onConflictDoUpdate({
        target: [rewardEvents.chainId, rewardEvents.txHash, rewardEvents.logIndex, rewardEvents.rewardType],
        set: {
          depositOrStrategyId: input.claims[0]?.depositOrStrategyId ?? null,
          occurredAt: input.claims[0]?.occurredAt ?? new Date(),
          metadataJson: {
            valuationMethod: "event",
          },
        },
      });
  }

  if (input.accrualSnapshots.length > 0) {
    await db
      .insert(rewardEvents)
      .values(
        input.accrualSnapshots.map((snapshot, index) => ({
          chainId: input.chainId,
          walletAddress,
          txHash: buildSyntheticRewardSnapshotTxHash({
            chainId: input.chainId,
            walletAddress,
            depositOrStrategyId: snapshot.depositOrStrategyId,
            dayUtc: accrualSnapshotDayUtc,
            rewardType: snapshot.rewardType,
          }),
          logIndex: index,
          rewardType: snapshot.rewardType,
          depositOrStrategyId: snapshot.depositOrStrategyId,
          occurredAt: input.sliceEndUtc,
          accrualSnapshotDayUtc,
          isAccrualSnapshot: true,
          metadataJson: {
            protocol: snapshot.protocol,
            targetType: snapshot.targetType,
            targetTokenId: snapshot.targetTokenId ?? null,
            targetWrapperAddress: snapshot.targetWrapperAddress ?? null,
            valuationMethod: "extrapolated",
          },
        })),
      )
      .onConflictDoUpdate({
        target: [rewardEvents.chainId, rewardEvents.txHash, rewardEvents.logIndex, rewardEvents.rewardType],
        set: {
          occurredAt: input.sliceEndUtc,
          accrualSnapshotDayUtc,
          isAccrualSnapshot: true,
          metadataJson: {
            valuationMethod: "extrapolated",
          },
        },
      });
  }

  return {
    claimCount: input.claims.length,
    accrualSnapshotCount: input.accrualSnapshots.length,
    accrualSnapshotDayUtc,
  };
}

export async function persistCurrentSnapshots(input: {
  walletAddress: string;
  chainId: number;
  dayUtc: string;
  capturedAt: Date;
}) {
  const db = getDb();
  const [depositRows, exposureRows] = await Promise.all([
    db
      .select({ id: deposits.id, metadataJson: deposits.metadataJson, coverageStatus: deposits.coverageStatus })
      .from(deposits)
      .where(
        and(
          eq(deposits.walletAddress, input.walletAddress.toLowerCase()),
          eq(deposits.chainId, input.chainId),
        ),
      ),
    db
      .select({
        id: strategyExposures.id,
        strategyId: strategyExposures.strategyId,
        metadataJson: strategyExposures.metadataJson,
        coverageStatus: strategyExposures.coverageStatus,
      })
      .from(strategyExposures)
      .where(
        and(
          eq(strategyExposures.walletAddress, input.walletAddress.toLowerCase()),
          eq(strategyExposures.chainId, input.chainId),
        ),
      ),
  ]);

  const depositValue = depositRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const strategyValue = exposureRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const totalValue = depositValue + strategyValue;

  await db
    .delete(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.chainId, input.chainId),
        eq(performanceSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(performanceSnapshots.dayUtc, input.dayUtc),
        eq(performanceSnapshots.resolution, "daily"),
      ),
    );

  await db.insert(performanceSnapshots).values([
    {
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "portfolio",
      scopeRefId: null,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: totalValue > 0 ? "full" : "unknown",
      valueUsd: String(totalValue),
      metadataJson: {
        depositValueUsd: depositValue,
        strategyValueUsd: strategyValue,
      },
    },
    ...depositRows.map((row) => ({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "deposit",
      scopeRefId: row.id,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: row.coverageStatus,
      valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
      metadataJson: row.metadataJson,
    })),
    ...exposureRows.map((row) => ({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "strategy",
      scopeRefId: row.strategyId,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: row.coverageStatus,
      valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
      metadataJson: row.metadataJson,
    })),
  ]);

  await db.insert(portfolioSnapshots).values({
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    capturedAt: input.capturedAt,
    totalValueUsd: String(totalValue),
    deployedValueUsd: String(totalValue),
    idleValueUsd: "0",
    metadataJson: {
      depositValueUsd: depositValue,
      strategyValueUsd: strategyValue,
      scope: "analysis_engine",
      dayUtc: input.dayUtc,
    },
  });

  return {
    totalValueUsd: totalValue,
    depositValueUsd: depositValue,
    strategyValueUsd: strategyValue,
  };
}

export async function persistPoolSnapshots(input: {
  chainId: number;
  dayUtc: string;
  poolTotals: Array<{ poolId: string; valueUsd: number }>;
}) {
  if (input.poolTotals.length === 0) {
    return 0;
  }

  const db = getDb();
  for (const poolTotal of input.poolTotals) {
    await db
      .delete(poolMetricsSnapshots)
      .where(
        and(
          eq(poolMetricsSnapshots.chainId, input.chainId),
          eq(poolMetricsSnapshots.poolId, poolTotal.poolId),
          eq(poolMetricsSnapshots.dayUtc, input.dayUtc),
        ),
      );

    await db.insert(poolMetricsSnapshots).values({
      chainId: input.chainId,
      poolId: poolTotal.poolId,
      dayUtc: input.dayUtc,
      tvlUsd: String(poolTotal.valueUsd),
      metadataJson: {
        source: "analysis_engine",
      },
    });
  }

  return input.poolTotals.length;
}