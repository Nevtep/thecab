import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDepositReadModelRows,
  buildSignedTokenDeltas,
  chunkedInsert,
  deriveConfidence,
  buildStrategyIdByPoolId,
  deriveCoverageReasonCodes,
  derivePositionLabel,
  derivePositionStatus,
  deriveTimelineCoverageReasonCodes,
  mapTimelineEventToLifecycleType,
  parseFeeTierBps,
  resolveMintValuationUsd,
  resolveUsdValuation,
} from "@/server/analysis/deposit-read-models";

test("mapTimelineEventToLifecycleType excludes strategy lifecycle events from manual deposit timelines", () => {
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_deposit", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_withdraw", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_claim", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
});

test("buildStrategyIdByPoolId keeps the first strategy cross-link for each primary pool", () => {
  const strategyIdByPoolId = buildStrategyIdByPoolId([
    { strategyId: "strategy-1", primaryPoolId: "pool-1" },
    { strategyId: "strategy-2", primaryPoolId: "pool-1" },
    { strategyId: "strategy-3", primaryPoolId: "pool-2" },
    { strategyId: "strategy-4", primaryPoolId: null },
  ]);

  assert.equal(strategyIdByPoolId.get("pool-1"), "strategy-1");
  assert.equal(strategyIdByPoolId.get("pool-2"), "strategy-3");
  assert.equal(strategyIdByPoolId.has(""), false);
});

test("resolveUsdValuation marks missing historical prices as unavailable", () => {
  const resolved = resolveUsdValuation({
    occurredAt: new Date("2026-05-28T00:00:00.000Z"),
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    symbol: "AERO",
    amountRaw: "1000000000000000000",
    directAmountUsd: null,
    priceByTokenDay: new Map(),
  });

  assert.deepEqual(resolved, {
    usdValue: null,
    priceSource: "unavailable",
    reasonCodes: ["priceUnavailable"],
  });
});

test("timeline coverage reasons surface coverage gaps and degraded classification", () => {
  assert.deepEqual(
    deriveTimelineCoverageReasonCodes({
      valuationReasonCodes: ["priceUnavailable"],
      coverageStatus: "partial",
      confidence: "degraded",
    }),
    ["priceUnavailable", "coverageGap", "lowConfidenceClassification"],
  );
});

test("summary coverage reasons keep transfer-in and unattributed residual signals visible", () => {
  assert.deepEqual(
    deriveCoverageReasonCodes({ openedByTransferIn: true, coverageStatus: "partial" }),
    ["transferInOrigin", "unattributedResidual"],
  );
});

test("chunkedInsert flushes rows in bounded chunks", async () => {
  const flushed: number[][] = [];

  await chunkedInsert([1, 2, 3, 4, 5], async (chunk) => {
    flushed.push(chunk);
  }, 2);

  assert.deepEqual(flushed, [[1, 2], [3, 4], [5]]);
});

test("position helpers derive label status confidence and fee tier", () => {
  assert.equal(parseFeeTierBps("0.05 %"), 500);
  assert.equal(
    derivePositionLabel({
      tokenSymbols: ["WETH", "cbBTC"],
      feeTierLabel: "100",
      poolKind: "cl",
      tokenId: "71093441",
    }),
    "WETH / cbBTC · CL · 100 #71093441",
  );
  assert.equal(derivePositionStatus({ rawStatus: "closed", isInRange: true }), "closed");
  assert.equal(derivePositionStatus({ rawStatus: "open", isInRange: false }), "open_out_of_range");
  assert.equal(deriveConfidence({ coverageStatus: "full", openedByTransferIn: false }), "high");
  assert.equal(deriveConfidence({ coverageStatus: "partial", openedByTransferIn: true }), "degraded");
});

test("resolveMintValuationUsd prices mint movements from ledger history", () => {
  const resolved = resolveMintValuationUsd({
    deposit: { mintTxHash: "0xmint" } as never,
    mintLedgerEventByTxHash: new Map([["0xmint", { id: "ledger-1", occurredAt: new Date("2026-05-20T00:00:00.000Z") }]]),
    movementsByLedgerEventId: new Map([["ledger-1", [
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        amountRaw: "1000000000000000000",
        symbol: "WETH",
      },
      {
        tokenAddress: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        amountRaw: "10000000",
        symbol: "cbBTC",
      },
    ]]]),
    priceByTokenDay: new Map([
      ["0x4200000000000000000000000000000000000006:2026-05-20", 2500],
      ["0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf:2026-05-20", 100000],
    ]),
  });

  assert.equal(resolved, 12500);
});

test("buildSignedTokenDeltas accumulates signed USD and worst price source", () => {
  const resolved = buildSignedTokenDeltas({
    occurredAt: new Date("2026-05-28T00:00:00.000Z"),
    movements: [
      {
        tokenAddress: "0x4200000000000000000000000000000000000006",
        directionIn: true,
        amountRaw: "1000000000000000000",
        amountUsd: 2500,
        symbol: "WETH",
      },
      {
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        directionIn: false,
        amountRaw: "1000000000000000000",
        amountUsd: null,
        symbol: "AERO",
      },
    ],
    priceByTokenDay: new Map(),
  });

  assert.equal(resolved.signedUsdTotal, 2500);
  assert.equal(resolved.eventPriceSource, "unavailable");
  assert.deepEqual(resolved.reasonCodes, ["priceUnavailable"]);
  assert.equal(resolved.deltas[0]?.direction, "in");
  assert.equal(resolved.deltas[1]?.direction, "out");
});

