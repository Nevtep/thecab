import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategyReadModelRows,
  deriveStrategyConfidence,
  deriveStrategyCoverageReasonCodes,
  deriveStrategyCoverageStatus,
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
        isAccrualSnapshot: false,
        resolutionStatus: "resolved",
      },
      {
        id: "reward-accrual-snapshot",
        strategyExposureId: "exposure-1",
        amountUsd: "999.99",
        isAccrualSnapshot: true,
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
  assert.equal(rows.summaries[0]?.coverageStatus, "share_level");
  assert.deepEqual(rows.summaries[0]?.coverageReasonCodes, ["shareLevelAccounting"]);
  assert.equal(rows.history.length, 1);
  assert.equal(rows.history[0]?.estimatedValueUsd, "298889.15");
});

test("buildStrategyReadModelRows creates ordered lifecycle rows from explicit evidence and strategy rewards", () => {
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
          lifecycleEvents: [
            {
              eventType: "strategy_share_receive",
              occurredAt: "2026-05-20T19:46:00.000Z",
              txHash: "0xshare",
              logIndex: 4,
              shareDeltaRaw: "1842371",
              confidence: "high",
              coverageStatus: "share_level",
              tokenDeltas: [{ direction: "in", amountRaw: "1842371", symbol: "mlWETHcbBTC" }],
            },
            {
              eventType: "strategy_deposit",
              occurredAt: "2026-05-20T19:45:00.000Z",
              txHash: "0xdeposit",
              logIndex: 2,
              usdValue: "279958.69",
              confidence: "high",
              coverageStatus: "share_level",
            },
          ],
        },
      },
    ],
    rewards: [
      {
        id: "reward-resolved",
        strategyExposureId: "exposure-1",
        tokenAddress: "0xweth",
        amountRaw: "124300000000000000",
        amountUsd: "340.21",
        occurredAt: "2026-05-24T10:21:00.000Z",
        txHash: "0xclaim",
        logIndex: 9,
        resolutionStatus: "resolved",
        metadataJson: { tokenSymbol: "WETH", amountFormatted: "0.1243", priceSource: "alchemyHistorical" },
      },
      {
        id: "reward-unresolved",
        strategyExposureId: "exposure-1",
        tokenAddress: "0xaero",
        amountRaw: "128470000000000000000",
        amountUsd: "98.76",
        occurredAt: "2026-05-25T06:13:00.000Z",
        txHash: "0xunresolved",
        logIndex: 1,
        resolutionStatus: "unresolved",
        resolutionReasonCodes: ["externalStrategyReferenceUnresolved"],
        metadataJson: { tokenSymbol: "AERO", amountFormatted: "128.47" },
      },
    ],
  });

  assert.deepEqual(rows.lifecycle.map((row) => row.eventType), [
    "strategy_deposit",
    "strategy_share_receive",
    "strategy_claim",
    "unresolved_strategy_reward",
  ]);
  assert.deepEqual(rows.lifecycle.map((row) => row.sequenceIndex), [1, 2, 3, 4]);
  assert.equal(rows.lifecycle[2]?.sourceRewardEventId, "reward-resolved");
  assert.equal(rows.lifecycle[2]?.txHash, "0xclaim");
  const rewardTokenDeltas = rows.lifecycle[2]?.tokenDeltasJson as Array<{ symbol?: string }> | undefined;
  const rewardTokenDelta = rewardTokenDeltas?.[0];
  assert.equal(rewardTokenDelta?.symbol, "WETH");
  assert.equal(rows.lifecycle[3]?.coverageStatus, "partial");
  assert.deepEqual(rows.lifecycle[3]?.coverageReasonCodes, [
    "unresolvedStrategyReward",
    "externalStrategyReferenceUnresolved",
  ]);
});

test("buildStrategyReadModelRows rolls unresolved strategy evidence into summary coverage", () => {
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
        coverageStatus: "full",
        strategyMetadataJson: {},
        exposureMetadataJson: {
          valueUsd: 298889.15,
          externalDepositReferenceStatus: "resolved",
        },
      },
    ],
    rewards: [
      {
        id: "reward-unresolved",
        strategyExposureId: "exposure-1",
        amountUsd: "98.76",
        resolutionStatus: "unresolved",
        resolutionReasonCodes: ["externalStrategyReferenceUnresolved"],
      },
    ],
  });

  assert.equal(rows.summaries[0]?.coverageStatus, "partial");
  assert.equal(rows.summaries[0]?.confidence, "degraded");
  assert.deepEqual(rows.summaries[0]?.coverageReasonCodes, [
    "incompleteInternalActivity",
    "unresolvedStrategyReward",
    "externalStrategyReferenceUnresolved",
  ]);
  assert.equal(rows.summaries[0]?.totalRewardsUsd, "0");
  assert.equal(rows.summaries[0]?.unresolvedRewardCount, 1);
});

test("deriveStrategyStatus keeps unresolved share evidence visible", () => {
  assert.equal(deriveStrategyStatus("100"), "active");
  assert.equal(deriveStrategyStatus("0"), "closed");
  assert.equal(deriveStrategyStatus(null), "unknown");
});

test("deriveStrategyCoverageReasonCodes does not fabricate missing coverage", () => {
  assert.deepEqual(deriveStrategyCoverageReasonCodes({
    coverageStatus: "full",
    baseCoverageStatus: "full",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "1",
    unresolvedRewardCount: 0,
  }), []);
  assert.deepEqual(deriveStrategyCoverageReasonCodes({
    coverageStatus: "partial",
    baseCoverageStatus: "partial",
    poolMappingStatus: "unknown",
    externalReferenceStatus: "unresolved",
    currentEstimatedValueUsd: null,
    unresolvedRewardCount: 1,
  }), [
    "incompleteInternalActivity",
    "missingShareValuation",
    "poolMappingUnknown",
    "externalStrategyReferenceUnresolved",
    "unresolvedStrategyReward",
  ]);
});

test("deriveStrategyCoverageStatus degrades only when evidence is missing or unresolved", () => {
  assert.equal(deriveStrategyCoverageStatus({
    baseCoverageStatus: "full",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "42",
    unresolvedRewardCount: 0,
  }), "full");
  assert.equal(deriveStrategyCoverageStatus({
    baseCoverageStatus: "share_level",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "42",
    unresolvedRewardCount: 0,
  }), "share_level");
  assert.equal(deriveStrategyCoverageStatus({
    baseCoverageStatus: "full",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "42",
    unresolvedRewardCount: 1,
  }), "partial");
  assert.equal(deriveStrategyCoverageStatus({
    baseCoverageStatus: "full",
    poolMappingStatus: "unknown",
    externalReferenceStatus: "unresolved",
    currentEstimatedValueUsd: null,
    unresolvedRewardCount: 0,
  }), "partial");
  assert.equal(deriveStrategyCoverageStatus({
    baseCoverageStatus: "unknown",
    poolMappingStatus: "confirmed",
    externalReferenceStatus: "resolved",
    currentEstimatedValueUsd: "42",
    unresolvedRewardCount: 0,
  }), "unknown");
});

test("deriveStrategyConfidence follows coverage precision", () => {
  assert.equal(deriveStrategyConfidence("full"), "high");
  assert.equal(deriveStrategyConfidence("share_level"), "medium");
  assert.equal(deriveStrategyConfidence("partial"), "degraded");
  assert.equal(deriveStrategyConfidence("unknown"), "unknown");
});
