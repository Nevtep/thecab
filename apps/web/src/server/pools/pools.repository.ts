import { engineV2ReadModelsEnabled, readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import type { PoolDetailRange, PoolHistoryPoint, PoolPositions, PoolPositionToken, PoolsListItem } from "@/server/pools/pools.types";

type PoolsListRepositoryItem = PoolsListItem & {
  coveredStartDayUtc: string | null;
  coveredEndDayUtc: string | null;
  currentManualValueUsd: number;
  currentStrategyValueUsd: number;
  currentResidualValueUsd: number;
};

type EngineV2PoolHistoryPoint = PoolHistoryPoint & {
  coverageStatus?: string;
};

type EngineV2PoolReadModelRow = PoolsListRepositoryItem & {
  history?: {
    points?: unknown[];
  };
  timeline?: {
    items?: unknown[];
  };
  positions?: {
    manualDeposits?: unknown[];
    automatedStrategies?: unknown[];
  };
};

function hasRichEngineV2PoolRow(row: Partial<EngineV2PoolReadModelRow>) {
  return Boolean(
    (Array.isArray(row.tokenSymbols) && row.tokenSymbols.length > 0)
      || row.feeTierLabel
      || row.poolType
      || row.coveredStartDayUtc
      || row.coveredEndDayUtc
      || row.latestActivityAt
      || (Array.isArray(row.strategyLabels) && row.strategyLabels.length > 0)
      || (Array.isArray(row.history?.points) && row.history.points.length > 0)
      || (Array.isArray(row.timeline?.items) && row.timeline.items.length > 0)
      || (Array.isArray(row.positions?.manualDeposits) && row.positions.manualDeposits.length > 0)
      || (Array.isArray(row.positions?.automatedStrategies) && row.positions.automatedStrategies.length > 0),
  );
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

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asTick(value: unknown) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function asDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  return null;
}

function asNullableInteger(value: unknown) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function looksLikeAddressLabel(value: string) {
  return /^0x[0-9a-f]{40}(\b|$)/i.test(value.trim());
}

function isPairOnlyLabelWithoutDensity(value: string) {
  return /^[A-Za-z0-9]+\s*\/\s*[A-Za-z0-9]+$/.test(value.trim());
}

// Mirrors Aerodrome's pool taxonomy (CL tick spacing | v1 Volatile | v1 Stable).
// Labels MUST carry a density/type suffix — pair-only labels are forbidden
// because two pools with the same pair at different densities collide.
function resolveAerodromeSuffix(input: { feeTierLabel: string | null; poolType: string | null }) {
  if (input.feeTierLabel && input.feeTierLabel.trim().length > 0) {
    return input.feeTierLabel.trim();
  }
  const type = input.poolType?.trim().toLowerCase() ?? "";
  if (type === "stable") return "Stable";
  if (type === "volatile") return "Volatile";
  return null;
}

function resolveDisplayPoolLabel(input: {
  rawLabel: unknown;
  tokenSymbols: string[];
  feeTierLabel: string | null;
  poolType?: string | null;
}) {
  const pair = input.tokenSymbols.length >= 2
    ? `${input.tokenSymbols[0]} / ${input.tokenSymbols[1]}`
    : null;
  const suffix = resolveAerodromeSuffix({
    feeTierLabel: input.feeTierLabel,
    poolType: input.poolType ?? null,
  });
  const synthetic = pair && suffix ? `${pair} ${suffix}` : null;

  if (typeof input.rawLabel === "string" && input.rawLabel.trim().length > 0) {
    const trimmed = input.rawLabel.trim();
    if (!looksLikeAddressLabel(trimmed)) {
      // Reject pair-only stored labels: upgrade to a suffixed label if we
      // can, otherwise fall through so we never display "TOKEN0 / TOKEN1"
      // without a density/type suffix.
      if (isPairOnlyLabelWithoutDensity(trimmed)) {
        if (suffix) {
          return `${trimmed} ${suffix}`;
        }
      } else {
        return trimmed;
      }
    }
  }

  return synthetic ?? "Unknown pool";
}

function normalizeStatus(value: string): PoolsListItem["status"] {
  switch (value) {
    case "active":
    case "inactive":
    case "closed":
      return value;
    default:
      return "unknown";
  }
}

function normalizeExposureMix(value: string): PoolsListItem["exposureMix"] {
  switch (value) {
    case "manual":
    case "automated":
    case "mixed":
    case "residual_only":
      return value;
    default:
      return "unknown";
  }
}

function normalizeCoverageStatus(value: string): PoolsListItem["coverageStatus"] {
  switch (value) {
    case "full":
    case "share_level":
    case "partial":
      return value;
    default:
      return "unknown";
  }
}

function normalizeDepositStatus(value: string): "staked" | "open" | "closed" | "unknown" {
  switch (value) {
    case "staked":
    case "open":
    case "closed":
      return value;
    default:
      return "unknown";
  }
}

function emptyPoolSummarySeries() {
  return {
    activePoolCount: [],
    currentAttributedValueUsd: [],
    totalRewardsUsd: [],
    estimatedAnnualizedReturnPct: [],
  };
}

function hasVisibleEngineV2PoolExposure(row: EngineV2PoolReadModelRow) {
  const manualPositions = Array.isArray(row.positions?.manualDeposits) ? row.positions.manualDeposits.length : 0;
  const strategyPositions = Array.isArray(row.positions?.automatedStrategies) ? row.positions.automatedStrategies.length : 0;

  if (manualPositions > 0 || strategyPositions > 0) {
    return true;
  }

  return row.currentManualValueUsd > 0 || row.currentStrategyValueUsd > 0;
}

function isClosedManualPosition(position: unknown) {
  return asRecord(position).status === "closed";
}

function positionValueUsd(position: unknown) {
  return asNumber(asRecord(position).valueUsd) ?? 0;
}

export function normalizeEngineV2PoolSummaryRow(row: EngineV2PoolReadModelRow) {
  const normalizedHistoryPoints = Array.isArray(row.history?.points)
    ? normalizeEngineV2PoolHistoryPoints(row.history.points)
    : [];
  const latestCumulativeRewardsUsd = normalizedHistoryPoints.at(-1)?.cumulativeRewardsUsd ?? null;
  const label = resolveDisplayPoolLabel({
    rawLabel: row.label,
    tokenSymbols: asStringArray(row.tokenSymbols),
    feeTierLabel: row.feeTierLabel,
    poolType: row.poolType,
  });
  const manualPositions = Array.isArray(row.positions?.manualDeposits) ? row.positions.manualDeposits : [];
  const automatedPositions = Array.isArray(row.positions?.automatedStrategies) ? row.positions.automatedStrategies : [];
  const openManualPositions = manualPositions.filter((position) => !isClosedManualPosition(position));
  const openManualValueUsd = openManualPositions.reduce<number>((sum, position) => sum + positionValueUsd(position), 0);
  const hasClosedOnlyManualPositions = manualPositions.length > 0 && openManualPositions.length === 0 && automatedPositions.length === 0;
  const storedCurrentManualValueUsd = asNumber(row.currentManualValueUsd) ?? 0;
  const currentStrategyValueUsd = asNumber(row.currentStrategyValueUsd) ?? 0;
  const currentResidualValueUsd = asNumber(row.currentResidualValueUsd) ?? 0;
  const currentManualValueUsd = hasClosedOnlyManualPositions
    ? 0
    : openManualPositions.length > 0
      ? openManualValueUsd
      : storedCurrentManualValueUsd;
  const currentAttributedValueUsd = Math.max(currentManualValueUsd + currentStrategyValueUsd + currentResidualValueUsd, 0);
  const hasCurrentExposure = openManualPositions.length > 0
    || automatedPositions.length > 0
    || currentManualValueUsd > 0
    || currentStrategyValueUsd > 0;
  const normalizedStatus = !hasCurrentExposure
    ? "closed"
    : row.isInRange === false
      ? "inactive"
      : "active";

  return {
    ...row,
    label,
    status: normalizedStatus,
    currentAttributedValueUsd,
    currentManualValueUsd,
    currentStrategyValueUsd,
    currentResidualValueUsd,
    totalRewardsUsd: latestCumulativeRewardsUsd ?? row.totalRewardsUsd,
  } satisfies EngineV2PoolReadModelRow;
}

function summarizeEngineV2PoolRows(rows: EngineV2PoolReadModelRow[]) {
  const buckets = new Map<string, {
    activePoolCount: number;
    currentAttributedValueUsd: number;
    totalRewardsUsd: number;
    rewardValueUsd: number;
  }>();

  for (const row of rows) {
    const historyPoints = Array.isArray(row.history?.points)
      ? row.history.points as EngineV2PoolHistoryPoint[]
      : [];

    for (const point of historyPoints) {
      if (typeof point?.dayUtc !== "string" || point.dayUtc.length === 0) {
        continue;
      }

      const bucket = buckets.get(point.dayUtc) ?? {
        activePoolCount: 0,
        currentAttributedValueUsd: 0,
        totalRewardsUsd: 0,
        rewardValueUsd: 0,
      };

      const totalValueUsd = asNumber(point.totalValueUsd) ?? 0;
      const cumulativeRewardsUsd = asNumber(point.cumulativeRewardsUsd) ?? 0;
      const rewardValueUsd = asNumber(point.rewardValueUsd) ?? 0;

      bucket.currentAttributedValueUsd += totalValueUsd;
      bucket.totalRewardsUsd += cumulativeRewardsUsd;
      bucket.rewardValueUsd += rewardValueUsd;
      if (totalValueUsd > 0) {
        bucket.activePoolCount += 1;
      }

      buckets.set(point.dayUtc, bucket);
    }
  }

  const sortedDays = Array.from(buckets.keys()).sort((left, right) => left.localeCompare(right));
  return {
    activePoolCount: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.activePoolCount ?? 0),
    currentAttributedValueUsd: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.currentAttributedValueUsd ?? 0),
    totalRewardsUsd: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.totalRewardsUsd ?? 0),
    estimatedAnnualizedReturnPct: sortedDays.map((dayUtc) => {
      const bucket = buckets.get(dayUtc);
      if (!bucket || bucket.currentAttributedValueUsd <= 0) {
        return 0;
      }

      return (bucket.rewardValueUsd / bucket.currentAttributedValueUsd) * 365 * 100;
    }),
  };
}

