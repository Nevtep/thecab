import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategyReadModelRows,
  deriveStrategyCoverageReasonCodes,
  deriveStrategyStatus,
} from "@/server/analysis/strategy-read-models";

test("buildStrategyReadModelRows creates summaries and history without manual deposit reward leakage", () => {
  const rows = buildStrategyReadModelRows({
    runId: "run-1",
    walletAddress: "0xABC",
    chainId: 8453,
    startDayUtc: "2026-05-20",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T12:00:00.000Z"),
    exposures: [
      {
        strategyId: "strategy-1",
        strategyExposureId: "exposure-1",
        primaryPoolId: "pool-1",
        poolLabel: "WETH / cbBTC CL 100",
        strategyLabel: "WETH / cbBTC-100",
        protocol: "mellow",
        wrapperAddress: "0xwrap000000000000000000000000000000000001",
        stakingRewardsAddress: "0xstake00000000000000000000000000000000001",
        sharesRaw: "1842371",
        underlying0AmountRaw: "1",
        underlying1AmountRaw: "2",
        coverageStatus: "share_level",
        strategyMetadataJson: {},
        exposureMetadataJson: {
          valueUsd: 298889.15,
          externalDepositReference: "71496797",
          externalDepositReferenceStatus: "resolved",
          shareSymbol: "mlWETHcbBTC",
        },
      },
    ],
    rewards: [
      {
        id: "reward-strategy",
        strategyExposureId: "exposure-1",
        amountUsd: "340.21",
        resolutionStatus: "resolved",
      },
      {
        id: "reward-manual-deposit",
        strategyExposureId: null,
        amountUsd: "9999.99",
        resolutionStatus: "resolved",
      },
    ],
  });

  assert.equal(rows.summaries.length, 1);
  assert.equal(rows.summaries[0]?.walletAddress, "0xabc");
  assert.equal(rows.summaries[0]?.totalRewardsUsd, "340.21");
  assert.equal(rows.summaries[0]?.resolvedRewardCount, 1);
  assert.equal(rows.summaries[0]?.currentEstimatedValueUsd, "298889.15");
  assert.deepEqual(rows.summaries[0]?.coverageReasonCodes, ["shareLevelAccounting"]);
  assert.equal(rows.history.length, 1);
  assert.equal(rows.history[0]?.estimatedValueUsd, "298889.15");
});

test("deriveStrategyStatus keeps unresolved share evidence visible", () => {
  assert.equal(deriveStrategyStatus("100"), "active");
  assert.equal(deriveStrategyStatus("0"), "closed");
  assert.equal(deriveStrategyStatus(null), "unknown");
});

test("deriveStrategyCoverageReasonCodes does not fabricate missing coverage", () => {
  assert.deepEqual(deriveStrategyCoverageReasonCodes({
    coverageStatus: "full",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "1",
  }), []);
  assert.deepEqual(deriveStrategyCoverageReasonCodes({
    coverageStatus: "partial",
    poolMappingStatus: "unknown",
    externalReferenceStatus: "unresolved",
    currentEstimatedValueUsd: null,
  }), [
    "missingShareValuation",
    "poolMappingUnknown",
    "externalStrategyReferenceUnresolved",
  ]);
});

