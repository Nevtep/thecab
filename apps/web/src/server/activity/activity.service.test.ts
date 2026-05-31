import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivitySummary,
  buildLockedActivityResponse,
  buildReadyActivityResponse,
} from "@/server/activity/activity.service";
import type { ActivityEventRow, ActivityRequest } from "@/server/activity/activity.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const selectedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function request(overrides: Partial<ActivityRequest> = {}): ActivityRequest {
  return {
    walletAddress,
    chainId: 8453,
    search: "",
    surface: "all",
    action: "all",
    coverage: null,
    confidence: null,
    poolId: null,
    depositId: null,
    strategyId: null,
    rewardEventId: null,
    governanceEventId: null,
    selectedActivityId: null,
    sort: { key: "occurredAt", direction: "desc" },
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function row(overrides: Partial<ActivityEventRow> = {}): ActivityEventRow {
  return {
    activityId: selectedId,
    chainId: 8453,
    walletAddress,
    occurredAt: "2026-05-16T14:32:18.000Z",
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    externalTxUrl: "https://basescan.org/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    action: "claim",
    actionLabelKey: "activity:actions.claim",
    surface: "rewards",
    surfaceLabelKey: "activity:surfaces.rewards",
    coverage: "full",
    confidence: "high",
    confidenceScore: 5,
    valueUsd: "100.00",
    primaryTokenAddress: null,
    primaryTokenSymbol: null,
    summary: "Claim",
    reasonCodes: [],
    movements: [],
    linkedEntities: [],
    metadata: {},
    ...overrides,
  };
}

const readyAnalysis = {
  status: "ready" as const,
  coverage: "full",
  coverageReasons: [],
};

test("buildActivitySummary excludes excluded rows from non-excluded value", () => {
  const summary = buildActivitySummary([
    row({ valueUsd: "100.00", coverage: "full" }),
    row({ activityId: "excluded", valueUsd: "250.00", coverage: "excluded" }),
    row({ activityId: "unresolved", valueUsd: "50.00", coverage: "unresolved" }),
  ]);

  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.interpretedEvents, 1);
  assert.equal(summary.excludedEvents, 1);
  assert.equal(summary.unresolvedEvents, 1);
  assert.equal(summary.totalValueUsd, "150.00");
});

test("buildLockedActivityResponse preserves filters without fabricating rows", () => {
  const response = buildLockedActivityResponse(request({ surface: "strategies" }), {
    status: "queued",
    coverage: "unknown",
    coverageReasons: ["analysisPending"],
  });

  assert.equal(response.screenKind, "locked");
  assert.equal(response.events.pagination.totalRows, 0);
  assert.deepEqual(response.activeChips.map((chip) => chip.id), ["surface"]);
});

test("buildReadyActivityResponse selects requested row or falls back to first visible row", () => {
  const fallback = row({ activityId: "fallback", occurredAt: "2026-05-15T00:00:00.000Z" });
  const selected = row({ activityId: selectedId });
  const response = buildReadyActivityResponse({
    request: request({ selectedActivityId: selectedId }),
    analysis: readyAnalysis,
    repository: {
      allRows: [fallback, selected],
      rows: [fallback],
      totalRows: 2,
      availableFilters: { actions: ["claim"], surfaces: ["rewards"], tokens: [] },
    },
  });

  assert.equal(response.screenKind, "ready");
  assert.equal(response.selectedActivity?.activityId, selectedId);
  assert.equal(response.events.pagination.totalPages, 1);
});

test("buildReadyActivityResponse reports empty ready data separately from locked data", () => {
  const response = buildReadyActivityResponse({
    request: request(),
    analysis: readyAnalysis,
    repository: {
      allRows: [],
      rows: [],
      totalRows: 0,
      availableFilters: { actions: [], surfaces: [], tokens: [] },
    },
  });

  assert.equal(response.screenKind, "empty");
  assert.equal(response.selectedActivity, null);
});
