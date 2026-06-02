import type { OverviewRange } from "@/server/overview/overview.types";

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function floorDateToGranularity(input: Date, granularity: "hour" | "day") {
  const rounded = new Date(input);
  rounded.setUTCMinutes(0, 0, 0);

  if (granularity === "day") {
    rounded.setUTCHours(0, 0, 0, 0);
  }

  return rounded;
}

export function toBucketTimestamp(timestamp: string, granularity: "hour" | "day") {
  return floorDateToGranularity(new Date(timestamp), granularity).toISOString();
}

export function buildSnapshotValueLookup(input: {
  range: OverviewRange;
  granularity: "hour" | "day";
  snapshotRows: Array<{
    capturedAt: Date;
    totalValueUsd: string | null;
    deployedValueUsd: string | null;
    idleValueUsd: string | null;
    metadataJson: Record<string, unknown>;
  }>;
  currentPoint: {
    capturedAt: Date;
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    rewardValueUsd: number | null;
  };
}) {
  const snapshotCandidatesByBucket = new Map<string, {
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    rewardValueUsd: number | null;
    score: number;
    capturedAtMs: number;
  }>();

  function getSnapshotCandidateScore(row: {
    totalValueUsd: string | null;
    deployedValueUsd: string | null;
    idleValueUsd: string | null;
    metadataJson: Record<string, unknown>;
  }) {
    const metadataJson = row.metadataJson ?? {};
    const snapshotKind = typeof metadataJson.snapshotKind === "string" ? metadataJson.snapshotKind : null;

    return (
      (snapshotKind === "analysis_engine_daily" ? 32 : 0) +
      (metadataJson.source === "analyzed_history" ? 16 : 0) +
      (snapshotKind === "range_bucket" ? 8 : 0) +
      (metadataJson.range === input.range ? 4 : 0) +
      (row.deployedValueUsd !== null ? 3 : 0) +
      (row.idleValueUsd !== null ? 2 : 0) +
      (row.totalValueUsd !== null ? 1 : 0)
    );
  }

  for (const row of input.snapshotRows) {
    const totalValueUsd = asNumber(row.totalValueUsd);
    const deployedValueUsd = asNumber(row.deployedValueUsd);
    const idleValueUsd = asNumber(row.idleValueUsd);
    const rewardValueUsd = asNumber((row.metadataJson ?? {}).rewardValueUsd as string | number | null | undefined);

    if (totalValueUsd === null && deployedValueUsd === null && idleValueUsd === null) {
      continue;
    }

    const bucketTimestamp = toBucketTimestamp(row.capturedAt.toISOString(), input.granularity);
    const nextCandidate = {
      totalValueUsd,
      deployedValueUsd,
      idleValueUsd,
      rewardValueUsd,
      score: getSnapshotCandidateScore(row),
      capturedAtMs: row.capturedAt.getTime(),
    };
    const existingCandidate = snapshotCandidatesByBucket.get(bucketTimestamp);

    if (
      !existingCandidate ||
      nextCandidate.score > existingCandidate.score ||
      (nextCandidate.score === existingCandidate.score && nextCandidate.capturedAtMs > existingCandidate.capturedAtMs)
    ) {
      snapshotCandidatesByBucket.set(bucketTimestamp, nextCandidate);
    }
  }

  const currentBucketTimestamp = toBucketTimestamp(
    input.currentPoint.capturedAt.toISOString(),
    input.granularity,
  );

  if (!snapshotCandidatesByBucket.has(currentBucketTimestamp)) {
    snapshotCandidatesByBucket.set(currentBucketTimestamp, {
      totalValueUsd: input.currentPoint.totalValueUsd,
      deployedValueUsd: input.currentPoint.deployedValueUsd,
      idleValueUsd: input.currentPoint.idleValueUsd,
      rewardValueUsd: input.currentPoint.rewardValueUsd,
      score: Number.MAX_SAFE_INTEGER,
      capturedAtMs: input.currentPoint.capturedAt.getTime(),
    });
  }

  const snapshotValuesByBucket = new Map<string, {
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    rewardValueUsd: number | null;
  }>();

  for (const [bucketTimestamp, candidate] of snapshotCandidatesByBucket.entries()) {
    snapshotValuesByBucket.set(bucketTimestamp, {
      totalValueUsd: candidate.totalValueUsd,
      deployedValueUsd: candidate.deployedValueUsd,
      idleValueUsd: candidate.idleValueUsd,
      rewardValueUsd: candidate.rewardValueUsd,
    });
  }

  return snapshotValuesByBucket;
}

export function buildRewardValueLookup(input: {
  granularity: "hour" | "day";
  rewardRows: Array<{
    occurredAt: Date;
    amountUsd: string | number | null;
  }>;
}) {
  const rewardValuesByBucket = new Map<string, number>();

  for (const row of input.rewardRows) {
    const amountUsd = asNumber(row.amountUsd);
    if (amountUsd === null || amountUsd <= 0) {
      continue;
    }

    const bucketTimestamp = toBucketTimestamp(row.occurredAt.toISOString(), input.granularity);
    rewardValuesByBucket.set(bucketTimestamp, (rewardValuesByBucket.get(bucketTimestamp) ?? 0) + amountUsd);
  }

  return rewardValuesByBucket;
}