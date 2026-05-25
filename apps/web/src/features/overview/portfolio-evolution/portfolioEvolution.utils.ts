import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";

export type PortfolioEvolutionEventType =
  | "claim"
  | "rebalance"
  | "move_to_idle"
  | "redeploy"
  | "lock"
  | "vote";

export type PortfolioEvolutionMarker = {
  id: string;
  type: PortfolioEvolutionEventType;
  occurredAt: string;
  capturedAt: string;
  classification: string | null;
  detail: string | null;
  txHash: string | null;
};

export type PortfolioEvolutionDatum = {
  capturedAt: string;
  axisLabel: string;
  totalValueUsd: number | null;
  deployedValueUsd: number | null;
  idleValueUsd: number | null;
  rewardValueUsd: number | null;
  cumulativeRewardValueUsd: number | null;
  markerAnchorValueUsd: number | null;
  events: PortfolioEvolutionMarker[];
};

export type PortfolioEvolutionSummary = {
  initialValueUsd: number | null;
  finalValueUsd: number | null;
  absoluteChangeUsd: number | null;
  changePct: number | null;
  accumulatedRewardsUsd: number | null;
  detectedRebalanceCount: number;
};

export type PortfolioEvolutionFooterStats = {
  accumulatedRewardsUsd: number | null;
  capitalMovedBetweenStatesUsd: number | null;
  latestEvent: PortfolioEvolutionMarker | null;
  maxIdleValueUsd: number | null;
  markerCount: number;
};

export type PortfolioEvolutionModel = {
  data: PortfolioEvolutionDatum[];
  summary: PortfolioEvolutionSummary;
  footer: PortfolioEvolutionFooterStats;
  availableEventTypes: PortfolioEvolutionEventType[];
};

function roundUsd(value: number) {
  return Number(value.toFixed(2));
}

