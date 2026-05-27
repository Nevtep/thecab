import assert from "node:assert/strict";
import test from "node:test";

import { resolveRunSliceDayWindow } from "@/server/analysis/analysis-slice.repository";

test("resolveRunSliceDayWindow derives the full inclusive run window from reverse-ordered slices", () => {
  const window = resolveRunSliceDayWindow([
    {
      sliceStartUtc: new Date("2026-02-26T00:00:00.000Z"),
      sliceEndUtc: new Date("2026-05-27T00:00:00.000Z"),
    },
    {
      sliceStartUtc: new Date("2025-11-28T00:00:00.000Z"),
      sliceEndUtc: new Date("2026-02-26T00:00:00.000Z"),
    },
    {
      sliceStartUtc: new Date("2025-05-26T00:00:00.000Z"),
      sliceEndUtc: new Date("2025-06-01T00:00:00.000Z"),
    },
  ], "2026-05-26");

  assert.deepEqual(window, {
    startDayUtc: "2025-05-26",
    endDayUtc: "2026-05-26",
  });
});

test("resolveRunSliceDayWindow falls back to the run day when no slices exist", () => {
  assert.deepEqual(resolveRunSliceDayWindow([], "2026-05-26"), {
    startDayUtc: "2026-05-26",
    endDayUtc: "2026-05-26",
  });
});