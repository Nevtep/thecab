import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  deposits,
  performanceSnapshots,
  poolMetricsSnapshots,
  pools,
  portfolioSnapshots,
  rewardEvents,
  strategyExposures,
} from "@/server/db/schema";

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

function* iterateUtcDays(startDayUtc: string, endDayUtc: string) {
  const current = new Date(`${startDayUtc}T00:00:00.000Z`);
  const end = new Date(`${endDayUtc}T00:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    yield current.toISOString().slice(0, 10);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

export async function computeSnapshots(input: {
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
  poolTotals: Array<{ poolId: string; valueUsd: number }>;
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const [depositRows, exposureRows, rewardRows, poolRows] = await Promise.all([
    db
      .select({ id: deposits.id, metadataJson: deposits.metadataJson, coverageStatus: deposits.coverageStatus })
      .from(deposits)
      .where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, input.chainId))),
    db
      .select({
        id: strategyExposures.id,
        strategyId: strategyExposures.strategyId,
        metadataJson: strategyExposures.metadataJson,
        coverageStatus: strategyExposures.coverageStatus,
      })
      .from(strategyExposures)
      .where(and(eq(strategyExposures.walletAddress, walletAddress), eq(strategyExposures.chainId, input.chainId))),
    db
      .select({
        amountUsd: rewardEvents.amountUsd,
        occurredAt: rewardEvents.occurredAt,
        accrualSnapshotDayUtc: rewardEvents.accrualSnapshotDayUtc,
        isAccrualSnapshot: rewardEvents.isAccrualSnapshot,
      })
      .from(rewardEvents)
      .where(
        and(
          eq(rewardEvents.walletAddress, walletAddress),
          eq(rewardEvents.chainId, input.chainId),
          lte(rewardEvents.occurredAt, input.capturedAt),
          gte(rewardEvents.occurredAt, new Date(`${input.startDayUtc}T00:00:00.000Z`)),
        ),
      ),
    input.poolTotals.length === 0
      ? Promise.resolve([])
      : db
        .select({ id: pools.id })
        .from(pools)
        .where(inArray(pools.id, input.poolTotals.map((pool) => pool.poolId))),
  ]);

  const depositValueUsd = depositRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const strategyValueUsd = exposureRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const rewardValueByDay = new Map<string, number>();

  for (const row of rewardRows) {
    const dayUtc = row.isAccrualSnapshot && row.accrualSnapshotDayUtc
      ? row.accrualSnapshotDayUtc
      : row.occurredAt.toISOString().slice(0, 10);
    rewardValueByDay.set(dayUtc, (rewardValueByDay.get(dayUtc) ?? 0) + (asNumber(row.amountUsd) ?? 0));
  }

  const dayRows = Array.from(iterateUtcDays(input.startDayUtc, input.endDayUtc));
  const performanceRows = dayRows.flatMap((dayUtc) => {
    const dayRewardValueUsd = rewardValueByDay.get(dayUtc) ?? 0;
    const deployedValueUsd = depositValueUsd + strategyValueUsd;
    const totalValueUsd = deployedValueUsd;

    return [
      {
        chainId: input.chainId,
        walletAddress,
        scope: "portfolio",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: deployedValueUsd > 0 ? "full" : "unknown",
        valueUsd: String(totalValueUsd),
        metadataJson: {
          depositValueUsd,
          strategyValueUsd,
          rewardValueUsd: dayRewardValueUsd,
          snapshotKind: "analysis_engine_daily",
        },
      },
      {
        chainId: input.chainId,
        walletAddress,
        scope: "rewards",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: "full",
        valueUsd: String(dayRewardValueUsd),
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
        },
      },
      ...depositRows.map((row) => ({
        chainId: input.chainId,
        walletAddress,
        scope: "deposit",
        scopeRefId: row.id,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: row.coverageStatus,
        valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
        metadataJson: {
          ...row.metadataJson,
          snapshotKind: "analysis_engine_daily",
        },
      })),
      ...exposureRows.map((row) => ({
        chainId: input.chainId,
        walletAddress,
        scope: "strategy",
        scopeRefId: row.strategyId,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: row.coverageStatus,
        valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
        metadataJson: {
          ...row.metadataJson,
          snapshotKind: "analysis_engine_daily",
        },
      })),
      ...input.poolTotals.map((poolTotal) => ({
        chainId: input.chainId,
        walletAddress,
        scope: "pool",
        scopeRefId: poolTotal.poolId,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: "full",
        valueUsd: String(poolTotal.valueUsd),
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
        },
      })),
    ];
  });

  await db
    .delete(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.chainId, input.chainId),
        eq(performanceSnapshots.walletAddress, walletAddress),
        eq(performanceSnapshots.resolution, "daily"),
        gte(performanceSnapshots.dayUtc, input.startDayUtc),
        lte(performanceSnapshots.dayUtc, input.endDayUtc),
      ),
    );

  if (performanceRows.length > 0) {
    await db.insert(performanceSnapshots).values(performanceRows);
  }

  for (const dayUtc of dayRows) {
    const capturedAt = dayUtc === input.endDayUtc ? input.capturedAt : new Date(`${dayUtc}T00:00:00.000Z`);
    const totalValueUsd = depositValueUsd + strategyValueUsd;

    await db
      .insert(portfolioSnapshots)
      .values({
        chainId: input.chainId,
        walletAddress,
        capturedAt,
        totalValueUsd: String(totalValueUsd),
        deployedValueUsd: String(totalValueUsd),
        idleValueUsd: "0",
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
          dayUtc,
          rewardValueUsd: rewardValueByDay.get(dayUtc) ?? 0,
        },
      })
      .onConflictDoUpdate({
        target: [portfolioSnapshots.chainId, portfolioSnapshots.walletAddress, portfolioSnapshots.capturedAt],
        set: {
          totalValueUsd: String(totalValueUsd),
          deployedValueUsd: String(totalValueUsd),
          idleValueUsd: "0",
          metadataJson: {
            snapshotKind: "analysis_engine_daily",
            dayUtc,
            rewardValueUsd: rewardValueByDay.get(dayUtc) ?? 0,
          },
        },
      });
  }

  for (const dayUtc of dayRows) {
    for (const poolTotal of input.poolTotals) {
      await db
        .insert(poolMetricsSnapshots)
        .values({
          chainId: input.chainId,
          poolId: poolTotal.poolId,
          dayUtc,
          tvlUsd: String(poolTotal.valueUsd),
          metadataJson: {
            source: "analysis_engine_daily",
          },
        })
        .onConflictDoUpdate({
          target: [poolMetricsSnapshots.chainId, poolMetricsSnapshots.poolId, poolMetricsSnapshots.dayUtc],
          set: {
            tvlUsd: String(poolTotal.valueUsd),
            metadataJson: {
              source: "analysis_engine_daily",
            },
          },
        });
    }
  }

  return {
    startDayUtc: input.startDayUtc,
    endDayUtc: input.endDayUtc,
    dayCount: dayRows.length,
    totalValueUsd: depositValueUsd + strategyValueUsd,
    rewardDayCount: rewardValueByDay.size,
    poolCount: poolRows.length,
  };
}