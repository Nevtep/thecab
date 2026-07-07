import assert from "node:assert/strict";
import test from "node:test";

import { densifyPoolHistoryPoints } from "@/server/pools/poolHistorySeries";

test("densifyPoolHistoryPoints fills covered days by carrying forward the last event-day state", () => {
  const dense = densifyPoolHistoryPoints({
    coveredStartDayUtc: "2026-01-01",
    coveredEndDayUtc: "2026-01-04",
    points: [
      {
        dayUtc: "2026-01-01",
        totalValueUsd: 100,
        deployedValueUsd: 100,
        residualValueUsd: 0,
        manualValueUsd: 100,
        strategyValueUsd: 0,
        rewardValueUsd: 0,
        cumulativeRewardsUsd: 0,
        capitalInUsd: 100,
        capitalOutUsd: 0,
        metadata: { valueBasis: "event_flows" },
      },
      {
        dayUtc: "2026-01-03",
        totalValueUsd: 90,
        deployedValueUsd: 90,
        residualValueUsd: 0,
        manualValueUsd: 90,
        strategyValueUsd: 0,
        rewardValueUsd: 5,
        cumulativeRewardsUsd: 5,
        capitalInUsd: 0,
        capitalOutUsd: 10,
        metadata: { valueBasis: "event_flows" },
      },
    ],
  });

  assert.deepEqual(
    dense.map((point) => [
      point.dayUtc,
      point.totalValueUsd,
      point.rewardValueUsd,
      point.capitalInUsd,
      point.capitalOutUsd,
      point.metadata.seriesProjection,
    ]),
    [
      ["2026-01-01", 100, 0, 100, 0, "daily_event_close"],
      ["2026-01-02", 100, 0, 0, 0, "daily_carry_forward"],
      ["2026-01-03", 90, 5, 0, 10, "daily_event_close"],
      ["2026-01-04", 90, 0, 0, 0, "daily_carry_forward"],
    ],
  );
});