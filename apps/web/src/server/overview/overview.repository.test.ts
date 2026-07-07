import assert from "node:assert/strict";
import test from "node:test";

import { sumAnalyzedOverviewRewardTotals } from "@/server/overview/getRecentOverview";
import {
  buildOverviewDeployedSnapshotsFromEngineV2,
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

test("buildOverviewDeployedSnapshotsFromEngineV2 seeds balances from events before the requested range", () => {
  const rows = buildOverviewDeployedSnapshotsFromEngineV2({
    depositRows: [
      {
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: null,
        lifecycle: [
          {
            id: "deposit-1",
            sequenceIndex: 0,
            eventType: "mint_position",
            occurredAt: "2026-01-01T12:00:00.000Z",
            txHash: "0x1",
            logIndex: 0,
            blockNumber: 0,
            usdValue: 200,
            signedTokenDeltas: [
              {
                tokenAddress: "0x4200000000000000000000000000000000000006",
                symbol: "WETH",
                direction: "out",
                amountRaw: "1000000000000000000",
                amountFormatted: "1",
                usdValue: 200,
                priceSource: "event",
              },
            ],
            priceSource: "event",
            confidence: "high",
            inferredActionId: null,
            coverageReasonCodes: [],
            metadata: {},
          },
        ],
      },
    ],
    strategyRows: [],
    priceRows: [
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        priceUsd: "200",
        pricedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    startAt: new Date("2026-01-15T00:00:00.000Z"),
    endAt: new Date("2026-01-20T00:00:00.000Z"),
  });

  assert.equal(rows.at(0)?.deployedValueUsd, "200");
  assert.equal(rows.at(-1)?.deployedValueUsd, "200");
  assert.deepEqual(rows.at(-1)?.metadataJson.underlyingTokenBalances, [
    {
      tokenAddress: "0x4200000000000000000000000000000000000006",
      amount: 1,
      valueUsd: 200,
    },
  ]);
});

test("buildOverviewDeployedSnapshotsFromEngineV2 can reverse-walk from current balances", () => {
  const rows = buildOverviewDeployedSnapshotsFromEngineV2({
    depositRows: [
      {
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: null,
        lifecycle: [
          {
            id: "deposit-1",
            sequenceIndex: 0,
            eventType: "mint_position",
            occurredAt: "2026-06-10T12:00:00.000Z",
            txHash: "0x1",
            logIndex: 0,
            blockNumber: 0,
            usdValue: 200,
            signedTokenDeltas: [
              {
                tokenAddress: "0x4200000000000000000000000000000000000006",
                symbol: "WETH",
                direction: "out",
                amountRaw: "1000000000000000000",
                amountFormatted: "1",
                usdValue: 200,
                priceSource: "event",
              },
            ],
            priceSource: "event",
            confidence: "high",
            inferredActionId: null,
            coverageReasonCodes: [],
            metadata: {},
          },
          {
            id: "withdraw-1",
            sequenceIndex: 1,
            eventType: "withdraw",
            occurredAt: "2026-06-20T12:00:00.000Z",
            txHash: "0x2",
            logIndex: 1,
            blockNumber: 0,
            usdValue: 100,
            signedTokenDeltas: [
              {
                tokenAddress: "0x4200000000000000000000000000000000000006",
                symbol: "WETH",
                direction: "in",
                amountRaw: "500000000000000000",
                amountFormatted: "0.5",
                usdValue: 100,
                priceSource: "event",
              },
            ],
            priceSource: "event",
            confidence: "high",
            inferredActionId: null,
            coverageReasonCodes: [],
            metadata: {},
          },
        ],
      },
    ],
    strategyRows: [],
    priceRows: [
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        priceUsd: "200",
        pricedAt: new Date("2026-06-10T00:00:00.000Z"),
      },
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        priceUsd: "210",
        pricedAt: new Date("2026-06-20T12:00:00.000Z"),
      },
    ],
    startAt: new Date("2026-06-19T00:00:00.000Z"),
    endAt: new Date("2026-06-20T23:59:59.999Z"),
    currentTokenBalances: [
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        amount: 0.5,
      },
    ],
  });

  assert.equal(rows.at(-1)?.deployedValueUsd, "105");
  assert.equal(rows.at(0)?.deployedValueUsd, "200");
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