function toBucketTimestamp(timestamp: string, range: OverviewRange) {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);

  if (range !== "24h") {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

export function formatPortfolioEvolutionBucketLabel(timestamp: string, range: OverviewRange, locale: string) {
  const date = new Date(timestamp);

  if (range === "24h") {
    return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(date);
  }

  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function formatPortfolioEvolutionBucketTimestamp(timestamp: string, range: OverviewRange, locale: string) {
  const date = new Date(timestamp);

  if (range === "24h") {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function buildMarkerBucketsFromChartEvents(
  events: OverviewViewModel["chart"]["events"],
) {
  const markerBuckets = new Map<string, PortfolioEvolutionMarker[]>();
  const rewardValueByBucket = new Map<string, number>();

  for (const event of events) {
    const nextMarker: PortfolioEvolutionMarker = {
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      capturedAt: event.capturedAt,
      classification: event.type,
      detail: event.detail,
      txHash: event.txHash,
    };

    markerBuckets.set(event.capturedAt, [...(markerBuckets.get(event.capturedAt) ?? []), nextMarker]);
    if ((event.rewardValueUsd ?? 0) > 0) {
      rewardValueByBucket.set(
        event.capturedAt,
        roundUsd((rewardValueByBucket.get(event.capturedAt) ?? 0) + (event.rewardValueUsd ?? 0)),
      );
    }
  }

  return {
    markerBuckets,
    rewardValueByBucket,
  };
}

function mapActivityItemToEventType(
  item: OverviewViewModel["activity"]["items"][number],
): PortfolioEvolutionEventType | null {
  if (item.classification === "claim") {
    return "claim";
  }

  if (item.classification === "rebalance") {
    return "rebalance";
  }

  if (item.classification === "deposit" || item.classification === "stake") {
    return "redeploy";
  }

  if (item.classification === "withdraw" || item.classification === "unstake") {
    return "move_to_idle";
  }

  if (item.classification === "governance") {
    const text = `${item.eventType} ${item.detail ?? ""}`.toLowerCase();
    if (text.includes("vote")) {
      return "vote";
    }

    if (text.includes("lock")) {
      return "lock";
    }
  }

  return null;
}

function calculateCapitalMovedBetweenStatesUsd(data: PortfolioEvolutionDatum[]) {
  let totalMovedUsd = 0;

  for (let index = 1; index < data.length; index += 1) {
    const previous = data[index - 1];
    const current = data[index];

    if (
      previous?.deployedValueUsd === null ||
      previous?.idleValueUsd === null ||
      current.deployedValueUsd === null ||
      current.idleValueUsd === null
    ) {
      continue;
    }

    const deployedDelta = current.deployedValueUsd - previous.deployedValueUsd;
    const idleDelta = current.idleValueUsd - previous.idleValueUsd;

    if (deployedDelta === 0 || idleDelta === 0) {
      continue;
    }

    if (Math.sign(deployedDelta) === Math.sign(idleDelta)) {
      continue;
    }

    totalMovedUsd += Math.min(Math.abs(deployedDelta), Math.abs(idleDelta));
  }

  return totalMovedUsd > 0 ? totalMovedUsd : null;
}

export function buildPortfolioEvolutionModel(input: {
  viewModel: Pick<OverviewViewModel, "chart" | "metrics">;
  activity: OverviewViewModel["activity"] | null;
  range: OverviewRange;
  locale: string;
}): PortfolioEvolutionModel {
  const points = [...input.viewModel.chart.points].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt),
  );

  const explicitChartEvents = input.viewModel.chart.events ?? [];
  const markerBuckets = new Map<string, PortfolioEvolutionMarker[]>();
  const rewardValueByBucket = new Map<string, number>();

  if (explicitChartEvents.length > 0) {
    const explicitBuckets = buildMarkerBucketsFromChartEvents(explicitChartEvents);
    for (const [capturedAt, bucketMarkers] of explicitBuckets.markerBuckets.entries()) {
      markerBuckets.set(capturedAt, bucketMarkers);
    }
    for (const [capturedAt, rewardValueUsd] of explicitBuckets.rewardValueByBucket.entries()) {
      rewardValueByBucket.set(capturedAt, rewardValueUsd);
    }
  } else {
    for (const item of input.activity?.items ?? []) {
      const type = mapActivityItemToEventType(item);
      if (!type) {
        continue;
      }

      const capturedAt = toBucketTimestamp(item.occurredAt, input.range);
      const nextMarker: PortfolioEvolutionMarker = {
        id: item.id,
        type,
        occurredAt: item.occurredAt,
        capturedAt,
        classification: item.classification,
        detail: item.detail,
        txHash: item.txHash,
      };

      markerBuckets.set(capturedAt, [...(markerBuckets.get(capturedAt) ?? []), nextMarker]);
    }
  }

  const hasKnownRewardsSeries =
    input.viewModel.metrics.estimatedRealizedRewardsUsd !== null ||
    input.viewModel.chart.hasRewardMarkers ||
    points.some((point) => point.rewardValueUsd !== null) ||
    explicitChartEvents.some((event) => event.rewardValueUsd !== null);

  let cumulativeRewardValueUsd = 0;
  const data: PortfolioEvolutionDatum[] = points.map((point) => {
    const fallbackRewardValueUsd = rewardValueByBucket.get(point.capturedAt) ?? null;
    const resolvedRewardValueUsd =
      point.rewardValueUsd !== null && point.rewardValueUsd > 0
        ? point.rewardValueUsd
        : fallbackRewardValueUsd;
    const rewardValueUsd = resolvedRewardValueUsd ?? (hasKnownRewardsSeries ? 0 : null);
    cumulativeRewardValueUsd = roundUsd(cumulativeRewardValueUsd + (rewardValueUsd ?? 0));
    const events = markerBuckets.get(point.capturedAt) ?? [];
    const markerAnchorValueUsd = Math.max(
      point.totalValueUsd ?? 0,
      point.deployedValueUsd ?? 0,
      point.idleValueUsd ?? 0,
    );

    return {
      capturedAt: point.capturedAt,
      axisLabel: formatPortfolioEvolutionBucketLabel(point.capturedAt, input.range, input.locale),
      totalValueUsd: point.totalValueUsd,
      deployedValueUsd: point.deployedValueUsd,
      idleValueUsd: point.idleValueUsd,
      rewardValueUsd,
      cumulativeRewardValueUsd: hasKnownRewardsSeries ? cumulativeRewardValueUsd : null,
      markerAnchorValueUsd: markerAnchorValueUsd > 0 ? markerAnchorValueUsd : null,
      events,
    };
  });

  const firstPoint = data.find((point) => point.totalValueUsd !== null) ?? null;
  const finalPoint = [...data].reverse().find((point) => point.totalValueUsd !== null) ?? null;
  const initialValueUsd = firstPoint?.totalValueUsd ?? null;
  const finalValueUsd = finalPoint?.totalValueUsd ?? null;
  const absoluteChangeUsd =
    initialValueUsd !== null && finalValueUsd !== null
      ? finalValueUsd - initialValueUsd
      : null;
  const changePct =
    absoluteChangeUsd !== null && initialValueUsd !== null && initialValueUsd > 0
      ? absoluteChangeUsd / initialValueUsd
      : null;
  const derivedRewardsUsd = roundUsd(data.reduce((sum, point) => sum + (point.rewardValueUsd ?? 0), 0));
  const accumulatedRewardsUsd = input.viewModel.metrics.estimatedRealizedRewardsUsd === null
    ? derivedRewardsUsd
    : roundUsd(Math.max(input.viewModel.metrics.estimatedRealizedRewardsUsd, derivedRewardsUsd));
  const detectedRebalanceCount = data
    .flatMap((point) => point.events)
    .filter((event) => event.type === "rebalance").length;

  const allMarkers = data
    .flatMap((point) => point.events)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return {
    data,
    summary: {
      initialValueUsd,
      finalValueUsd,
      absoluteChangeUsd,
      changePct,
      accumulatedRewardsUsd,
      detectedRebalanceCount,
    },
    footer: {
      accumulatedRewardsUsd,
      capitalMovedBetweenStatesUsd: calculateCapitalMovedBetweenStatesUsd(data),
      latestEvent: allMarkers.at(-1) ?? null,
      maxIdleValueUsd: data.reduce<number | null>((maxValue, point) => {
        if (point.idleValueUsd === null) {
          return maxValue;
        }

        return maxValue === null ? point.idleValueUsd : Math.max(maxValue, point.idleValueUsd);
      }, null),
      markerCount: allMarkers.length,
    },
    availableEventTypes: Array.from(new Set(allMarkers.map((marker) => marker.type))),
  };
}