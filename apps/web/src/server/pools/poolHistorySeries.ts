type PoolHistoryPointLike = {
  dayUtc: string;
  totalValueUsd: number;
  deployedValueUsd: number;
  residualValueUsd: number;
  manualValueUsd: number;
  strategyValueUsd: number;
  rewardValueUsd: number;
  cumulativeRewardsUsd: number;
  capitalInUsd: number;
  capitalOutUsd: number;
  metadata: Record<string, unknown>;
};

export type DensePoolHistoryPoint = PoolHistoryPointLike;

function dayUtcToTime(dayUtc: string) {
  return Date.parse(`${dayUtc}T00:00:00.000Z`);
}

function isValidDayUtc(dayUtc: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayUtc) && !Number.isNaN(dayUtcToTime(dayUtc));
}

function nextDayUtc(dayUtc: string) {
  const date = new Date(`${dayUtc}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function clonePoint(point: PoolHistoryPointLike): DensePoolHistoryPoint {
  return {
    dayUtc: point.dayUtc,
    totalValueUsd: point.totalValueUsd,
    deployedValueUsd: point.deployedValueUsd,
    residualValueUsd: point.residualValueUsd,
    manualValueUsd: point.manualValueUsd,
    strategyValueUsd: point.strategyValueUsd,
    rewardValueUsd: point.rewardValueUsd,
    cumulativeRewardsUsd: point.cumulativeRewardsUsd,
    capitalInUsd: point.capitalInUsd,
    capitalOutUsd: point.capitalOutUsd,
    metadata: { ...point.metadata },
  };
}

function carryForwardPoint(point: PoolHistoryPointLike, dayUtc: string): DensePoolHistoryPoint {
  return {
    dayUtc,
    totalValueUsd: point.totalValueUsd,
    deployedValueUsd: point.deployedValueUsd,
    residualValueUsd: point.residualValueUsd,
    manualValueUsd: point.manualValueUsd,
    strategyValueUsd: point.strategyValueUsd,
    rewardValueUsd: 0,
    cumulativeRewardsUsd: point.cumulativeRewardsUsd,
    capitalInUsd: 0,
    capitalOutUsd: 0,
    metadata: {
      ...point.metadata,
      seriesProjection: "daily_carry_forward",
    },
  };
}

export function densifyPoolHistoryPoints(input: {
  points: PoolHistoryPointLike[];
  coveredStartDayUtc?: string | null;
  coveredEndDayUtc?: string | null;
}) {
  const sortedPoints = input.points
    .filter((point) => isValidDayUtc(point.dayUtc))
    .sort((left, right) => left.dayUtc.localeCompare(right.dayUtc));

  if (sortedPoints.length === 0) {
    return [] as DensePoolHistoryPoint[];
  }

  const startDayUtc = input.coveredStartDayUtc && isValidDayUtc(input.coveredStartDayUtc)
    ? input.coveredStartDayUtc
    : sortedPoints[0].dayUtc;
  const endDayUtc = input.coveredEndDayUtc && isValidDayUtc(input.coveredEndDayUtc)
    ? input.coveredEndDayUtc
    : sortedPoints[sortedPoints.length - 1].dayUtc;

  if (startDayUtc > endDayUtc) {
    return sortedPoints.map(clonePoint);
  }

  const pointByDay = new Map(sortedPoints.map((point) => [point.dayUtc, point] as const));
  const densePoints: DensePoolHistoryPoint[] = [];
  let cursorDayUtc = startDayUtc;
  let lastKnownPoint: PoolHistoryPointLike | null = null;

  while (cursorDayUtc <= endDayUtc) {
    const exactPoint = pointByDay.get(cursorDayUtc) ?? null;
    if (exactPoint) {
      const projectedPoint = clonePoint(exactPoint);
      projectedPoint.metadata = {
        ...projectedPoint.metadata,
        seriesProjection: "daily_event_close",
      };
      densePoints.push(projectedPoint);
      lastKnownPoint = projectedPoint;
    } else if (lastKnownPoint) {
      densePoints.push(carryForwardPoint(lastKnownPoint, cursorDayUtc));
    }

    cursorDayUtc = nextDayUtc(cursorDayUtc);
  }

  return densePoints;
}