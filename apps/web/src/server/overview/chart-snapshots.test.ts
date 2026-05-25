import assert from "node:assert/strict";
import test from "node:test";

import { buildRewardValueLookup, buildSnapshotValueLookup, toBucketTimestamp } from "@/server/overview/chart-snapshots";

test("current point does not override an existing persisted bucket snapshot", () => {
  const existingBucketTimestamp = toBucketTimestamp("2026-05-25T00:00:00.000Z", "day");
  const lookup = buildSnapshotValueLookup({
    range: "7d",
    granularity: "day",
    snapshotRows: [
      {
        capturedAt: new Date("2026-05-25T00:00:00.000Z"),
        totalValueUsd: "1000",
        deployedValueUsd: "600",
        idleValueUsd: "400",
        metadataJson: {
          snapshotKind: "range_bucket",
          range: "7d",
          rewardValueUsd: 25,
        },
      },
    ],
    currentPoint: {
      capturedAt: new Date("2026-05-25T12:00:00.000Z"),
      totalValueUsd: 1700,
      deployedValueUsd: 1200,
      idleValueUsd: 500,
      rewardValueUsd: 10,
    },
  });

  assert.deepEqual(lookup.get(existingBucketTimestamp), {
    totalValueUsd: 1000,
    deployedValueUsd: 600,
    idleValueUsd: 400,
    rewardValueUsd: 25,
  });
});

test("current point seeds the bucket when no persisted snapshot exists", () => {
  const currentBucketTimestamp = toBucketTimestamp("2026-05-25T12:00:00.000Z", "day");
  const lookup = buildSnapshotValueLookup({
    range: "7d",
    granularity: "day",
    snapshotRows: [],
    currentPoint: {
      capturedAt: new Date("2026-05-25T12:00:00.000Z"),
      totalValueUsd: 1700,
      deployedValueUsd: 1200,
      idleValueUsd: 500,
      rewardValueUsd: 18,
    },
  });

  assert.deepEqual(lookup.get(currentBucketTimestamp), {
    totalValueUsd: 1700,
    deployedValueUsd: 1200,
    idleValueUsd: 500,
    rewardValueUsd: 18,
  });
});

test("buildRewardValueLookup buckets realized rewards by chart granularity", () => {
  const dailyLookup = buildRewardValueLookup({
    granularity: "day",
    rewardRows: [
      {
        occurredAt: new Date("2026-05-25T03:15:00.000Z"),
        amountUsd: "12.5",
      },
      {
        occurredAt: new Date("2026-05-25T17:45:00.000Z"),
        amountUsd: 7.5,
      },
      {
        occurredAt: new Date("2026-05-26T01:00:00.000Z"),
        amountUsd: null,
      },
    ],
  });

  assert.equal(dailyLookup.get("2026-05-25T00:00:00.000Z"), 20);
  assert.equal(dailyLookup.get("2026-05-26T00:00:00.000Z"), undefined);
});