import assert from "node:assert/strict";
import test from "node:test";

import { mapActivityResponseToViewModel } from "@/features/activity/activity.mappers";
import type { ActivityViewModel } from "@/features/activity/activity.types";

function response(overrides: Partial<ActivityViewModel> = {}): ActivityViewModel {
  return {
    screenKind: "ready",
    walletAddress: "0xABC0000000000000000000000000000000000000",
    chainId: 8453,
    analysis: { status: "ready", coverage: "full", coverageReasons: [] },
    summary: {
      totalEvents: 2,
      interpretedEvents: 1,
      totalValueUsd: "100.00",
      walletCapitalInUsd: "0.00",
      walletCapitalOutUsd: "0.00",
      protocolVolumeUsd: "100.00",
      excludedEvents: 1,
      unresolvedEvents: 0,
      coveragePercent: "50.0",
    },
    kpis: [],
    charts: {
      timeline: [],
      actionBreakdown: [],
      coverageBreakdown: [],
      surfaceBreakdown: [],
      movementBreakdown: [],
    },
    events: {
      rows: [
        { activityId: "old", chainId: 8453, walletAddress: "0xabc", occurredAt: "2026-05-15T00:00:00.000Z", txHash: null, externalTxUrl: null, action: "claim", actionLabelKey: "activity:actions.claim", surface: "rewards", surfaceLabelKey: "activity:surfaces.rewards", coverage: "full", confidence: "high", confidenceScore: 5, valueUsd: "1.00", primaryTokenAddress: null, primaryTokenSymbol: null, summary: "old", reasonCodes: [], movements: [], linkedEntities: [], metadata: {} },
        { activityId: "new", chainId: 8453, walletAddress: "0xabc", occurredAt: "2026-05-16T00:00:00.000Z", txHash: null, externalTxUrl: null, action: "claim", actionLabelKey: "activity:actions.claim", surface: "rewards", surfaceLabelKey: "activity:surfaces.rewards", coverage: "full", confidence: "high", confidenceScore: 5, valueUsd: "1.00", primaryTokenAddress: null, primaryTokenSymbol: null, summary: "new", reasonCodes: [], movements: [], linkedEntities: [], metadata: {} },
      ],
      pagination: { page: 1, pageSize: 25, totalRows: 2, totalPages: 1 },
    },
    selectedActivity: null,
    availableFilters: { actions: ["claim"], surfaces: ["rewards"], tokens: [] },
    activeChips: [],
    ...overrides,
  };
}

test("mapActivityResponseToViewModel normalizes wallet and preserves server row order", () => {
  const viewModel = mapActivityResponseToViewModel(response());
  assert.equal(viewModel.walletAddress, "0xabc0000000000000000000000000000000000000");
  assert.deepEqual(viewModel.events.rows.map((row) => row.activityId), ["old", "new"]);
});