function buildPositionTokens(input: {
  primaryTokenSymbol: unknown;
  secondaryTokenSymbol: unknown;
  primaryTokenAmount: unknown;
  secondaryTokenAmount: unknown;
  fallbackSymbols?: string[];
}) {
  const tokens: PoolPositionToken[] = [];
  const seen = new Set<string>();

  const appendToken = (symbol: unknown, amount: unknown) => {
    if (typeof symbol !== "string") {
      return;
    }

    const trimmed = symbol.trim();
    if (trimmed.length === 0) {
      return;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    tokens.push({
      symbol: trimmed,
      amount: asNumber(amount),
    });
  };

  appendToken(input.primaryTokenSymbol, input.primaryTokenAmount);
  appendToken(input.secondaryTokenSymbol, input.secondaryTokenAmount);

  if (tokens.length > 0) {
    return tokens;
  }

  for (const symbol of input.fallbackSymbols ?? []) {
    appendToken(symbol, null);

    if (tokens.length === 2) {
      break;
    }
  }

  return tokens;
}

function normalizeEngineV2PoolHistoryPoints(points: unknown[]) {
  return points
    .map((point) => asRecord(point))
    .map((point) => ({
      dayUtc: typeof point.dayUtc === "string" ? point.dayUtc : "",
      totalValueUsd: asNumber(point.totalValueUsd) ?? 0,
      deployedValueUsd: asNumber(point.deployedValueUsd) ?? 0,
      residualValueUsd: asNumber(point.residualValueUsd) ?? 0,
      manualValueUsd: asNumber(point.manualValueUsd) ?? 0,
      strategyValueUsd: asNumber(point.strategyValueUsd) ?? 0,
      rewardValueUsd: asNumber(point.rewardValueUsd) ?? 0,
      cumulativeRewardsUsd: asNumber(point.cumulativeRewardsUsd) ?? 0,
      capitalInUsd: asNumber(point.capitalInUsd) ?? 0,
      capitalOutUsd: asNumber(point.capitalOutUsd) ?? 0,
      metadata: asRecord(point.metadata),
    }))
    .filter((point) => point.dayUtc.length > 0)
    .sort((left, right) => left.dayUtc.localeCompare(right.dayUtc));
}

function normalizeEngineV2PoolTimelineItems(items: unknown[]) {
  return items
    .map((item) => asRecord(item))
    .map((item) => ({
      eventKey: typeof item.eventKey === "string" ? item.eventKey : typeof item.id === "string" ? item.id : "",
      eventType: typeof item.eventType === "string" ? item.eventType : "unknown",
      occurredAt: asDate(item.occurredAt),
      confidence: typeof item.confidence === "string" ? item.confidence : "unknown",
      coverageStatus: normalizeCoverageStatus(typeof item.coverageStatus === "string" ? item.coverageStatus : "unknown"),
      attributedValueUsd: asNumber(item.attributedValueUsd),
      metadataJson: asRecord(item.metadataJson ?? item.metadata),
      relatedDepositId: typeof item.relatedDepositId === "string" ? item.relatedDepositId : null,
      relatedStrategyId: typeof item.relatedStrategyId === "string" ? item.relatedStrategyId : null,
    }))
    .filter((item): item is {
      eventKey: string;
      eventType: string;
      occurredAt: Date;
      confidence: string;
      coverageStatus: PoolsListItem["coverageStatus"];
      attributedValueUsd: number | null;
      metadataJson: Record<string, unknown>;
      relatedDepositId: string | null;
      relatedStrategyId: string | null;
    } => item.eventKey.length > 0 && item.occurredAt instanceof Date)
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}


  const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

  function endOfDayUtc(dayUtc: string) {
    return new Date(`${dayUtc}T23:59:59.999Z`);
  }

  function deriveRewardPerformanceMetrics(input: {
    firstParticipatedAt: Date | null;
    lastParticipatedAt: Date | null;
    coveredEndDayUtc: string;
    status: PoolsListItem["status"];
    capitalInvestedUsd: number;
    totalRewardsUsd: number;
    annualizedReturnPct?: number | null;
  }) {
    if (!input.firstParticipatedAt) {
      return {
        investedDays: null,
        totalReturnPct: null,
        annualizedReturnPct: null,
      };
    }

    const coveredEndAt = endOfDayUtc(input.coveredEndDayUtc);
    const effectiveEndAt = input.status === "active"
      ? coveredEndAt
      : input.lastParticipatedAt && input.lastParticipatedAt.getTime() < coveredEndAt.getTime()
        ? input.lastParticipatedAt
        : coveredEndAt;
    const investedDays = Math.max((effectiveEndAt.getTime() - input.firstParticipatedAt.getTime()) / MILLISECONDS_PER_DAY, 1);

    if (input.capitalInvestedUsd <= 0) {
      return {
        investedDays,
        totalReturnPct: null,
        annualizedReturnPct: null,
      };
    }

    const totalReturnPct = (input.totalRewardsUsd / input.capitalInvestedUsd) * 100;
    const derivedAnnualizedReturnPct = totalReturnPct * (365 / investedDays);

    return {
      investedDays,
      totalReturnPct,
      annualizedReturnPct: input.annualizedReturnPct ?? derivedAnnualizedReturnPct,
    };
  }
function daysForRange(range: PoolDetailRange) {
  switch (range) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "180d":
      return 180;
    case "1y":
      return 365;
    case "covered":
      return null;
  }
}

