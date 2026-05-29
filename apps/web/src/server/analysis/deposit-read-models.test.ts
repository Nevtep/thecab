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
  resolveSyntheticGaugeClaimDepositId,
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
  assert.equal(
    derivePositionStatus({ rawStatus: "open", isInRange: true, hasLiveValuation: false, capitalEnteredUsd: 1000 }),
    "closed",
    "missing live valuation with prior capital is treated as effectively closed",
  );
  assert.equal(
    derivePositionStatus({ rawStatus: "open", isInRange: true, hasLiveValuation: true, capitalEnteredUsd: 1000 }),
    "open_active",
  );
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

test("resolveSyntheticGaugeClaimDepositId uses the explicit token id from tx metadata", () => {
  const result = resolveSyntheticGaugeClaimDepositId({
    metadataJson: {
      decodedCall: {
        params: {
          tokenIds: ["71093441"],
        },
      },
    },
    txHash: "0xclaim",
    deposits: [
      {
        chainId: 8453,
        id: "deposit-closed",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-closed",
        status: "closed",
        tokenId: "71093441",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: {},
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
      {
        chainId: 8453,
        id: "deposit-open",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-open",
        status: "open",
        tokenId: "71499659",
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
        metadataJson: {},
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ] as Parameters<typeof resolveSyntheticGaugeClaimDepositId>[0]["deposits"],
  });

  assert.equal(result, "deposit-closed");
});

test("resolveSyntheticGaugeClaimDepositId falls back to the same-tx persisted lifecycle token id", () => {
  const result = resolveSyntheticGaugeClaimDepositId({
    metadataJson: {
      methodLabel: "withdraw",
    },
    txHash: "0xwithdraw",
    deposits: [
      {
        chainId: 8453,
        id: "deposit-a",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-a",
        status: "closed",
        tokenId: "71093441",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: {
          lifecycle: [{
            txHash: "0xwithdraw",
            tokenId: "71093441",
            action: "decreaseLiquidity",
          }],
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
      {
        chainId: 8453,
        id: "deposit-b",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-b",
        status: "closed",
        tokenId: "71093442",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: {},
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ] as Parameters<typeof resolveSyntheticGaugeClaimDepositId>[0]["deposits"],
  });

  assert.equal(result, "deposit-a");
});

test("resolveSyntheticGaugeClaimDepositId stays unresolved without a provable token id", () => {
  const result = resolveSyntheticGaugeClaimDepositId({
    metadataJson: {
      methodLabel: "getReward",
    },
    txHash: "0xclaim",
    deposits: [
      {
        chainId: 8453,
        id: "deposit-a",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-a",
        status: "closed",
        tokenId: "71093441",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: {},
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
      {
        chainId: 8453,
        id: "deposit-b",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-b",
        status: "closed",
        tokenId: "71093442",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: {},
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ] as Parameters<typeof resolveSyntheticGaugeClaimDepositId>[0]["deposits"],
  });

  assert.equal(result, null);
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
        chainId: 8453,
        id: "deposit-open",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint-open",
        status: "open",
        tokenId: "71093441",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
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
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
      {
        chainId: 8453,
        id: "deposit-closed",
        poolId: "pool-2",
        walletAddress: "0xabc",
        mintTxHash: null,
        status: "closed",
        tokenId: "2",
        createdAt: new Date("2026-05-21T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "USDC",
          secondaryTokenSymbol: "cbBTC",
          metadata: {},
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([
      ["pool-1", {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "cbBTC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / cbBTC 100",
      }],
      ["pool-2", {
        chainId: 8453,
        id: "pool-2",
        token0Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        createdAt: new Date("2026-05-21T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["USDC", "cbBTC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-21T00:00:00.000Z"),
        poolAddress: "0xpool-2",
        label: "USDC / cbBTC 100",
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
        capitalWithdrawnUsd: 2000,
        openedAt: new Date("2026-05-21T00:00:00.000Z"),
        closedAt: new Date("2026-05-27T00:00:00.000Z"),
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
    priceByTokenDay: new Map([
      ["0x4200000000000000000000000000000000000006:2026-05-20", 2500],
      ["0x4200000000000000000000000000000000000006:2026-05-28", 3750],
    ]),
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
    resolvedRewardRows: [
      {
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
      },
      {
        id: "reward-2",
        depositOrStrategyId: "strategy-1",
        txHash: "0xreward-strategy",
        logIndex: 2,
        rewardType: "reward_claim",
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        amountRaw: "750000000000000000",
        occurredAt: new Date("2026-05-23T00:00:00.000Z"),
        resolutionStatus: "resolved",
        metadataJson: { blockNumber: 3 },
        symbol: "AERO",
        resolvedAmountUsd: 15,
        priceSource: "event",
        reasonCodes: [],
        resolvedTokenDeltas: [],
      },
      {
        id: "reward-3",
        depositOrStrategyId: null,
        txHash: "0xreward-token-id",
        logIndex: 3,
        rewardType: "reward_claim",
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        amountRaw: "600000000000000000",
        occurredAt: new Date("2026-05-24T00:00:00.000Z"),
        resolutionStatus: "unresolved",
        metadataJson: { blockNumber: 4, targetTokenId: "71093441" },
        symbol: "AERO",
        resolvedAmountUsd: 12,
        priceSource: "event",
        reasonCodes: [],
        resolvedTokenDeltas: [],
      },
    ],
  } satisfies Parameters<typeof buildDepositReadModelRows>[0];

  const result = buildDepositReadModelRows(input);

  assert.equal(result.summaryRows.length, 2);
  assert.equal(result.lifecycleRowsToInsert.length, 4);
  assert.equal(result.decompositionRowsToInsert.length, 2);

  const openSummary = result.summaryRows.find((row) => row.depositId === "deposit-open");
  const closedSummary = result.summaryRows.find((row) => row.depositId === "deposit-closed");
  const openDecomposition = result.decompositionRowsToInsert.find((row) => row.depositId === "deposit-open");
  assert.equal(openSummary?.totalRewardsUsd, "47");
  assert.equal(openSummary?.totalReturnUsd, "547");
  assert.equal(openSummary?.mellowStrategyCrossLinkId, "strategy-1");
  assert.equal(openSummary?.positionLabel, "WETH / cbBTC · CL · 100 #71093441");
  assert.equal(openSummary?.rangeLowerPrice, "0.0269");
  assert.equal(openSummary?.rangeUpperPrice, "0.0283");
  assert.equal(closedSummary?.currentValueUsd, "2000");
  assert.equal(closedSummary?.capitalWithdrawnUsd, "2000");
  assert.equal(closedSummary?.closedAt?.toISOString(), "2026-05-27T00:00:00.000Z");

  const lifecycleTypes = result.lifecycleRowsToInsert.map((row) => row.eventType);
  assert.deepEqual(lifecycleTypes, ["mint_position", "claim_reward", "claim_reward", "claim_reward"]);
  assert.equal(openDecomposition?.assetPriceEffectUsd, "500");
  assert.equal(openDecomposition?.rebalanceEffectUsd, "0");
  assert.equal(openDecomposition?.unattributedUsd, "0");
  assert.equal(openDecomposition?.componentPercentages?.rewardsUsd ?? null, 47 / 547);
  assert.ok(openDecomposition);
  assert.ok(
    Math.abs(
      Number(openDecomposition.totalReturnUsd) - (
        Number(openDecomposition.rewardsUsd)
        + Number(openDecomposition.feesUsd)
        + Number(openDecomposition.assetPriceEffectUsd)
        + Number(openDecomposition.rebalanceEffectUsd)
        + Number(openDecomposition.realizedPnlUsd)
        + Number(openDecomposition.unrealizedPnlUsd)
        + Number(openDecomposition.unattributedUsd)
      ),
    ) < 1e-9,
  );
});

test("buildDepositReadModelRows returns empty read-model batches when no eligible deposits exist", () => {
  const result = buildDepositReadModelRows({
    runId: "run-empty",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-20",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [],
    poolById: new Map(),
    aggregates: new Map(),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map(),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map(),
    timelineRows: [],
    lifecycleLedgerById: new Map(),
    pricedLifecycleMovements: new Map(),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  assert.deepEqual(result, {
    summaryRows: [],
    lifecycleRowsToInsert: [],
    decompositionRowsToInsert: [],
  });
});

test("buildDepositReadModelRows degrades transfer-in deposits and keeps origin reason codes visible", () => {
  const result = buildDepositReadModelRows({
    runId: "run-transfer-in",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-transfer-in",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: null,
        status: "open",
        tokenId: "44",
        createdAt: new Date("2026-05-05T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "cbBTC",
          valueUsd: 900,
          metadata: {
            feeTierLabel: "100",
            isInRange: false,
          },
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        createdAt: new Date("2026-05-05T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "cbBTC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-05T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / cbBTC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-transfer-in",
      {
        capitalEnteredUsd: 1000,
        capitalWithdrawnUsd: 0,
        openedAt: new Date("2026-05-05T00:00:00.000Z"),
        closedAt: null,
        openedValueUsd: 1000,
        openedByTransferIn: true,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map(),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map(),
    timelineRows: [
      {
        id: "timeline-open",
        relatedDepositId: "deposit-transfer-in",
        sourceLedgerEventId: null,
        eventType: "deposit",
        occurredAt: new Date("2026-05-05T00:00:00.000Z"),
        attributedValueUsd: 1000,
        confidence: "degraded",
        coverageStatus: "full",
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map(),
    pricedLifecycleMovements: new Map(),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  assert.equal(result.summaryRows.length, 1);
  assert.equal(result.lifecycleRowsToInsert.length, 1);

  const summary = result.summaryRows[0];
  const lifecycle = result.lifecycleRowsToInsert[0];
  const decomposition = result.decompositionRowsToInsert[0];

  assert.equal(summary?.status, "open_out_of_range");
  assert.equal(summary?.coverageStatus, "partial");
  assert.equal(summary?.confidence, "degraded");
  assert.deepEqual(summary?.coverageReasonCodes, ["transferInOrigin", "lowConfidenceClassification"]);

  assert.equal(lifecycle?.eventType, "transfer_in");
  assert.equal(lifecycle?.usdValue, "1000");
  assert.deepEqual(lifecycle?.coverageReasonCodes, ["transferInOrigin", "lowConfidenceClassification"]);
  assert.equal(lifecycle?.confidence, "degraded");

  assert.equal(decomposition?.unattributedUsd, "0");
  assert.deepEqual(decomposition?.unattributedReasonCodes, ["transferInOrigin", "lowConfidenceClassification"]);
});

test("buildDepositReadModelRows attributes CL withdrawals to asset-price and rebalance effects", () => {
  const result = buildDepositReadModelRows({
    runId: "run-cl-close",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-cl-close",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: null,
        status: "closed",
        tokenId: "55",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "USDC",
          metadata: {
            feeTierLabel: "100",
            rangeLowerTick: -1,
            rangeUpperTick: 1,
            rangeLowerPrice: 1000,
            rangeUpperPrice: 2500,
            isInRange: false,
          },
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "USDC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / USDC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-cl-close",
      {
        capitalEnteredUsd: 2000,
        capitalWithdrawnUsd: 2800,
        openedAt: new Date("2026-05-01T00:00:00.000Z"),
        closedAt: new Date("2026-05-20T00:00:00.000Z"),
        openedValueUsd: 2000,
        openedByTransferIn: false,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map(),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map([
      ["0x4200000000000000000000000000000000000006:2026-05-01", 1000],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-01", 1],
      ["0x4200000000000000000000000000000000000006:2026-05-20", 2000],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-20", 1],
    ]),
    timelineRows: [
      {
        id: "timeline-open",
        relatedDepositId: "deposit-cl-close",
        sourceLedgerEventId: "ledger-open",
        eventType: "deposit",
        occurredAt: new Date("2026-05-01T00:00:00.000Z"),
        attributedValueUsd: 2000,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
      {
        id: "timeline-close",
        relatedDepositId: "deposit-cl-close",
        sourceLedgerEventId: "ledger-close",
        eventType: "close",
        occurredAt: new Date("2026-05-20T00:00:00.000Z"),
        attributedValueUsd: 2000,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map([
      ["ledger-open", { txHash: "0xopen", logIndex: 0, metadataJson: { blockNumber: 1 } }],
      ["ledger-close", { txHash: "0xclose", logIndex: 1, metadataJson: { blockNumber: 2 } }],
    ]),
    pricedLifecycleMovements: new Map([
      ["ledger-open", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: false,
          amountRaw: "1000000000000000000",
          amountUsd: 1000,
          symbol: "WETH",
        },
        {
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          directionIn: false,
          amountRaw: "1000000000",
          amountUsd: 1000,
          symbol: "USDC",
        },
      ]],
      ["ledger-close", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: true,
          amountRaw: "1400000000000000000",
          amountUsd: 2800,
          symbol: "WETH",
        },
      ]],
    ]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  const decomposition = result.decompositionRowsToInsert[0];
  const summary = result.summaryRows[0];
  const closeEvent = result.lifecycleRowsToInsert.find((row) => row.eventType === "close");

  assert.equal(summary?.currentValueUsd, "2800");
  assert.equal(summary?.capitalWithdrawnUsd, "2800");
  assert.equal(summary?.totalReturnUsd, "800");
  assert.equal(decomposition?.assetPriceEffectUsd, "1000");
  assert.equal(decomposition?.rebalanceEffectUsd, "-200");
  assert.equal(decomposition?.realizedPnlUsd, "0");
  assert.equal(decomposition?.unrealizedPnlUsd, "0");
  assert.equal(decomposition?.unattributedUsd, "0");
  assert.equal((closeEvent?.metadataJson as Record<string, unknown>)?.rebalanceEffectUsd, -200);
  assert.equal((closeEvent?.metadataJson as Record<string, unknown>)?.hodlBenchmarkUsd, 3000);
});

test("buildDepositReadModelRows falls back to withdrawn capital when the close event valuation resolves to zero", () => {
  const result = buildDepositReadModelRows({
    runId: "run-closed-zero-close-value",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-closed-zero-close-value",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: null,
        status: "closed",
        tokenId: "99",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "USDC",
          metadata: {
            feeTierLabel: "100",
            isInRange: false,
          },
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "USDC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / USDC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-closed-zero-close-value",
      {
        capitalEnteredUsd: 2000,
        capitalWithdrawnUsd: 2400,
        openedAt: new Date("2026-05-01T00:00:00.000Z"),
        closedAt: new Date("2026-05-20T00:00:00.000Z"),
        openedValueUsd: 2000,
        openedByTransferIn: false,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map(),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map(),
    timelineRows: [
      {
        id: "timeline-close",
        relatedDepositId: "deposit-closed-zero-close-value",
        sourceLedgerEventId: "ledger-close",
        eventType: "close",
        occurredAt: new Date("2026-05-20T00:00:00.000Z"),
        attributedValueUsd: 0,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map([
      ["ledger-close", { txHash: "0xclose", logIndex: 1, metadataJson: { blockNumber: 2 } }],
    ]),
    pricedLifecycleMovements: new Map([
      ["ledger-close", []],
    ]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  const summary = result.summaryRows[0];

  assert.equal(summary?.currentValueUsd, "2400");
  assert.equal(summary?.capitalWithdrawnUsd, "2400");
  assert.equal(summary?.totalRewardsUsd, "0");
});

test("buildDepositReadModelRows uses grouped ledgerEventIds to recover withdrawn capital for close events", () => {
  const result = buildDepositReadModelRows({
    runId: "run-grouped-close-ledger-ids",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-grouped-close",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xopen",
        status: "closed",
        tokenId: "199",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "USDC",
          valueUsd: 0,
          metadata: {
            feeTierLabel: "100",
            isInRange: false,
          },
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-20T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "USDC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / USDC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-grouped-close",
      {
        capitalEnteredUsd: 2000,
        capitalWithdrawnUsd: 0,
        openedAt: new Date("2026-05-01T00:00:00.000Z"),
        closedAt: new Date("2026-05-20T00:00:00.000Z"),
        openedValueUsd: 2000,
        openedByTransferIn: false,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map([["0xopen", { id: "ledger-open", occurredAt: new Date("2026-05-01T00:00:00.000Z") }]]),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map(),
    timelineRows: [
      {
        id: "timeline-close-grouped",
        relatedDepositId: "deposit-grouped-close",
        sourceLedgerEventId: "ledger-open",
        eventType: "close",
        occurredAt: new Date("2026-05-20T00:00:00.000Z"),
        attributedValueUsd: 0,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {
          grouped: true,
          groupedClassifications: ["manual_withdrawal"],
          ledgerEventIds: ["ledger-withdraw"],
        },
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map([
      ["ledger-open", { txHash: "0xopen", logIndex: 0, metadataJson: { blockNumber: 1 } }],
      ["ledger-withdraw", { txHash: "0xwithdraw", logIndex: 1, metadataJson: { blockNumber: 2 } }],
    ]),
    pricedLifecycleMovements: new Map([
      ["ledger-withdraw", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: true,
          amountRaw: "1200000000000000000",
          amountUsd: 2400,
          symbol: "WETH",
        },
      ]],
    ]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  const summary = result.summaryRows[0];
  const closeEvent = result.lifecycleRowsToInsert.find((row) => row.eventType === "close");

  assert.equal(summary?.currentValueUsd, "2400");
  assert.equal(summary?.capitalWithdrawnUsd, "2400");
  assert.equal(closeEvent?.txHash, "0xwithdraw");
});

test("buildDepositReadModelRows materializes deposit lifecycle from persisted deposit metadata", () => {
  const result = buildDepositReadModelRows({
    runId: "run-persisted-deposit-lifecycle",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-persisted-lifecycle",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: "0xmint",
        status: "closed",
        tokenId: "69133516",
        createdAt: new Date("2026-05-02T05:08:23.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "USDC",
          valueUsd: 0,
          metadata: {
            feeTierLabel: "100",
            isInRange: false,
          },
          lifecycle: [
            {
              txHash: "0xmint",
              action: "mint",
              occurredAt: "2026-05-02T05:08:23.000Z",
              positionManagerAddress: "0x827922686190790b37229fd06084350e74485b72",
              poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
              category: "mint",
              methodLabel: "mint",
              summary: "Minted 1 NFT",
            },
            {
              txHash: "0xcollect",
              action: "collect",
              occurredAt: "2026-05-07T15:14:11.000Z",
              positionManagerAddress: null,
              poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
              category: "claim",
              methodLabel: "getReward",
              summary: "Claimed rewards",
            },
            {
              txHash: "0xwithdraw",
              action: "decreaseLiquidity",
              occurredAt: "2026-05-07T15:16:43.000Z",
              positionManagerAddress: "0x827922686190790b37229fd06084350e74485b72",
              poolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
              category: "burn",
              methodLabel: "multicall",
              summary: "Burned 1 NFT",
            },
          ],
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-07T15:16:43.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "USDC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / USDC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-persisted-lifecycle",
      {
        capitalEnteredUsd: 0,
        capitalWithdrawnUsd: 0,
        openedAt: new Date("2026-05-02T05:08:23.000Z"),
        closedAt: null,
        openedValueUsd: 0,
        openedByTransferIn: false,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map([["0xmint", { id: "ledger-mint", occurredAt: new Date("2026-05-02T05:08:23.000Z") }]]),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map(),
    timelineRows: [] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map([
      ["ledger-mint", { id: "ledger-mint", txHash: "0xmint", logIndex: 0, classification: "manual_deposit", occurredAt: new Date("2026-05-02T05:08:23.000Z"), confidence: "high", metadataJson: { blockNumber: 1 } }],
      ["ledger-collect", { id: "ledger-collect", txHash: "0xcollect", logIndex: 1, classification: "claim", occurredAt: new Date("2026-05-07T15:14:11.000Z"), confidence: "high", metadataJson: { blockNumber: 2 } }],
      ["ledger-withdraw", { id: "ledger-withdraw", txHash: "0xwithdraw", logIndex: 2, classification: "manual_withdrawal", occurredAt: new Date("2026-05-07T15:16:43.000Z"), confidence: "high", metadataJson: { blockNumber: 3 } }],
    ]),
    lifecycleLedgerRowsByTxHash: new Map([
      ["0xmint", [{ id: "ledger-mint", txHash: "0xmint", logIndex: 0, classification: "manual_deposit", occurredAt: new Date("2026-05-02T05:08:23.000Z"), confidence: "high", metadataJson: { blockNumber: 1 } }]],
      ["0xcollect", [{ id: "ledger-collect", txHash: "0xcollect", logIndex: 1, classification: "claim", occurredAt: new Date("2026-05-07T15:14:11.000Z"), confidence: "high", metadataJson: { blockNumber: 2 } }]],
      ["0xwithdraw", [{ id: "ledger-withdraw", txHash: "0xwithdraw", logIndex: 2, classification: "manual_withdrawal", occurredAt: new Date("2026-05-07T15:16:43.000Z"), confidence: "high", metadataJson: { blockNumber: 3 } }]],
    ]),
    pricedLifecycleMovements: new Map([
      [
        "ledger-mint",
        [
          {
            tokenAddress: "0x4200000000000000000000000000000000000006",
            directionIn: false,
            amountRaw: "1000000000000000000",
            amountUsd: 2000,
            symbol: "WETH",
          },
        ],
      ],
      [
        "ledger-collect",
        [
          {
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            directionIn: true,
            amountRaw: "100000000000000000000",
            amountUsd: 300,
            symbol: "AERO",
          },
        ],
      ],
      [
        "ledger-withdraw",
        [
          {
            tokenAddress: "0x4200000000000000000000000000000000000006",
            directionIn: true,
            amountRaw: "1200000000000000000",
            amountUsd: 2400,
            symbol: "WETH",
          },
        ],
      ],
    ]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  const summary = result.summaryRows[0];
  const lifecycleTypes = result.lifecycleRowsToInsert.map((row) => row.eventType);

  assert.deepEqual(lifecycleTypes, ["mint_position", "claim_reward", "close"]);
  assert.equal(summary?.capitalWithdrawnUsd, "2400");
  assert.equal(summary?.currentValueUsd, "2400");
  assert.equal(summary?.totalRewardsUsd, "300");
});

test("buildDepositReadModelRows keeps post-withdrawal swaps in realized pnl only", () => {
  const result = buildDepositReadModelRows({
    runId: "run-post-withdrawal-swap",
    walletAddress: "0xabc",
    chainId: 8453,
    startDayUtc: "2026-05-01",
    endDayUtc: "2026-05-28",
    capturedAt: new Date("2026-05-28T00:00:00.000Z"),
    eligibleDeposits: [
      {
        chainId: 8453,
        id: "deposit-swap",
        poolId: "pool-1",
        walletAddress: "0xabc",
        mintTxHash: null,
        status: "closed",
        tokenId: "77",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: {
          primaryTokenSymbol: "WETH",
          secondaryTokenSymbol: "USDC",
          metadata: {
            feeTierLabel: "100",
            isInRange: false,
          },
        },
        positionManagerAddress: null,
        coverageStatus: "full",
        updatedAt: new Date("2026-05-25T00:00:00.000Z"),
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["eligibleDeposits"],
    poolById: new Map([[
      "pool-1",
      {
        chainId: 8453,
        id: "pool-1",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        metadataJson: { tokenSymbols: ["WETH", "USDC"], poolType: "cl", feeTierLabel: "100" },
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        poolAddress: "0xpool-1",
        label: "WETH / USDC 100",
      },
    ]]) as Parameters<typeof buildDepositReadModelRows>[0]["poolById"],
    aggregates: new Map([[
      "deposit-swap",
      {
        capitalEnteredUsd: 2000,
        capitalWithdrawnUsd: 2800,
        openedAt: new Date("2026-05-01T00:00:00.000Z"),
        closedAt: new Date("2026-05-25T00:00:00.000Z"),
        openedValueUsd: 2000,
        openedByTransferIn: false,
      },
    ]]),
    rewardsByDepositId: new Map(),
    mintLedgerEventByTxHash: new Map(),
    mintOutflowsByLedgerEventId: new Map(),
    priceByTokenDay: new Map([
      ["0x4200000000000000000000000000000000000006:2026-05-01", 1000],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-01", 1],
      ["0x4200000000000000000000000000000000000006:2026-05-20", 2000],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-20", 1],
      ["0x4200000000000000000000000000000000000006:2026-05-25", 1900],
      ["0x4200000000000000000000000000000000000006:2026-05-28", 1900],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-25", 1],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:2026-05-28", 1],
    ]),
    timelineRows: [
      {
        id: "timeline-open",
        relatedDepositId: "deposit-swap",
        sourceLedgerEventId: "ledger-open",
        eventType: "deposit",
        occurredAt: new Date("2026-05-01T00:00:00.000Z"),
        attributedValueUsd: 2000,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
      {
        id: "timeline-withdraw",
        relatedDepositId: "deposit-swap",
        sourceLedgerEventId: "ledger-withdraw",
        eventType: "withdraw",
        occurredAt: new Date("2026-05-20T00:00:00.000Z"),
        attributedValueUsd: 2000,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
      {
        id: "timeline-swap",
        relatedDepositId: "deposit-swap",
        sourceLedgerEventId: "ledger-swap",
        eventType: "partial_swap_attribution",
        occurredAt: new Date("2026-05-25T00:00:00.000Z"),
        attributedValueUsd: 1400,
        confidence: "high",
        coverageStatus: "full",
        metadataJson: {},
      },
    ] as Parameters<typeof buildDepositReadModelRows>[0]["timelineRows"],
    lifecycleLedgerById: new Map([
      ["ledger-open", { txHash: "0xopen", logIndex: 0, metadataJson: { blockNumber: 1 } }],
      ["ledger-withdraw", { txHash: "0xwithdraw", logIndex: 1, metadataJson: { blockNumber: 2 } }],
      ["ledger-swap", { txHash: "0xswap", logIndex: 2, metadataJson: { blockNumber: 3 } }],
    ]),
    pricedLifecycleMovements: new Map([
      ["ledger-open", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: false,
          amountRaw: "1000000000000000000",
          amountUsd: 1000,
          symbol: "WETH",
        },
        {
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          directionIn: false,
          amountRaw: "1000000000",
          amountUsd: 1000,
          symbol: "USDC",
        },
      ]],
      ["ledger-withdraw", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: true,
          amountRaw: "1400000000000000000",
          amountUsd: 2700,
          symbol: "WETH",
        },
      ]],
      ["ledger-swap", [
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          directionIn: false,
          amountRaw: "700000000000000000",
          amountUsd: 1350,
          symbol: "WETH",
        },
        {
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          directionIn: true,
          amountRaw: "1450000000",
          amountUsd: 1450,
          symbol: "USDC",
        },
      ]],
    ]),
    inferredActionIdByLedgerEventId: new Map(),
    strategyIdByPoolId: new Map(),
    resolvedRewardRows: [],
  });

  const decomposition = result.decompositionRowsToInsert[0];
  const summary = result.summaryRows[0];
  const swapEvent = result.lifecycleRowsToInsert.find((row) => row.txHash === "0xswap");

  assert.equal(summary?.currentValueUsd, "2700");
  assert.equal(summary?.capitalWithdrawnUsd, "2700");
  assert.equal(summary?.totalReturnUsd, "800");
  assert.equal(decomposition?.assetPriceEffectUsd, "1000");
  assert.equal(decomposition?.rebalanceEffectUsd, "-300");
  assert.equal(decomposition?.realizedPnlUsd, "100");
  assert.equal(decomposition?.unrealizedPnlUsd, "0");
  assert.equal(decomposition?.unattributedUsd, "0");
  assert.equal((swapEvent?.metadataJson as Record<string, unknown>)?.realizedPnlUsd, 100);
  assert.equal((swapEvent?.metadataJson as Record<string, unknown>)?.realizedCostBasisUsd, 1350);
});