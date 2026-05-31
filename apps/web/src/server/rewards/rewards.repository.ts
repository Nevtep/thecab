import { and, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import { performanceSnapshots, pools, rewardEvents } from "@/server/db/schema";
import { getExplorerTxUrl, getSupportedChain } from "@/server/chains";
import type {
  RewardEventRow,
  RewardsCoverageState,
  RewardsRequest,
  RewardsResolutionStatus,
} from "@/server/rewards/rewards.types";

export type RewardEventDbRow = {
  rewardEventId: string;
  chainId: number;
  walletAddress: string;
  txHash: string;
  logIndex: number;
  rewardType: string;
  depositOrStrategyId: string | null;
  strategyExposureId: string | null;
  resolvedPoolId: string | null;
  poolLabel: string | null;
  resolutionBasis: string | null;
  resolutionReasonCodes: string[] | null;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountUsd: string | null;
  occurredAt: Date | string;
  resolutionStatus: string;
  metadataJson: Record<string, unknown> | null;
};

export type RewardsRepositoryResult = {
  allRows: RewardEventRow[];
  rows: RewardEventRow[];
  totalRows: number;
  historicalCapital: HistoricalCapitalPoint[];
  availableFilters: {
    tokens: Array<{ tokenAddress: string; symbol: string | null }>;
    pools: Array<{ poolId: string; label: string }>;
    rewardTypes: string[];
  };
};

export type HistoricalCapitalPoint = {
  dayUtc: string;
  valueUsd: string;
  coverageStatus: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function shortId(id: string | null, prefix: string) {
  if (!id) return null;
  return `${prefix}-${id.slice(0, 4)}...${id.slice(-4)}`;
}

function getExternalTxUrl(chainId: number, txHash: string | null) {
  if (!txHash) return null;
  return getSupportedChain(chainId) ? getExplorerTxUrl(chainId, txHash) : null;
}

function getGovernanceRewardRoute(row: RewardEventDbRow) {
  const params = new URLSearchParams({
    chainId: String(row.chainId),
    kind: "reward",
    selected: row.rewardEventId,
    rewardEventId: row.rewardEventId,
  });
  return `/governance?${params.toString()}`;
}

function normalizeResolutionStatus(value: string): RewardsResolutionStatus {
  if (value === "resolved" || value === "unresolved" || value === "excluded" || value === "unavailable") {
    return value;
  }
  return "unresolved";
}

function normalizeCoverage(row: RewardEventDbRow): RewardsCoverageState {
  const status = normalizeResolutionStatus(row.resolutionStatus);
  if (status === "excluded" || status === "unresolved" || status === "unavailable") return status;
  if (row.amountUsd === null) return "partial";
  return "full";
}

function resolveOwner(row: RewardEventDbRow): RewardEventRow["owner"] {
  const metadata = asRecord(row.metadataJson);
  const sourceSurface = asString(metadata.sourceSurface) ?? asString(metadata.surfaceKind) ?? "";
  const resolutionStatus = normalizeResolutionStatus(row.resolutionStatus);

  if (resolutionStatus === "excluded") {
    return {
      status: "excluded",
      labelKey: "rewards:sources.excluded",
      entityId: null,
      entityLabel: null,
      route: null,
    };
  }

  if (row.strategyExposureId) {
    return {
      status: "strategy",
      labelKey: "rewards:sources.strategy",
      entityId: row.strategyExposureId,
      entityLabel: shortId(row.strategyExposureId, "Strat"),
      route: `/strategies?selectedStrategyId=${row.strategyExposureId}`,
    };
  }

  if (row.depositOrStrategyId && !sourceSurface.includes("strategy")) {
    return {
      status: "manual_deposit",
      labelKey: "rewards:sources.manualDeposit",
      entityId: row.depositOrStrategyId,
      entityLabel: shortId(row.depositOrStrategyId, "Dep"),
      route: `/deposits/${row.depositOrStrategyId}`,
    };
  }

  if (sourceSurface.includes("governance") || row.rewardType.includes("governance")) {
    return {
      status: "governance",
      labelKey: "rewards:sources.governance",
      entityId: row.rewardEventId,
      entityLabel: shortId(row.rewardEventId, "Gov"),
      route: getGovernanceRewardRoute(row),
    };
  }

  if (resolutionStatus === "unavailable") {
    return {
      status: "unavailable",
      labelKey: "rewards:sources.unavailable",
      entityId: null,
      entityLabel: null,
      route: null,
    };
  }

  return {
    status: "unresolved",
    labelKey: "rewards:sources.unresolved",
    entityId: null,
    entityLabel: null,
    route: null,
  };
}

function resolveTokenSymbol(metadata: Record<string, unknown>, tokenAddress: string | null) {
  return (
    asString(metadata.tokenSymbol) ??
    asString(metadata.rewardTokenSymbol) ??
    asString(metadata.symbol) ??
    (tokenAddress ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}` : null)
  );
}

export function mapRewardEventRow(row: RewardEventDbRow): RewardEventRow {
  const metadata = asRecord(row.metadataJson);
  const owner = resolveOwner(row);
  const coverageState = normalizeCoverage(row);
  const sourceSurface =
    asString(metadata.sourceSurface) ??
    asString(metadata.surfaceKind) ??
    asString(metadata.rewardSurface) ??
    "unknown_reward_surface";
  const poolContributionStatus = row.resolvedPoolId && owner.status !== "unresolved" && owner.status !== "excluded" && owner.status !== "unavailable"
    ? "contributes"
    : owner.status === "excluded"
      ? "excluded"
      : owner.status === "unresolved"
        ? "unresolved"
        : "none";
  const confidence: RewardEventRow["confidence"] = owner.status === "excluded"
    ? "none"
    : owner.status === "unresolved" || coverageState === "partial"
      ? "low"
      : "high";

  return {
    rewardEventId: row.rewardEventId,
    occurredAt: toIso(row.occurredAt),
    token: {
      address: row.tokenAddress,
      symbol: resolveTokenSymbol(metadata, row.tokenAddress),
      iconUrl: asString(metadata.tokenIconUrl),
    },
    tokenAmount: asString(metadata.amountFormatted) ?? row.amountRaw,
    usdValueAtClaim: row.amountUsd,
    owner,
    sourceSurface,
    poolContribution: {
      status: poolContributionStatus,
      poolId: row.resolvedPoolId,
      poolLabel: row.poolLabel,
      route: row.resolvedPoolId ? `/pools/${row.resolvedPoolId}` : null,
      countingRule:
        poolContributionStatus === "contributes"
          ? owner.status === "governance"
            ? "governance_explicit_pool"
            : row.resolutionBasis === "wallet_pool_aggregate"
            ? "wallet_pool_aggregate"
            : "owner_resolved_pool"
          : poolContributionStatus === "excluded"
            ? "excluded_activity"
            : poolContributionStatus === "unresolved"
              ? "unresolved_owner"
              : owner.status === "governance"
                ? "governance_unassociated_no_pool"
                : "no_pool_contribution",
    },
    rewardType: row.rewardType,
    coverageState,
    confidence,
    confidenceDots: confidence === "high" ? 5 : confidence === "low" ? 2 : 0,
    resolutionReasonCodes: row.resolutionReasonCodes ?? [],
    txHash: row.txHash,
    externalTxUrl: getExternalTxUrl(row.chainId, row.txHash),
  };
}

export function getRewardsDateRange(input: RewardsRequest) {
  if (input.datePreset === "all") return { start: null, end: null };
  if (input.datePreset === "custom") {
    return {
      start: input.dateStart ? Date.parse(input.dateStart) : null,
      end: input.dateEnd ? Date.parse(input.dateEnd) : null,
    };
  }
  const days = input.datePreset === "7d" ? 7 : input.datePreset === "90d" ? 90 : input.datePreset === "1y" ? 365 : 30;
  return {
    start: Date.now() - days * 24 * 60 * 60 * 1000,
    end: null,
  };
}

export function matchesRewardsRequest(row: RewardEventRow, input: RewardsRequest) {
  const range = getRewardsDateRange(input);
  const occurred = Date.parse(row.occurredAt);
  if (range.start !== null && occurred < range.start) return false;
  if (range.end !== null && occurred > range.end) return false;
  if (input.source !== "all") {
    if (input.source === "deposits" && row.owner.status !== "manual_deposit") return false;
    if (input.source === "strategies" && row.owner.status !== "strategy") return false;
    if (input.source === "governance" && row.owner.status !== "governance") return false;
    if (input.source === "unresolved" && row.owner.status !== "unresolved") return false;
    if (input.source === "excluded" && row.owner.status !== "excluded") return false;
    if (input.source === "unavailable" && row.owner.status !== "unavailable") return false;
  }
  if (input.tokenAddress && row.token.address?.toLowerCase() !== input.tokenAddress) return false;
  if (input.poolId && row.poolContribution.poolId !== input.poolId) return false;
  if (input.depositId && row.owner.entityId !== input.depositId) return false;
  if (input.strategyExposureId && row.owner.entityId !== input.strategyExposureId) return false;
  if (input.rewardType && row.rewardType !== input.rewardType) return false;
  if (input.coverage && row.coverageState !== input.coverage) return false;
  if (input.resolutionStatus) {
    const rowResolution = row.owner.status === "excluded"
      ? "excluded"
      : row.owner.status === "unavailable"
        ? "unavailable"
        : row.owner.status === "unresolved"
          ? "unresolved"
          : "resolved";
    if (rowResolution !== input.resolutionStatus) return false;
  }
  if (input.search) {
    const needle = input.search.toLowerCase();
    const haystack = [
      row.txHash,
      row.token.symbol,
      row.token.address,
      row.poolContribution.poolLabel,
      row.owner.entityLabel,
      row.rewardType,
      row.sourceSurface,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function sortRewardRows(rows: RewardEventRow[], input: RewardsRequest) {
  return [...rows].sort((left, right) => {
    let cmp = 0;
    switch (input.sort.key) {
      case "valueUsd":
        cmp = (asNumber(left.usdValueAtClaim) ?? -Infinity) - (asNumber(right.usdValueAtClaim) ?? -Infinity);
        break;
      case "tokenAmount":
        cmp = (asNumber(left.tokenAmount) ?? -Infinity) - (asNumber(right.tokenAmount) ?? -Infinity);
        break;
      case "source":
        cmp = left.sourceSurface.localeCompare(right.sourceSurface);
        break;
      case "owner":
        cmp = left.owner.status.localeCompare(right.owner.status);
        break;
      case "coverage":
        cmp = left.coverageState.localeCompare(right.coverageState);
        break;
      case "occurredAt":
      default:
        cmp = left.occurredAt.localeCompare(right.occurredAt);
    }
    if (cmp === 0) cmp = left.rewardEventId.localeCompare(right.rewardEventId);
    return input.sort.direction === "asc" ? cmp : -cmp;
  });
}

function buildRewardEventWhere(input: RewardsRequest, includeComposedFilters: boolean) {
  const range = getRewardsDateRange(input);
  const clauses = [
    eq(rewardEvents.walletAddress, input.walletAddress),
    eq(rewardEvents.chainId, input.chainId),
    eq(rewardEvents.isAccrualSnapshot, false),
  ];

  if (!includeComposedFilters) return clauses;

  if (range.start !== null) clauses.push(gte(rewardEvents.occurredAt, new Date(range.start)));
  if (range.end !== null) clauses.push(lte(rewardEvents.occurredAt, new Date(range.end)));
  if (input.tokenAddress) clauses.push(eq(rewardEvents.tokenAddress, input.tokenAddress));
  if (input.poolId) clauses.push(eq(rewardEvents.resolvedPoolId, input.poolId));
  if (input.depositId) clauses.push(eq(rewardEvents.depositOrStrategyId, input.depositId));
  if (input.strategyExposureId) clauses.push(eq(rewardEvents.strategyExposureId, input.strategyExposureId));
  if (input.rewardType) clauses.push(eq(rewardEvents.rewardType, input.rewardType));
  if (input.resolutionStatus) clauses.push(eq(rewardEvents.resolutionStatus, input.resolutionStatus));

  if (input.coverage) {
    if (input.coverage === "full") {
      clauses.push(eq(rewardEvents.resolutionStatus, "resolved"));
      clauses.push(isNotNull(rewardEvents.amountUsd));
    } else if (input.coverage === "partial") {
      clauses.push(eq(rewardEvents.resolutionStatus, "resolved"));
      clauses.push(isNull(rewardEvents.amountUsd));
    } else {
      clauses.push(eq(rewardEvents.resolutionStatus, input.coverage));
    }
  }

  if (input.source !== "all") {
    if (input.source === "strategies") {
      clauses.push(isNotNull(rewardEvents.strategyExposureId));
    }
    if (input.source === "deposits") {
      clauses.push(isNotNull(rewardEvents.depositOrStrategyId));
      clauses.push(isNull(rewardEvents.strategyExposureId));
    }
    if (input.source === "governance") {
      clauses.push(or(
        ilike(rewardEvents.rewardType, "%governance%"),
        sql`${rewardEvents.metadataJson}->>'sourceSurface' ILIKE ${"%governance%"}`,
        sql`${rewardEvents.metadataJson}->>'surfaceKind' ILIKE ${"%governance%"}`,
      )!);
    }
    if (input.source === "unresolved" || input.source === "excluded" || input.source === "unavailable") {
      clauses.push(eq(rewardEvents.resolutionStatus, input.source));
    }
  }

  if (input.search) {
    const needle = `%${input.search}%`;
    clauses.push(or(
      ilike(rewardEvents.txHash, needle),
      ilike(rewardEvents.rewardType, needle),
      ilike(rewardEvents.tokenAddress, needle),
      sql`${rewardEvents.metadataJson}::text ILIKE ${needle}`,
    )!);
  }

  return clauses;
}

export function applyRewardsFilters(rows: RewardEventRow[], input: RewardsRequest) {
  return sortRewardRows(rows.filter((row) => matchesRewardsRequest(row, input)), input);
}

export function calculateAvailableRewardFilters(rows: RewardEventRow[]) {
  const tokenMap = new Map<string, string | null>();
  const poolMap = new Map<string, string>();
  const rewardTypes = new Set<string>();
  for (const row of rows) {
    if (row.token.address) tokenMap.set(row.token.address, row.token.symbol);
    if (row.poolContribution.poolId && row.poolContribution.poolLabel) {
      poolMap.set(row.poolContribution.poolId, row.poolContribution.poolLabel);
    }
    rewardTypes.add(row.rewardType);
  }

  return {
    tokens: [...tokenMap.entries()].map(([tokenAddress, symbol]) => ({ tokenAddress, symbol })),
    pools: [...poolMap.entries()].map(([poolId, label]) => ({ poolId, label })),
    rewardTypes: [...rewardTypes].sort(),
  };
}

export async function readRewardsAnalysisContext(input: { walletAddress: string; chainId: number }) {
  return readAnalysisStatusContext(input);
}

export async function findRewards(input: RewardsRequest): Promise<RewardsRepositoryResult> {
  const db = getDb();
  const selectShape = {
    rewardEventId: rewardEvents.id,
    chainId: rewardEvents.chainId,
    walletAddress: rewardEvents.walletAddress,
    txHash: rewardEvents.txHash,
    logIndex: rewardEvents.logIndex,
    rewardType: rewardEvents.rewardType,
    depositOrStrategyId: rewardEvents.depositOrStrategyId,
    strategyExposureId: rewardEvents.strategyExposureId,
    resolvedPoolId: rewardEvents.resolvedPoolId,
    poolLabel: pools.label,
    resolutionBasis: rewardEvents.resolutionBasis,
    resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
    tokenAddress: rewardEvents.tokenAddress,
    amountRaw: rewardEvents.amountRaw,
    amountUsd: rewardEvents.amountUsd,
    occurredAt: rewardEvents.occurredAt,
    resolutionStatus: rewardEvents.resolutionStatus,
    metadataJson: rewardEvents.metadataJson,
  } as const;
  const range = getRewardsDateRange(input);

  const [baseDbRows, filteredDbRows, historicalCapitalRows] = await Promise.all([
    db
      .select(selectShape)
      .from(rewardEvents)
      .leftJoin(pools, eq(rewardEvents.resolvedPoolId, pools.id))
      .where(and(...buildRewardEventWhere(input, false))),
    db
      .select(selectShape)
      .from(rewardEvents)
      .leftJoin(pools, eq(rewardEvents.resolvedPoolId, pools.id))
      .where(and(...buildRewardEventWhere(input, true))),
    db
      .select({
        dayUtc: performanceSnapshots.dayUtc,
        valueUsd: performanceSnapshots.valueUsd,
        coverageStatus: performanceSnapshots.coverageStatus,
      })
      .from(performanceSnapshots)
      .where(and(
        eq(performanceSnapshots.walletAddress, input.walletAddress),
        eq(performanceSnapshots.chainId, input.chainId),
        eq(performanceSnapshots.scope, "portfolio"),
        eq(performanceSnapshots.resolution, "daily"),
        ...(range.start !== null ? [gte(performanceSnapshots.capturedAt, new Date(range.start))] : []),
        ...(range.end !== null ? [lte(performanceSnapshots.capturedAt, new Date(range.end))] : []),
      )),
  ]);

  const baseRows = (baseDbRows as RewardEventDbRow[]).map(mapRewardEventRow);
  const filtered = applyRewardsFilters((filteredDbRows as RewardEventDbRow[]).map(mapRewardEventRow), input);
  const startIndex = (input.page - 1) * input.pageSize;
  const rows = filtered.slice(startIndex, startIndex + input.pageSize);

  return {
    allRows: filtered,
    rows,
    totalRows: filtered.length,
    historicalCapital: historicalCapitalRows
      .filter((row): row is { dayUtc: string; valueUsd: string; coverageStatus: string } => Boolean(row.dayUtc))
      .map((row) => ({
        dayUtc: row.dayUtc,
        valueUsd: row.valueUsd,
        coverageStatus: row.coverageStatus,
      })),
    availableFilters: calculateAvailableRewardFilters(baseRows),
  };
}