export async function listPoolSummaries(input: {
  walletAddress: string;
  chainId: number;
}) {
  if (!engineV2ReadModelsEnabled()) return [];

  const engineV2Rows = await readEngineV2SurfaceRows<EngineV2PoolReadModelRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "pools",
  });
  return (engineV2Rows ?? [])
    .filter(hasVisibleEngineV2PoolExposure)
    .map(normalizeEngineV2PoolSummaryRow);
}

export async function readPoolSummarySeries(input: {
  walletAddress: string;
  chainId: number;
  poolIds: string[];
}) {
  if (input.poolIds.length === 0) {
    return emptyPoolSummarySeries();
  }
  if (!engineV2ReadModelsEnabled()) return emptyPoolSummarySeries();

  const engineV2Rows = await readEngineV2SurfaceRows<EngineV2PoolReadModelRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "pools",
  });
  return summarizeEngineV2PoolRows((engineV2Rows ?? []).filter((row) => input.poolIds.includes(row.poolId)));
}

export async function readPoolHistory(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
  range: PoolDetailRange;
}) {
  if (!engineV2ReadModelsEnabled()) return [];

  const engineV2Rows = await readEngineV2SurfaceRows<EngineV2PoolReadModelRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "pools",
  });
  const engineV2Pool = engineV2Rows?.find((row) => row.poolId === input.poolId);
  const sorted = normalizeEngineV2PoolHistoryPoints(engineV2Pool?.history?.points ?? []);
  const rangeDays = daysForRange(input.range);
  return rangeDays === null ? sorted : sorted.slice(-rangeDays);
}