test("buildDepositReadModelRows materializes summary lifecycle and decomposition rows deterministically", () => {
  const input = {
    runId: "run-1",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-20",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        id: "deposit-open",
        poolId: "pool-1",
        mintTxHash: "0xmint-open",
        status: "open",
        tokenId: "71093441",
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "cbBTC",
          valueUsd: 1500,
          metadata: {
            feeTierLabel: "100",
            rangeLowerTick: -266400,
            rangeUpperTick: -265900,
            rangeLowerPrice: 0.0269,
            rangeUpperPrice: 0.0283,
            isInRange: true,
          },
        },
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
      {
        id: "deposit-closed",
        poolId: "pool-2",
        mintTxHash: null,
        status: "closed",
        tokenId: "2",
        metadataJson: {
          primaryTokenSymbol: "USDC",
          secondaryTokenSymbol: "cbBTC",
          metadata: {},
        },
        coverageStatus: "full",
        updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([
      ["pool-1", {
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        metadataJson: { tokenSymbols: ["WETH", "cbBTC"], poolType: "cl", feeTierLabel: "100" },
      }],
      ["pool-2", {
        token0Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        metadataJson: { tokenSymbols: ["USDC", "cbBTC"], poolType: "cl", feeTierLabel: "100" },
      }],
    ]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([
      ["deposit-open", {
        capitalEnteredUsd: 1000,
        capitalWithdrawnUsd: 0,
        openedAt: new Date("2026-05-20T00:00:00.000Z"),
        closedAt: null,
        openedValueUsd: 1000,
        openedByTransferIn: false,
      }],
      ["deposit-closed", {
        capitalEnteredUsd: 2000,
        capitalWithdrawnUsd: 0,
        openedAt: new Date("2026-05-21T00:00:00.000Z"),
        closedAt: null,
        openedValueUsd: 2000,
        openedByTransferIn: false,
      }],
    ]),
    rewardsByDepositId: new Map([["deposit-open", 20]]),
    mintLedgerEventByTxHash: new Map([["0xmint-open", { id: "ledger-open", occurredAt: new Date("2026-05-20T00:00:00.000Z") }]]),
    mintOutflowsByLedgerEventId: new Map([["ledger-open", [{
      tokenAddress: "0x4200000000000000000000000000000000000006",
      amountRaw: "400000000000000000",
      symbol: "WETH",
    }]]]),
    priceByTokenDay: new Map([["0x4200000000000000000000000000000000000006:2026-05-20", 2500]]),
    timelineRows: [],
    lifecycleLedgerById: new Map(),
    pricedLifecycleMovements: new Map([["ledger-open", [{
      tokenAddress: "0x4200000000000000000000000000000000000006",
      directionIn: false,
      amountRaw: "400000000000000000",
      amountUsd: 1000,
      symbol: "WETH",
    }]]]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map([["pool-1", "strategy-1"]]),
    resolvedRewardRows: [{
      id: "reward-1",
      depositOrStrategyId: "deposit-open",
      txHash: "0xreward",
      logIndex: 1,
      rewardType: "reward_claim",
      tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      amountRaw: "1000000000000000000",
      occurredAt: new Date("2026-05-22T00:00:00.000Z"),
      resolutionStatus: "resolved",
      metadataJson: { blockNumber: 2 },
      symbol: "AERO",
      resolvedAmountUsd: 20,
      priceSource: "event",
      reasonCodes: [],
      resolvedTokenDeltas: [],
    }],
  } satisfies Parameters<typeof buildDepositReadModelRows>[0];

  const result = buildDepositReadModelRows(input);

  assert.equal(result.summaryRows.length, 2);
  assert.equal(result.lifecycleRowsToInsert.length, 2);
  assert.equal(result.decompositionRowsToInsert.length, 2);

  const openSummary = result.summaryRows.find((row) => row.depositId === "deposit-open");
  const closedSummary = result.summaryRows.find((row) => row.depositId === "deposit-closed");
  assert.equal(openSummary?.totalReturnUsd, "520");
  assert.equal(openSummary?.mellowStrategyCrossLinkId, "strategy-1");
  assert.equal(closedSummary?.capitalWithdrawnUsd, "2000");
  assert.equal(closedSummary?.closedAt?.toISOString(), "2026-05-27T00:00:00.000Z");

  const lifecycleTypes = result.lifecycleRowsToInsert.map((row) => row.eventType);
  assert.deepEqual(lifecycleTypes, ["mint_position", "claim_reward"]);
  assert.equal(result.decompositionRowsToInsert[0]?.unattributedUsd, "0");
});