import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
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
  rewardEvents,
  walletContexts,
} from "@/server/db/schema";
import type { DepositDetailView } from "@/server/deposits/deposits.types";
import type { OverviewRequest } from "@/server/overview/overview.types";
import type { StrategyDetailView } from "@/server/strategies/strategies.types";
import { AERODROME_CL_POSITION_MANAGER_ADDRESS } from "@/server/protocol-positions/protocolMetadata";

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
  totalValueUsd: string | null;
  deployedValueUsd: string | null;
  idleValueUsd: string | null;
  metadataJson: Record<string, unknown>;
};

type CurrentOverviewIdleTokenInput = {
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  balanceFormatted: number;
  currentPriceUsd: number | null;
  decimals: number | null;
  possibleSpam: boolean | null;
  verifiedContract: boolean | null;
  isNativeAsset: boolean;
};

type CurrentOverviewDeployedTokenInput = {
  tokenAddress: string;
  amount: number;
};

type EngineV2PoolHistoryReadModelRow = {
  coveredStartDayUtc?: string | null;
  coveredEndDayUtc?: string | null;
  history?: {
    points?: unknown[];
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function iterateUtcDays(startDayUtc: string, endDayUtc: string) {
  const days: string[] = [];
  const cursor = new Date(`${startDayUtc}T00:00:00.000Z`);
  const end = new Date(`${endDayUtc}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function endOfDayUtc(dayUtc: string) {
  const date = new Date(`${dayUtc}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function dayUtcFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dividePow10(rawAmount: string, decimals: number) {
  if (!/^-?\d+$/.test(rawAmount)) {
    return 0;
  }

  const negative = rawAmount.startsWith("-");
  const digits = negative ? rawAmount.slice(1) : rawAmount;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals);
  const value = Number(`${whole}.${fraction}`);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return negative ? -value : value;
}

function buildDailyPriceSeriesByToken(input: {
  dayRows: string[];
  priceRows: Array<{ tokenAddress: string; priceUsd: string; pricedAt: Date }>;
  capturedAt: Date;
}) {
  const rowsByToken = new Map<string, Array<{ pricedAt: Date; priceUsd: number }>>();

  for (const row of input.priceRows) {
    const tokenAddress = row.tokenAddress.toLowerCase();
    const priceUsd = asNumber(row.priceUsd);
    if (priceUsd === null) {
      continue;
    }

    const bucket = rowsByToken.get(tokenAddress) ?? [];
    bucket.push({ pricedAt: row.pricedAt, priceUsd });
    rowsByToken.set(tokenAddress, bucket);
  }

  const latestPriceByToken = new Map<string, number>();
  const priceSeriesByToken = new Map<string, Map<string, number>>();

  for (const [tokenAddress, rows] of rowsByToken.entries()) {
    rows.sort((left, right) => left.pricedAt.getTime() - right.pricedAt.getTime());
    const latestRow = rows[rows.length - 1];
    if (latestRow) {
      latestPriceByToken.set(tokenAddress, latestRow.priceUsd);
    }

    const daySeries = new Map<string, number>();
    let lastSeenPrice: number | null = null;
    let cursor = 0;

    for (const dayUtc of input.dayRows) {
      const boundary = dayUtc === input.dayRows[input.dayRows.length - 1]
        ? input.capturedAt
        : endOfDayUtc(dayUtc);

      while (cursor < rows.length && rows[cursor].pricedAt.getTime() <= boundary.getTime()) {
        lastSeenPrice = rows[cursor].priceUsd;
        cursor += 1;
      }

      if (lastSeenPrice !== null) {
        daySeries.set(dayUtc, lastSeenPrice);
      }
    }

    priceSeriesByToken.set(tokenAddress, daySeries);
  }

  return { latestPriceByToken, priceSeriesByToken };
}

function resolveTokenPriceForDay(input: {
  tokenAddress: string;
  dayUtc: string;
  priceSeriesByToken: Map<string, Map<string, number>>;
  latestPriceByToken: Map<string, number>;
}) {
  return input.priceSeriesByToken.get(input.tokenAddress)?.get(input.dayUtc)
    ?? input.latestPriceByToken.get(input.tokenAddress)
    ?? null;
}

type OverviewDepositHistoryRow = Pick<DepositDetailView, "token0Address" | "token1Address" | "lifecycle">;
type OverviewStrategyHistoryRow = Pick<StrategyDetailView, "wrapperAddress" | "lifecycle">;

function mergeLiveOverviewSnapshotRows(input: {
  deployedRows: MergedAnalyzedPerformanceSnapshotRow[];
  idleRows: MergedAnalyzedPerformanceSnapshotRow[];
}) {
  const byDay = new Map<string, MergedAnalyzedPerformanceSnapshotRow>();

  for (const row of input.deployedRows) {
    byDay.set(dayUtcFromDate(row.capturedAt), { ...row, metadataJson: { ...(row.metadataJson ?? {}) } });
  }

  for (const row of input.idleRows) {
    const dayUtc = dayUtcFromDate(row.capturedAt);
    const existing = byDay.get(dayUtc);
    if (!existing) {
      byDay.set(dayUtc, {
        ...row,
        totalValueUsd: row.idleValueUsd,
        metadataJson: { ...(row.metadataJson ?? {}) },
      });
      continue;
    }

    const deployedValueUsd = asNumber(existing.deployedValueUsd);
    const idleValueUsd = asNumber(row.idleValueUsd);
    const mergedTotalValueUsd =
      deployedValueUsd === null && idleValueUsd === null
        ? asNumber(existing.totalValueUsd)
        : (deployedValueUsd ?? 0) + (idleValueUsd ?? 0);

    byDay.set(dayUtc, {
      capturedAt: existing.capturedAt,
      deployedValueUsd: existing.deployedValueUsd,
      idleValueUsd: row.idleValueUsd,
      totalValueUsd: mergedTotalValueUsd === null ? existing.totalValueUsd : formatSnapshotUsd(mergedTotalValueUsd),
      metadataJson: {
        ...(existing.metadataJson ?? {}),
        ...(row.metadataJson ?? {}),
      },
    });
  }

  return Array.from(byDay.values()).sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());
}

async function readOverviewIdleSnapshotsFromCurrentTokens(input: ScopedWalletInput & {
  currentIdleTokens: CurrentOverviewIdleTokenInput[];
  strategyRows: OverviewStrategyHistoryRow[];
  startAt: Date;
  endAt: Date;
}) {
  const db = getDb();
  const dayRows = iterateUtcDays(dayUtcFromDate(input.startAt), dayUtcFromDate(input.endAt));
  if (dayRows.length === 0 || input.currentIdleTokens.length === 0) {
    return [] as MergedAnalyzedPerformanceSnapshotRow[];
  }

  const excludedTokenAddresses = new Set(
    input.strategyRows
      .map((row) => asString(row.wrapperAddress)?.toLowerCase() ?? null)
      .filter((value): value is string => Boolean(value)),
  );

  const protocolAddressRows = await db
    .select({ address: protocolContracts.address })
    .from(protocolContracts)
    .where(eq(protocolContracts.chainId, input.chainId));
  const protocolAddressSet = new Set(protocolAddressRows.map((row) => row.address.toLowerCase()));

  const tokenMeta = new Map<string, {
    symbol: string | null;
    name: string | null;
    decimals: number | null;
    possibleSpam: boolean | null;
    verifiedContract: boolean | null;
    isNativeAsset: boolean;
  }>();
  const currentBalanceByToken = new Map<string, number>();
  const fallbackCurrentPriceByToken = new Map<string, number>();

  for (const token of input.currentIdleTokens) {
    const tokenAddress = token.tokenAddress.toLowerCase();
    if (excludedTokenAddresses.has(tokenAddress)) {
      continue;
    }

    tokenMeta.set(tokenAddress, {
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      possibleSpam: token.possibleSpam,
      verifiedContract: token.verifiedContract,
      isNativeAsset: token.isNativeAsset,
    });
    currentBalanceByToken.set(tokenAddress, token.balanceFormatted);
    if (token.currentPriceUsd !== null && token.currentPriceUsd > 0) {
      fallbackCurrentPriceByToken.set(tokenAddress, token.currentPriceUsd);
    }
  }

  const movementRows = await db
    .select({
      tokenAddress: assetMovements.tokenAddress,
      directionIn: assetMovements.directionIn,
      amountRaw: assetMovements.amountRaw,
      metadataJson: assetMovements.metadataJson,
      occurredAt: ledgerEvents.occurredAt,
    })
    .from(assetMovements)
    .innerJoin(ledgerEvents, eq(assetMovements.ledgerEventId, ledgerEvents.id))
    .where(
      and(
        eq(assetMovements.walletAddress, input.walletAddress.toLowerCase()),
        eq(assetMovements.chainId, input.chainId),
        gte(ledgerEvents.occurredAt, input.startAt),
        lte(ledgerEvents.occurredAt, endOfDayUtc(dayUtcFromDate(input.endAt))),
      ),
    );

  for (const row of movementRows) {
    const tokenAddress = row.tokenAddress.toLowerCase();
    if (excludedTokenAddresses.has(tokenAddress)) {
      continue;
    }

    if (!tokenMeta.has(tokenAddress)) {
      const metadataJson = asRecord(row.metadataJson);
      tokenMeta.set(tokenAddress, {
        symbol: asString(metadataJson.symbol),
        name: asString(metadataJson.name),
        decimals: asNumber(metadataJson.decimals),
        possibleSpam: typeof metadataJson.possibleSpam === "boolean" ? metadataJson.possibleSpam : null,
        verifiedContract: typeof metadataJson.verifiedContract === "boolean" ? metadataJson.verifiedContract : null,
        isNativeAsset: tokenAddress === "0x4200000000000000000000000000000000000006",
      });
      currentBalanceByToken.set(tokenAddress, 0);
    }
  }

  const relevantTokenAddresses = Array.from(tokenMeta.keys()).filter((tokenAddress) => !protocolAddressSet.has(tokenAddress));
  if (relevantTokenAddresses.length === 0) {
    return [] as MergedAnalyzedPerformanceSnapshotRow[];
  }

  const priceRows = await db
    .select({
      tokenAddress: pricePoints.tokenAddress,
      priceUsd: pricePoints.priceUsd,
      pricedAt: pricePoints.pricedAt,
    })
    .from(pricePoints)
    .where(
      and(
        eq(pricePoints.chainId, input.chainId),
        inArray(pricePoints.tokenAddress, relevantTokenAddresses),
        lte(pricePoints.pricedAt, input.endAt),
      ),
    )
    .orderBy(asc(pricePoints.tokenAddress), asc(pricePoints.pricedAt));

  const { latestPriceByToken, priceSeriesByToken } = buildDailyPriceSeriesByToken({
    dayRows,
    priceRows,
    capturedAt: input.endAt,
  });

  for (const [tokenAddress, currentPriceUsd] of fallbackCurrentPriceByToken.entries()) {
    if (!latestPriceByToken.has(tokenAddress)) {
      latestPriceByToken.set(tokenAddress, currentPriceUsd);
    }
  }

  const netInflowByDayToken = new Map<string, Map<string, number>>();
  for (const row of movementRows) {
    const tokenAddress = row.tokenAddress.toLowerCase();
    if (excludedTokenAddresses.has(tokenAddress) || protocolAddressSet.has(tokenAddress)) {
      continue;
    }

    const meta = tokenMeta.get(tokenAddress);
    if (!meta || meta.decimals === null || meta.decimals < 0) {
      continue;
    }

    const dayUtc = dayUtcFromDate(row.occurredAt);
    const tokenAmount = dividePow10(row.amountRaw, meta.decimals);
    const signedAmount = row.directionIn ? tokenAmount : -tokenAmount;
    const bucket = netInflowByDayToken.get(dayUtc) ?? new Map<string, number>();
    bucket.set(tokenAddress, (bucket.get(tokenAddress) ?? 0) + signedAmount);
    netInflowByDayToken.set(dayUtc, bucket);
  }

  const balancesPerDay = new Map<string, Map<string, number>>();
  const workingBalances = new Map(currentBalanceByToken);
  for (let index = dayRows.length - 1; index >= 0; index -= 1) {
    const dayUtc = dayRows[index];
    balancesPerDay.set(dayUtc, new Map(workingBalances));
    const dayDelta = netInflowByDayToken.get(dayUtc);
    if (!dayDelta) {
      continue;
    }

    for (const [tokenAddress, delta] of dayDelta.entries()) {
      const nextBalance = (workingBalances.get(tokenAddress) ?? 0) - delta;
      workingBalances.set(tokenAddress, Math.abs(nextBalance) < 1e-12 ? 0 : nextBalance);
    }
  }

  return dayRows.map((dayUtc) => {
    const idleTokens: Array<{ tokenAddress: string; symbol: string | null; balanceFormatted: number; valueUsd: number }> = [];
    let idleValueUsd = 0;

    for (const [tokenAddress, balanceFormatted] of (balancesPerDay.get(dayUtc) ?? new Map()).entries()) {
      if (balanceFormatted <= 0 || protocolAddressSet.has(tokenAddress) || excludedTokenAddresses.has(tokenAddress)) {
        continue;
      }

      const meta = tokenMeta.get(tokenAddress);
      if (!meta || meta.possibleSpam === true) {
        continue;
      }

      const priceUsd = resolveTokenPriceForDay({
        tokenAddress,
        dayUtc,
        priceSeriesByToken,
        latestPriceByToken,
      });
      if (priceUsd === null || priceUsd <= 0) {
        continue;
      }

      const valueUsd = balanceFormatted * priceUsd;
      idleValueUsd += valueUsd;
      idleTokens.push({
        tokenAddress,
        symbol: meta.symbol,
        balanceFormatted,
        valueUsd,
      });
    }

    return {
      capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
      totalValueUsd: formatSnapshotUsd(idleValueUsd),
      deployedValueUsd: null,
      idleValueUsd: formatSnapshotUsd(idleValueUsd),
      metadataJson: {
        dayUtc,
        snapshotKind: "analysis_engine_daily",
        source: "analyzed_history",
        sourceSurface: "wallet_idle_asset_movements",
        valueBasis: "historical_idle_balances_priced_daily",
        idleTokens,
      },
    } satisfies MergedAnalyzedPerformanceSnapshotRow;
  });
}

export function buildOverviewDeployedSnapshotsFromEngineV2(input: {
  depositRows: OverviewDepositHistoryRow[];
  strategyRows: OverviewStrategyHistoryRow[];
  priceRows: Array<{ tokenAddress: string; priceUsd: string; pricedAt: Date }>;
  startAt: Date;
  endAt: Date;
  currentTokenBalances?: CurrentOverviewDeployedTokenInput[];
}) {
  const events: Array<{ occurredAt: Date; dayUtc: string; tokenAddress: string; signedAmount: number }> = [];
  const relevantTokenAddresses = new Set<string>();

  for (const row of input.depositRows) {
    const allowedTokenAddresses = new Set(
      [row.token0Address, row.token1Address]
        .map((value) => asString(value)?.toLowerCase() ?? null)
        .filter((value): value is string => Boolean(value)),
    );

    for (const event of row.lifecycle) {
      const occurredAt = new Date(event.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        continue;
      }

      for (const delta of event.signedTokenDeltas) {
        const tokenAddress = asString(delta.tokenAddress)?.toLowerCase() ?? null;
        const amount = asNumber(delta.amountFormatted);
        if (!tokenAddress || amount === null || amount <= 0 || !allowedTokenAddresses.has(tokenAddress)) {
          continue;
        }

        relevantTokenAddresses.add(tokenAddress);
        events.push({
          occurredAt,
          dayUtc: occurredAt.toISOString().slice(0, 10),
          tokenAddress,
          signedAmount: delta.direction === "out" ? amount : -amount,
        });
      }
    }
  }

  for (const row of input.strategyRows) {
    const wrapperAddress = asString(row.wrapperAddress)?.toLowerCase() ?? null;

    for (const event of row.lifecycle) {
      if (event.eventType === "strategy_claim" || event.eventType === "unresolved_strategy_reward") {
        continue;
      }

      const occurredAt = new Date(event.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        continue;
      }

      for (const delta of event.tokenDeltas) {
        const tokenAddress = asString(delta.tokenAddress)?.toLowerCase() ?? null;
        const amount = asNumber(delta.amountFormatted);
        if (!tokenAddress || amount === null || amount <= 0 || tokenAddress === wrapperAddress) {
          continue;
        }

        relevantTokenAddresses.add(tokenAddress);
        events.push({
          occurredAt,
          dayUtc: occurredAt.toISOString().slice(0, 10),
          tokenAddress,
          signedAmount: delta.direction === "out" ? amount : -amount,
        });
      }
    }
  }

  if (events.length === 0) {
    return [] as MergedAnalyzedPerformanceSnapshotRow[];
  }

  const startDayUtc = input.startAt.toISOString().slice(0, 10);
  const endDayUtc = input.endAt.toISOString().slice(0, 10);
  const dayRows = iterateUtcDays(startDayUtc, endDayUtc);
  const { latestPriceByToken, priceSeriesByToken } = buildDailyPriceSeriesByToken({
    dayRows,
    priceRows: input.priceRows.filter((row) => relevantTokenAddresses.has(row.tokenAddress.toLowerCase())),
    capturedAt: input.endAt,
  });

  const eventsByDay = new Map<string, Array<{ occurredAt: Date; tokenAddress: string; signedAmount: number }>>();
  for (const event of events) {
    const bucket = eventsByDay.get(event.dayUtc) ?? [];
    bucket.push({ occurredAt: event.occurredAt, tokenAddress: event.tokenAddress, signedAmount: event.signedAmount });
    eventsByDay.set(event.dayUtc, bucket);
  }

  const balancesByToken = new Map<string, number>();

  if (input.currentTokenBalances && input.currentTokenBalances.length > 0) {
    for (const balance of input.currentTokenBalances) {
      if (balance.amount <= 0) {
        continue;
      }

      const tokenAddress = balance.tokenAddress.toLowerCase();
      relevantTokenAddresses.add(tokenAddress);
      balancesByToken.set(tokenAddress, balance.amount);
    }

    const balancesPerDay = new Map<string, Map<string, number>>();
    for (let index = dayRows.length - 1; index >= 0; index -= 1) {
      const dayUtc = dayRows[index];
      balancesPerDay.set(dayUtc, new Map(balancesByToken));
      const dayEvents = eventsByDay.get(dayUtc) ?? [];

      for (const event of dayEvents) {
        const nextBalance = (balancesByToken.get(event.tokenAddress) ?? 0) - event.signedAmount;
        balancesByToken.set(event.tokenAddress, Math.max(0, nextBalance));
      }
    }

    return dayRows.map((dayUtc) => {
      let deployedValueUsd = 0;
      const underlyingTokenBalances: Array<{ tokenAddress: string; amount: number; valueUsd: number | null }> = [];

      for (const [tokenAddress, amount] of (balancesPerDay.get(dayUtc) ?? new Map()).entries()) {
        if (amount <= 0) {
          continue;
        }

        const priceUsd = priceSeriesByToken.get(tokenAddress)?.get(dayUtc) ?? latestPriceByToken.get(tokenAddress) ?? null;
        const valueUsd = priceUsd === null ? null : amount * priceUsd;
        deployedValueUsd += valueUsd ?? 0;
        underlyingTokenBalances.push({ tokenAddress, amount, valueUsd });
      }

      return {
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        totalValueUsd: null,
        deployedValueUsd: formatSnapshotUsd(deployedValueUsd),
        idleValueUsd: null,
        metadataJson: {
          dayUtc,
          rewardValueUsd: 0,
          snapshotKind: "analysis_engine_daily",
          source: "analyzed_history",
          sourceSurface: "engine_v2_deposits+strategies",
          valueBasis: "historical_token_balances_priced_daily",
          underlyingTokenBalances,
        },
      } satisfies MergedAnalyzedPerformanceSnapshotRow;
    });
  }

  const seededEvents = events
    .filter((event) => event.dayUtc < startDayUtc)
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  for (const event of seededEvents) {
    const nextBalance = (balancesByToken.get(event.tokenAddress) ?? 0) + event.signedAmount;
    balancesByToken.set(event.tokenAddress, Math.max(0, nextBalance));
  }

  return dayRows.map((dayUtc) => {
    const dayEvents = (eventsByDay.get(dayUtc) ?? []).sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
    for (const event of dayEvents) {
      const nextBalance = (balancesByToken.get(event.tokenAddress) ?? 0) + event.signedAmount;
      balancesByToken.set(event.tokenAddress, Math.max(0, nextBalance));
    }

    let deployedValueUsd = 0;
    const underlyingTokenBalances: Array<{ tokenAddress: string; amount: number; valueUsd: number | null }> = [];

    for (const [tokenAddress, amount] of balancesByToken.entries()) {
      if (amount <= 0) {
        continue;
      }

      const priceUsd = priceSeriesByToken.get(tokenAddress)?.get(dayUtc) ?? latestPriceByToken.get(tokenAddress) ?? null;
      const valueUsd = priceUsd === null ? null : amount * priceUsd;
      deployedValueUsd += valueUsd ?? 0;
      underlyingTokenBalances.push({ tokenAddress, amount, valueUsd });
    }

    return {
      capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
      totalValueUsd: null,
      deployedValueUsd: formatSnapshotUsd(deployedValueUsd),
      idleValueUsd: null,
      metadataJson: {
        dayUtc,
        rewardValueUsd: 0,
        snapshotKind: "analysis_engine_daily",
        source: "analyzed_history",
        sourceSurface: "engine_v2_deposits+strategies",
        valueBasis: "historical_token_balances_priced_daily",
        underlyingTokenBalances,
      },
    } satisfies MergedAnalyzedPerformanceSnapshotRow;
  });
}

function readOverviewEarliestEngineV2PoolHistoryAt(rows: EngineV2PoolHistoryReadModelRow[]) {
  let earliest: Date | null = null;

  for (const row of rows) {
    const historyPoints = Array.isArray(row.history?.points) ? row.history.points : [];

    for (const pointCandidate of historyPoints) {
      const point = asRecord(pointCandidate);
      const dayUtc = typeof point.dayUtc === "string" ? point.dayUtc : null;
      if (!dayUtc) {
        continue;
      }

      const capturedAt = new Date(`${dayUtc}T00:00:00.000Z`);
      if (Number.isNaN(capturedAt.getTime())) {
        continue;
      }

      if (!earliest || capturedAt < earliest) {
        earliest = capturedAt;
      }
    }
  }

  return earliest;
}

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

export async function readOverviewActiveAerodromePositionTokenIds(input: ScopedWalletInput) {
  const positionManagerAddress = AERODROME_CL_POSITION_MANAGER_ADDRESS[input.chainId] ?? null;

  if (!positionManagerAddress) {
    return [] as string[];
  }

  const db = getDb();
  const rows = await db
    .select({ tokenId: deposits.tokenId })
    .from(deposits)
    .where(
      and(
        eq(deposits.walletAddress, input.walletAddress.toLowerCase()),
        eq(deposits.chainId, input.chainId),
        eq(deposits.positionManagerAddress, positionManagerAddress),
        sql`${deposits.tokenId} is not null`,
        sql`${deposits.status} <> 'closed'`,
      ),
    );

  return Array.from(
    new Set(
      rows
        .map((row) => row.tokenId)
        .filter((tokenId): tokenId is string => typeof tokenId === "string" && tokenId.length > 0),
    ),
  );
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
  const resolutionAliases =
    input.resolution === "1d" || input.resolution === "daily"
      ? ["1d", "daily"]
      : input.resolution === "1h" || input.resolution === "hourly"
        ? ["1h", "hourly"]
        : [input.resolution];

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
        inArray(pricePoints.resolution, resolutionAliases),
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
  currentIdleTokens?: CurrentOverviewIdleTokenInput[];
  currentDeployedTokenBalances?: CurrentOverviewDeployedTokenInput[];
}) {
  const db = getDb();

  const [depositRows, strategyRows] = await Promise.all([
    readEngineV2SurfaceRows<DepositDetailView>({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      surface: "deposits",
    }),
    readEngineV2SurfaceRows<StrategyDetailView>({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      surface: "strategies",
    }),
  ]);

  const relevantTokenAddresses = new Set<string>();
  for (const row of depositRows ?? []) {
    for (const event of row.lifecycle ?? []) {
      for (const delta of event.signedTokenDeltas ?? []) {
        const tokenAddress = asString(delta.tokenAddress)?.toLowerCase();
        if (tokenAddress) {
          relevantTokenAddresses.add(tokenAddress);
        }
      }
    }
  }
  for (const row of strategyRows ?? []) {
    for (const event of row.lifecycle ?? []) {
      for (const delta of event.tokenDeltas ?? []) {
        const tokenAddress = asString(delta.tokenAddress)?.toLowerCase();
        if (tokenAddress) {
          relevantTokenAddresses.add(tokenAddress);
        }
      }
    }
  }

  const priceRows = relevantTokenAddresses.size === 0
    ? []
    : await db
      .select({
        tokenAddress: pricePoints.tokenAddress,
        priceUsd: pricePoints.priceUsd,
        pricedAt: pricePoints.pricedAt,
      })
      .from(pricePoints)
      .where(
        and(
          eq(pricePoints.chainId, input.chainId),
          inArray(pricePoints.tokenAddress, Array.from(relevantTokenAddresses)),
          lte(pricePoints.pricedAt, input.endAt),
        ),
      )
      .orderBy(desc(pricePoints.pricedAt));

  const engineV2Snapshots = buildOverviewDeployedSnapshotsFromEngineV2({
    depositRows: depositRows ?? [],
    strategyRows: strategyRows ?? [],
    priceRows,
    startAt: input.startAt,
    endAt: input.endAt,
    currentTokenBalances: input.currentDeployedTokenBalances,
  });

  const idleSnapshots = input.currentIdleTokens && input.currentIdleTokens.length > 0
    ? await readOverviewIdleSnapshotsFromCurrentTokens({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      currentIdleTokens: input.currentIdleTokens,
      strategyRows: strategyRows ?? [],
      startAt: input.startAt,
      endAt: input.endAt,
    })
    : [];

  const liveSnapshots = mergeLiveOverviewSnapshotRows({
    deployedRows: engineV2Snapshots,
    idleRows: idleSnapshots,
  });

  if (liveSnapshots.length > 0) {
    return liveSnapshots;
  }

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

export async function readOverviewChartHistoryStartAt(input: ScopedWalletInput) {
  const db = getDb();
  const [engineV2Rows, portfolioSnapshotRows, performanceSnapshotRows] = await Promise.all([
    readEngineV2SurfaceRows<EngineV2PoolHistoryReadModelRow>({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      surface: "pools",
    }),
    db
      .select({ capturedAt: sql<Date | null>`min(${portfolioSnapshots.capturedAt})` })
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.walletAddress, input.walletAddress.toLowerCase()),
          eq(portfolioSnapshots.chainId, input.chainId),
        ),
      ),
    db
      .select({ capturedAt: sql<Date | null>`min(${performanceSnapshots.capturedAt})` })
      .from(performanceSnapshots)
      .where(
        and(
          eq(performanceSnapshots.walletAddress, input.walletAddress.toLowerCase()),
          eq(performanceSnapshots.chainId, input.chainId),
          inArray(performanceSnapshots.scope, ["portfolio", "idle"]),
          eq(performanceSnapshots.resolution, "daily"),
        ),
      ),
  ]);

  const candidateDates = [
    engineV2Rows ? readOverviewEarliestEngineV2PoolHistoryAt(engineV2Rows) : null,
    portfolioSnapshotRows[0]?.capturedAt ?? null,
    performanceSnapshotRows[0]?.capturedAt ?? null,
  ].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  if (candidateDates.length === 0) {
    return null;
  }

  return candidateDates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
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
      and re.resolution_status = 'resolved'
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