export async function readPoolTimeline(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
}) {
  if (!engineV2ReadModelsEnabled()) return [];

  const engineV2Rows = await readEngineV2SurfaceRows<EngineV2PoolReadModelRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "pools",
  });
  const engineV2Pool = engineV2Rows?.find((row) => row.poolId === input.poolId);
  return normalizeEngineV2PoolTimelineItems(engineV2Pool?.timeline?.items ?? []);
}

export async function readPoolPositions(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
  fallbackTokenSymbols: string[];
}): Promise<PoolPositions> {
  if (!engineV2ReadModelsEnabled()) {
    return { manualDeposits: [], automatedStrategies: [] };
  }

  const engineV2Rows = await readEngineV2SurfaceRows<EngineV2PoolReadModelRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "pools",
  });
  const engineV2Pool = engineV2Rows?.find((row) => row.poolId === input.poolId);
  return {
    manualDeposits: Array.isArray(engineV2Pool?.positions?.manualDeposits)
      ? (engineV2Pool.positions.manualDeposits as PoolPositions["manualDeposits"])
        .filter((position) => position.status !== "closed")
      : [],
    automatedStrategies: Array.isArray(engineV2Pool?.positions?.automatedStrategies)
      ? engineV2Pool.positions.automatedStrategies as PoolPositions["automatedStrategies"]
      : [],
  };
}
