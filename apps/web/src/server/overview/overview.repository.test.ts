import assert from "node:assert/strict";
import test from "node:test";

import { sumAnalyzedOverviewRewardTotals } from "@/server/overview/getRecentOverview";
import {
  mergeAnalyzedPerformanceSnapshotRows,
  shouldExcludeLedgerEventFromOverviewUi,
  shouldPreserveAnalyzedPortfolioSnapshot,
} from "@/server/overview/overview.repository";

test("sumAnalyzedOverviewRewardTotals aggregates analyzed reward rows and excludes fee claims", () => {
  assert.equal(sumAnalyzedOverviewRewardTotals([
    { usdValueAtClaim: 1200.5, rewardType: "strategy_reward", owner: { status: "strategy" } },
    { usdValueAtClaim: "300", rewardType: "manual_reward", owner: { status: "manual_deposit" } },
    { usdValueAtClaim: 999999, rewardType: "fee_claim", owner: { status: "manual_deposit" } },
    { usdValueAtClaim: 42, rewardType: "governance_fee", owner: { status: "governance" } },
  ]), 1500.5);
});

test("sumAnalyzedOverviewRewardTotals returns null when no analyzed reward rows exist", () => {
  assert.equal(sumAnalyzedOverviewRewardTotals(null), null);
});

test("mergeAnalyzedPerformanceSnapshotRows prefers analyzed idle scope values for daily snapshots", () => {
  const rows = mergeAnalyzedPerformanceSnapshotRows([
    {
      capturedAt: new Date("2026-05-20T00:00:00.000Z"),
      scope: "portfolio",
      valueUsd: "330624.03",
      metadataJson: {
        idleValueUsd: "9000",
        rewardValueUsd: 11527.44,
      },
    },
    {
      capturedAt: new Date("2026-05-20T00:00:00.000Z"),
      scope: "idle",
      valueUsd: "14781.61",
      metadataJson: {
        tokens: [{ tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO" }],
      },
    },
  ]);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    capturedAt: new Date("2026-05-20T00:00:00.000Z"),
    totalValueUsd: "330624.03",
    deployedValueUsd: "315842.42",
    idleValueUsd: "14781.61",
    metadataJson: {
      idleValueUsd: "9000",
      rewardValueUsd: 11527.44,
      idleTokens: [{ tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO" }],
      snapshotKind: "analysis_engine_daily",
      source: "analyzed_history",
    },
  });
});

test("shouldPreserveAnalyzedPortfolioSnapshot keeps analysis snapshots from recent overwrite", () => {
  assert.equal(shouldPreserveAnalyzedPortfolioSnapshot({
    existingMetadataJson: { snapshotKind: "analysis_engine_daily" },
    nextMetadataJson: { snapshotKind: "range_bucket" },
  }), true);
  assert.equal(shouldPreserveAnalyzedPortfolioSnapshot({
    existingMetadataJson: { snapshotKind: "range_bucket" },
    nextMetadataJson: { snapshotKind: "analysis_engine_daily" },
  }), false);
});

test("shouldExcludeLedgerEventFromOverviewUi hides suspicious phishing transfer rows by default", () => {
  assert.equal(shouldExcludeLedgerEventFromOverviewUi({ excludeFromUiDefault: true }), true);
  assert.equal(shouldExcludeLedgerEventFromOverviewUi({ excludeFromUiDefault: false }), false);
  assert.equal(shouldExcludeLedgerEventFromOverviewUi({}), false);
});