export async function readOverviewUnresolvedRewardCoverage(input: ScopedWalletInput & {
  startAt: Date;
  endAt: Date;
}) {
  const db = getDb();

  const rows = await db
    .select({
      occurredAt: rewardEvents.occurredAt,
      resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
      txHash: rewardEvents.txHash,
    })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.walletAddress, input.walletAddress.toLowerCase()),
        eq(rewardEvents.chainId, input.chainId),
        eq(rewardEvents.isAccrualSnapshot, false),
        gte(rewardEvents.occurredAt, input.startAt),
        lte(rewardEvents.occurredAt, input.endAt),
        sql`${rewardEvents.resolutionStatus} <> 'resolved'`,
        sql`not exists (
          select 1
          from ${ledgerEvents} le_filtered
          where le_filtered.chain_id = ${rewardEvents.chainId}
            and le_filtered.wallet_address = ${rewardEvents.walletAddress}
            and le_filtered.tx_hash = ${rewardEvents.txHash}
            and (
              le_filtered.classification = 'governance'
              or lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%voting escrow%'
              or lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%veaero%'
              or (
                lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%aerodrome%'
                and lower(coalesce(le_filtered.metadata_json->>'summary', '')) like '%escrow%'
              )
            )
        )`,
      ),
    )
    .orderBy(rewardEvents.occurredAt);

  return rows.map((row) => ({
    occurredAt: row.occurredAt,
    resolutionReasonCodes: row.resolutionReasonCodes ?? [],
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