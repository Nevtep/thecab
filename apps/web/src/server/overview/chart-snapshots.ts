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
    totalValueUsd: string;
    deployedValueUsd: string | null;
    idleValueUsd: string | null;
    metadataJson: Record<string, unknown>;
  }>;
  currentPoint: {
    capturedAt: Date;
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
  };
}) {
  const snapshotCandidatesByBucket = new Map<string, {
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    score: number;
    capturedAtMs: number;
  }>();

  for (const row of input.snapshotRows) {
    const totalValueUsd = asNumber(row.totalValueUsd);
    const deployedValueUsd = asNumber(row.deployedValueUsd);
    const idleValueUsd = asNumber(row.idleValueUsd);

    if (totalValueUsd === null && deployedValueUsd === null && idleValueUsd === null) {
      continue;
    }

    const bucketTimestamp = toBucketTimestamp(row.capturedAt.toISOString(), input.granularity);
    const metadataJson = row.metadataJson ?? {};
    const score =
      (metadataJson.snapshotKind === "range_bucket" ? 8 : 0) +
      (metadataJson.range === input.range ? 4 : 0) +
      (row.deployedValueUsd !== null ? 3 : 0) +
      (row.idleValueUsd !== null ? 2 : 0) +
      (row.totalValueUsd !== null ? 1 : 0);
    const nextCandidate = {
      totalValueUsd,
      deployedValueUsd,
      idleValueUsd,
      score,
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
      score: Number.MAX_SAFE_INTEGER,
      capturedAtMs: input.currentPoint.capturedAt.getTime(),
    });
  }

  const snapshotValuesByBucket = new Map<string, {
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
  }>();

  for (const [bucketTimestamp, candidate] of snapshotCandidatesByBucket.entries()) {
    snapshotValuesByBucket.set(bucketTimestamp, {
      totalValueUsd: candidate.totalValueUsd,
      deployedValueUsd: candidate.deployedValueUsd,
      idleValueUsd: candidate.idleValueUsd,
    });
  }

  return snapshotValuesByBucket;
}