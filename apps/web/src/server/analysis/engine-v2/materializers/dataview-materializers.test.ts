import assert from "node:assert/strict";
import test from "node:test";

import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";

import { materializeDepositRows, materializeStrategyRows } from "./dataview-materializers";
import {
  collectMaterializationPoolIds,
  type EngineV2MaterializationContext,
} from "./load-materialization-context";

function buildContext(): EngineV2MaterializationContext {
  return {
    poolStateByPoolId: new Map([
      ["8453:0xpool", {
        poolId: "8453:0xpool",
        poolAddress: "0xpool",
        token0Address: "0x00000000000000000000000000000000000000aa",
        token1Address: "0x00000000000000000000000000000000000000bb",
        tickSpacing: 100,
        feeTierBps: null,
      }],
    ]),
    tokenMetadataByAddress: new Map([
      ["0x00000000000000000000000000000000000000aa", {
        tokenAddress: "0x00000000000000000000000000000000000000aa",
        symbol: "WETH",
        decimals: 18,
      }],
      ["0x00000000000000000000000000000000000000bb", {
        tokenAddress: "0x00000000000000000000000000000000000000bb",
        symbol: "USDC",
        decimals: 6,
      }],
      ["0x00000000000000000000000000000000000000dd", {
        tokenAddress: "0x00000000000000000000000000000000000000dd",
        symbol: "mweth-usdc",
        decimals: 18,
      }],
    ]),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };
}

test("collectMaterializationPoolIds includes strategy-only pool ids", () => {
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "strategy-open",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0x1",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          strategyExposureId: "strategy-1",
          poolId: "8453:0xpool",
          wrapperAddress: "0x00000000000000000000000000000000000000dd",
          valueUsd: "1250",
          sharesRaw: "1000",
        },
      },
    ],
    links: [],
  });

  assert.deepEqual(collectMaterializationPoolIds(accounting), ["8453:0xpool"]);
});

test("materializers prefer normalized pool labels and avoid raw pool ids", () => {
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "deposit-open",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        eventType: "manual_position_created",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xdep",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          depositId: "dep-1",
          tokenId: "71093441",
          poolId: "8453:0xpool",
          valueUsd: "2600",
        },
      },
      {
        id: "strategy-open",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xstrat",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          strategyExposureId: "strategy-1",
          poolId: "8453:0xpool",
          wrapperAddress: "0x00000000000000000000000000000000000000dd",
          valueUsd: "1250",
          sharesRaw: "1000",
        },
      },
    ],
    links: [],
  });

  const context = buildContext();
  const [depositRow] = materializeDepositRows(accounting, context);
  const [strategyRow] = materializeStrategyRows(accounting, context);
  const unresolvedDepositRow = materializeDepositRows(accounting, {
    ...context,
    poolStateByPoolId: new Map(),
    tokenMetadataByAddress: new Map(),
  })[0];

  assert.equal((depositRow?.rowJson as { poolLabel?: string }).poolLabel, "WETH / USDC 100");
  assert.equal((depositRow?.rowJson as { positionLabel?: string }).positionLabel, "WETH / USDC 100 · CL #71093441");
  assert.equal((strategyRow?.rowJson as { poolLabel?: string | null }).poolLabel, "WETH / USDC 100");
  assert.equal((strategyRow?.rowJson as { strategyLabel?: string }).strategyLabel, "Mellow WETH / USDC 100");
  assert.equal((unresolvedDepositRow?.rowJson as { poolLabel?: string }).poolLabel, "Unresolved pool");
});import assert from "node:assert/strict";
import test from "node:test";

import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";
import type { EngineV2MaterializationContext } from "@/server/analysis/engine-v2/materializers/load-materialization-context";

import { materializeAllDataViewRows } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("materializeAllDataViewRows emits Activity, Deposits, Strategies, Pools, Rewards, and Governance rows", () => {
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "deposit-event",
        chainId: 8453,
        walletAddress,
        eventType: "manual_deposit_open",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xdep",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { positionManagerAddress: "0x00000000000000000000000000000000000000aa", tokenId: "1", valueUsd: "10" },
      },
      {
        id: "strategy-event",
        chainId: 8453,
        walletAddress,
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xstrat",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { strategyExposureId: "strat-1", sharesRaw: "1", valueUsd: "20" },
      },
      {
        id: "reward-event",
        chainId: 8453,
        walletAddress,
        eventType: "governance_claimFees",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        txHash: "0xreward",
        sequenceIndex: 2,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missing_distributor_pool_link"],
        metadataJson: { rewardId: "reward-1", rewardType: "governance_fee", lockTokenId: "110971", amountUsd: "5" },
      },
    ],
    links: [
      { domainEventId: "deposit-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "strategy-event", entityType: "strategy_exposure", entityId: "strat-1" },
      { domainEventId: "strategy-event", entityType: "pool", entityId: "pool-1" },
      { domainEventId: "reward-event", entityType: "governance_lock", entityId: "lock-1" },
    ],
  });

  const surfaces = new Set(materializeAllDataViewRows(accounting).map((row) => row.surface));
  assert.ok(surfaces.has("activity"));
  assert.ok(surfaces.has("deposits"));
  assert.ok(surfaces.has("strategies"));
  assert.ok(surfaces.has("pools"));
  assert.ok(surfaces.has("rewards"));
  assert.ok(surfaces.has("governance"));
});

test("materializeAllDataViewRows enriches deposit rows from pool snapshots and token metadata", () => {
  const poolId = "8453:0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "deposit-open",
        chainId: 8453,
        walletAddress,
        eventType: "manual_pool_deposit_router",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xdep-open",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          positionManagerAddress: "0x00000000000000000000000000000000000000aa",
          tokenId: "1",
          poolId,
          valueUsd: "10",
        },
        evidenceJson: {
          movements: [
            {
              assetType: "erc20",
              direction: "out",
              tokenAddress: "0x4200000000000000000000000000000000000006",
              amountRaw: "1000000000000000000",
            },
            {
              assetType: "erc20",
              direction: "out",
              tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              amountRaw: "1000000",
            },
          ],
        },
      },
      {
        id: "deposit-stake",
        chainId: 8453,
        walletAddress,
        eventType: "manual_gauge_stake",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xdep-stake",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          positionManagerAddress: "0x00000000000000000000000000000000000000aa",
          tokenId: "1",
          poolId,
          rangeLowerTick: -266400,
          rangeUpperTick: -265900,
          rangeLowerPrice: "0.0269757447",
          rangeUpperPrice: "0.0283587498",
          isInRange: true,
          rangeQuoteTokenSymbol: "USDC",
          rangeDisplayFractionDigits: 4,
        },
        evidenceJson: {
          movements: [
            {
              assetType: "erc20",
              direction: "out",
              tokenAddress: poolId.split(":").at(-1),
              amountRaw: "123000",
            },
          ],
        },
      },
    ],
    links: [
      { domainEventId: "deposit-open", entityType: "deposit", entityId: "8453:0x00000000000000000000000000000000000000aa:1" },
      { domainEventId: "deposit-open", entityType: "pool", entityId: poolId },
      { domainEventId: "deposit-stake", entityType: "deposit", entityId: "8453:0x00000000000000000000000000000000000000aa:1" },
      { domainEventId: "deposit-stake", entityType: "pool", entityId: poolId },
    ],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map([[poolId, {
      poolId,
      poolAddress: poolId.split(":").at(-1) ?? "",
      token0Address: "0x4200000000000000000000000000000000000006",
      token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tickSpacing: 100,
      feeTierBps: 100,
    }]]),
    tokenMetadataByAddress: new Map([
      ["0x4200000000000000000000000000000000000006", { tokenAddress: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 }],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 }],
      [poolId.split(":").at(-1) ?? "", { tokenAddress: poolId.split(":").at(-1) ?? "", symbol: "AERO-LP", decimals: 18 }],
    ]),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };

  const depositRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "deposits");
  const rowJson = depositRow?.rowJson as Record<string, unknown> | undefined;
  const lifecycle = Array.isArray(rowJson?.lifecycle) ? rowJson.lifecycle as Array<Record<string, unknown>> : [];
  const firstDelta = Array.isArray(lifecycle[0]?.signedTokenDeltas)
    ? lifecycle[0]?.signedTokenDeltas as Array<Record<string, unknown>>
    : [];

  assert.equal(rowJson?.poolLabel, "WETH / USDC 100");
  assert.equal(rowJson?.positionLabel, "WETH / USDC 100 · CL #1");
  assert.equal(rowJson?.poolKind, "cl");
  assert.equal(rowJson?.token0Symbol, "WETH");
  assert.equal(rowJson?.token1Symbol, "USDC");
  assert.equal(rowJson?.token0Address, "0x4200000000000000000000000000000000000006");
  assert.equal(rowJson?.token1Address, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  assert.equal(rowJson?.feeTierBps, 100);
  assert.equal(rowJson?.tickLower, -266400);
  assert.equal(rowJson?.tickUpper, -265900);
  assert.equal(rowJson?.rangeLowerPrice, 0.0269757447);
  assert.equal(rowJson?.rangeUpperPrice, 0.0283587498);
  assert.equal(rowJson?.isInRange, true);
  assert.equal(lifecycle[0]?.eventType, "mint_position");
  assert.equal(lifecycle[1]?.eventType, "stake");
  assert.equal(firstDelta[0]?.symbol, "WETH");
  assert.equal(firstDelta[0]?.amountFormatted, "1");

  const poolRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "pools");
  const poolRowJson = poolRow?.rowJson as Record<string, unknown> | undefined;
  const poolHistory = (poolRowJson?.history as { points: Array<Record<string, unknown>> }).points;
  const poolTimeline = (poolRowJson?.timeline as { items: Array<Record<string, unknown>> }).items;
  assert.equal(poolRowJson?.label, "WETH / USDC 100");
  assert.deepEqual(poolRowJson?.tokenSymbols, ["WETH", "USDC"]);
  assert.equal(poolRowJson?.feeTierLabel, "100");
  assert.equal(poolRowJson?.poolType, "cl");
  assert.equal(poolRowJson?.latestActivityAt, "2026-01-02T00:00:00.000Z");
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.depositId, "8453:0x00000000000000000000000000000000000000aa:1");
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.tickLower, -266400);
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.tickUpper, -265900);
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.rangeLowerPrice, 0.0269757447);
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.rangeUpperPrice, 0.0283587498);
  assert.equal((poolRowJson?.positions as { manualDeposits: Array<Record<string, unknown>> }).manualDeposits[0]?.isInRange, true);
  assert.equal(poolHistory[0]?.dayUtc, "2026-01-01");
  assert.equal(poolHistory[1]?.dayUtc, "2026-01-02");
  assert.equal(poolHistory[1]?.totalValueUsd, 10);
  assert.equal(poolTimeline[0]?.eventType, "stake");
  assert.equal(poolTimeline[1]?.eventType, "mint_position");
});

test("materializeAllDataViewRows labels basic volatile deposits without inventing tokenId", () => {
  const poolId = "8453:0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const poolAddress = poolId.split(":").at(-1) ?? "";
  const depositId = `8453:basic_amm:${poolAddress}`;
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "basic-open",
        chainId: 8453,
        walletAddress,
        eventType: "manual_pool_deposit_router",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xbasic-open",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolId,
          poolAddress,
          poolType: "volatile",
          valueUsd: "10",
        },
        evidenceJson: {
          movements: [
            {
              assetType: "erc20",
              direction: "out",
              tokenAddress: "0x4200000000000000000000000000000000000006",
              amountRaw: "1000000000000000000",
            },
            {
              assetType: "erc20",
              direction: "out",
              tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
              amountRaw: "7000000000",
            },
          ],
        },
      },
      {
        id: "basic-close",
        chainId: 8453,
        walletAddress,
        eventType: "manual_pool_withdraw_router",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xbasic-close",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          depositKind: "basic_amm",
          depositId,
          poolId,
          poolAddress,
          poolType: "volatile",
          valueUsd: "8",
        },
        evidenceJson: {
          movements: [
            {
              assetType: "erc20",
              direction: "in",
              tokenAddress: "0x4200000000000000000000000000000000000006",
              amountRaw: "900000000000000000",
            },
          ],
        },
      },
    ],
    links: [
      { domainEventId: "basic-open", entityType: "deposit", entityId: depositId },
      { domainEventId: "basic-open", entityType: "pool", entityId: poolId },
      { domainEventId: "basic-close", entityType: "deposit", entityId: depositId },
      { domainEventId: "basic-close", entityType: "pool", entityId: poolId },
    ],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map([[poolId, {
      poolId,
      poolAddress,
      token0Address: "0x4200000000000000000000000000000000000006",
      token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tickSpacing: null,
      feeTierBps: null,
      poolType: "volatile",
    }]]),
    tokenMetadataByAddress: new Map([
      ["0x4200000000000000000000000000000000000006", { tokenAddress: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 }],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 }],
      [poolAddress, { tokenAddress: poolAddress, symbol: "vAMM-WETH/USDC", decimals: 18 }],
    ]),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };

  const rows = materializeAllDataViewRows(accounting, context);
  const depositRow = rows.find((row) => row.surface === "deposits");
  const poolRow = rows.find((row) => row.surface === "pools");
  const depositJson = depositRow?.rowJson as Record<string, unknown> | undefined;
  const poolJson = poolRow?.rowJson as Record<string, unknown> | undefined;

  assert.equal(depositJson?.poolLabel, "WETH / USDC Volatile");
  assert.equal(depositJson?.positionLabel, "WETH / USDC Volatile");
  assert.equal(depositJson?.poolKind, "basic_volatile");
  assert.equal(depositJson?.tokenId, null);
  assert.equal(poolJson?.label, "WETH / USDC Volatile");
  assert.equal(poolJson?.poolType, "volatile");
});

test("materializeAllDataViewRows enriches strategy rows from pool context and owned rewards", () => {
  const poolId = "8453:0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const wrapperAddress = "0xcd975e6a5f55137755487f0918b8ca74acce7925";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "strategy-deposit",
        chainId: 8453,
        walletAddress,
        eventType: "strategy_deposit",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xstrategy-deposit",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          strategyExposureId: `8453:${wrapperAddress}`,
          wrapperAddress,
          poolId,
          shareDeltaRaw: "1000000000000000000",
          valueUsd: "100",
        },
        evidenceJson: {
          movements: [{
            assetType: "erc20",
            direction: "out",
            tokenAddress: "0x4200000000000000000000000000000000000006",
            amountRaw: "1000000000000000000",
          }],
        },
      },
      {
        id: "strategy-reward",
        chainId: 8453,
        walletAddress,
        eventType: "strategy_reward_claim",
        eventFamily: "strategy",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xstrategy-reward",
        sequenceIndex: 1,
        coverageStatus: "share_level",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          strategyExposureId: `8453:${wrapperAddress}`,
          wrapperAddress,
          rewardId: "reward-1",
          rewardType: "strategy_reward",
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          amountRaw: "2500000000000000000",
          amountUsd: "5",
        },
        evidenceJson: {
          movements: [{
            assetType: "erc20",
            direction: "in",
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            amountRaw: "2500000000000000000",
          }],
        },
      },
    ],
    links: [
      { domainEventId: "strategy-deposit", entityType: "strategy_exposure", entityId: `8453:${wrapperAddress}` },
      { domainEventId: "strategy-deposit", entityType: "pool", entityId: poolId },
      { domainEventId: "strategy-reward", entityType: "strategy_exposure", entityId: `8453:${wrapperAddress}` },
    ],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map([[poolId, {
      poolId,
      poolAddress: poolId.split(":").at(-1) ?? "",
      token0Address: "0x4200000000000000000000000000000000000006",
      token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tickSpacing: 100,
      feeTierBps: 100,
    }]]),
    tokenMetadataByAddress: new Map([
      [wrapperAddress, { tokenAddress: wrapperAddress, symbol: "MVS:WETH-USDC-100", decimals: 18 }],
      ["0x4200000000000000000000000000000000000006", { tokenAddress: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 }],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 }],
      ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", { tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", decimals: 18 }],
    ]),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map([[
      `8453:${wrapperAddress}`,
      {
        strategyExposureId: `8453:${wrapperAddress}`,
        wrapperAddress,
        underlyingPoolAddress: poolId.split(":").at(-1) ?? null,
        currentSharesRaw: "1000000000000000000",
        currentEstimatedValueUsd: 135,
      },
    ]]),
    strategyStateByWrapperAddress: new Map(),
  };

  const strategyRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "strategies");
  const rewardRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "rewards");
  const rowJson = strategyRow?.rowJson as Record<string, unknown> | undefined;
  const rewardRowJson = rewardRow?.rowJson as Record<string, unknown> | undefined;
  const lifecycle = Array.isArray(rowJson?.lifecycle) ? rowJson.lifecycle as Array<Record<string, unknown>> : [];
  const rewards = Array.isArray(rowJson?.rewards) ? rowJson.rewards as Array<Record<string, unknown>> : [];
  const history = Array.isArray(rowJson?.history) ? rowJson.history as Array<Record<string, unknown>> : [];

  assert.equal(rowJson?.strategyLabel, "Mellow WETH / USDC 100");
  assert.equal(rowJson?.poolLabel, "WETH / USDC 100");
  assert.equal(rowJson?.shareSymbol, "MVS:WETH-USDC-100");
  assert.equal(rowJson?.currentEstimatedValueUsd, 135);
  assert.equal(rowJson?.resolvedRewardCount, 1);
  assert.equal(rowJson?.unresolvedRewardCount, 0);
  assert.equal(lifecycle[1]?.eventType, "strategy_claim");
  assert.equal(rewards[0]?.tokenSymbol, "AERO");
  assert.equal(rewards[0]?.amountFormatted, "2.5");
  assert.equal(history[1]?.cumulativeRewardsUsd, 5);
  assert.equal((rewardRowJson?.token as Record<string, unknown>)?.symbol, "AERO");
  assert.equal((rewardRowJson?.poolContribution as Record<string, unknown>)?.status, "contributes");
  assert.equal((rewardRowJson?.poolContribution as Record<string, unknown>)?.poolLabel, "WETH / USDC 100");

  const poolRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "pools");
  const poolRowJson = poolRow?.rowJson as Record<string, unknown> | undefined;
  const automatedStrategies = (poolRowJson?.positions as { automatedStrategies: Array<Record<string, unknown>> }).automatedStrategies;
  const poolHistory = (poolRowJson?.history as { points: Array<Record<string, unknown>> }).points;
  const poolTimeline = (poolRowJson?.timeline as { items: Array<Record<string, unknown>> }).items;
  assert.equal(automatedStrategies[0]?.strategyLabel, "Mellow WETH / USDC 100");
  assert.equal(automatedStrategies[0]?.valueUsd, 135);
  assert.equal(poolHistory[1]?.rewardValueUsd, 5);
  assert.equal(poolHistory[1]?.cumulativeRewardsUsd, 5);
  assert.equal(poolTimeline[0]?.eventType, "strategy_reward");
  assert.equal(poolTimeline[0]?.relatedStrategyId, `8453:${wrapperAddress}`);
});

test("materializeAllDataViewRows keeps closed manual deposits in pool detail positions", () => {
  const poolId = "8453:0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const depositId = "8453:0x00000000000000000000000000000000000000aa:71093441";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "deposit-open",
        chainId: 8453,
        walletAddress,
        eventType: "manual_position_created",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xdeposit-open",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          depositId,
          tokenId: "71093441",
          poolId,
          valueUsd: "1200",
          rangeLowerTick: -210000,
          rangeUpperTick: -209000,
          rangeLowerPrice: "1.25",
          rangeUpperPrice: "1.5",
          isInRange: false,
        },
      },
      {
        id: "deposit-close",
        chainId: 8453,
        walletAddress,
        eventType: "manual_position_close",
        eventFamily: "deposit",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xdeposit-close",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          depositId,
          tokenId: "71093441",
          poolId,
          valueUsd: "800",
        },
      },
    ],
    links: [],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map([[poolId, {
      poolId,
      poolAddress: poolId.split(":").at(-1) ?? "",
      token0Address: "0x4200000000000000000000000000000000000006",
      token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tickSpacing: 100,
      feeTierBps: 100,
    }]]),
    tokenMetadataByAddress: new Map([
      ["0x4200000000000000000000000000000000000006", { tokenAddress: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 }],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 }],
    ]),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };

  const poolRow = materializeAllDataViewRows(accounting, context).find((row) => row.surface === "pools");
  const manualDeposits = ((poolRow?.rowJson as { positions?: { manualDeposits?: Array<Record<string, unknown>> } })?.positions?.manualDeposits) ?? [];

  assert.equal(manualDeposits.length, 1);
  assert.equal(manualDeposits[0]?.depositId, depositId);
  assert.equal(manualDeposits[0]?.status, "closed");
  assert.equal(manualDeposits[0]?.valueUsd, 800);
  assert.equal(manualDeposits[0]?.tickLower, -210000);
  assert.equal(manualDeposits[0]?.tickUpper, -209000);
  assert.equal(manualDeposits[0]?.rangeLowerPrice, 1.25);
  assert.equal(manualDeposits[0]?.rangeUpperPrice, 1.5);
  assert.equal(manualDeposits[0]?.isInRange, false);
});

test("materializeAllDataViewRows enriches governance rows from persisted lock metadata and explicit source evidence", () => {
  const poolId = "8453:0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59";
  const votingEscrowAddress = "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "gov-create",
        chainId: 8453,
        walletAddress,
        eventType: "governance_create_lock",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xgov-create",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          lockTokenId: "170",
          tokenId: "170",
          votingEscrowAddress,
          amountRaw: "2203245000000000000000",
          lockEnd: "2027-01-01T00:00:00.000Z",
        },
        evidenceJson: {
          movements: [{
            assetType: "erc20",
            direction: "out",
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            amountRaw: "2203245000000000000000",
            valueUsdAtEvent: "48264.31",
          }],
        },
      },
      {
        id: "gov-vote",
        chainId: 8453,
        walletAddress,
        eventType: "governance_vote",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xgov-vote",
        sequenceIndex: 1,
        coverageStatus: "partial",
        confidence: "medium",
        reasonCodes: ["missingVoteWeight"],
        metadataJson: {
          lockTokenId: "170",
          tokenId: "170",
          votingEscrowAddress,
          epochId: "170",
          epochStartAt: "2026-01-02T00:00:00.000Z",
          epochEndAt: "2026-01-09T00:00:00.000Z",
          poolId,
          governanceClassification: {
            protocolSurface: "voter",
            evidenceBasis: [{ kind: "decodedVoterCall" }],
            reasonCodes: ["missingVoteWeight"],
          },
          sourceEvidenceRefs: [{ provider: "moralis", kind: "tx" }],
        },
        evidenceJson: {
          movements: [{
            assetType: "erc20",
            direction: "none",
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            amountRaw: "0",
          }],
        },
      },
      {
        id: "gov-fee",
        chainId: 8453,
        walletAddress,
        eventType: "governance_fee_claim",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        txHash: "0xgov-fee",
        sequenceIndex: 2,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          lockTokenId: "170",
          tokenId: "170",
          votingEscrowAddress,
          epochId: "170",
          poolId,
          rewardId: "reward-governance-1",
          rewardType: "governance_fee",
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          amountRaw: "1000000000000000000",
          amountUsd: "2.5",
          sourceEvidenceRefs: [{ provider: "moralis", kind: "tx" }],
        },
        evidenceJson: {
          movements: [{
            assetType: "erc20",
            direction: "in",
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            amountRaw: "1000000000000000000",
            valueUsdAtEvent: "2.5",
          }],
        },
      },
    ],
    links: [
      { domainEventId: "gov-create", entityType: "governance_lock", entityId: `8453:${votingEscrowAddress}:170` },
      { domainEventId: "gov-vote", entityType: "governance_lock", entityId: `8453:${votingEscrowAddress}:170` },
      { domainEventId: "gov-vote", entityType: "pool", entityId: poolId },
      { domainEventId: "gov-fee", entityType: "governance_lock", entityId: `8453:${votingEscrowAddress}:170` },
      { domainEventId: "gov-fee", entityType: "pool", entityId: poolId },
    ],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map([[poolId, {
      poolId,
      poolAddress: poolId.split(":").at(-1) ?? "",
      token0Address: "0x4200000000000000000000000000000000000006",
      token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tickSpacing: 100,
      feeTierBps: 100,
    }]]),
    tokenMetadataByAddress: new Map([
      ["0x4200000000000000000000000000000000000006", { tokenAddress: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 }],
      ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 }],
      ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", { tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", decimals: 18 }],
    ]),
    governanceLockByLockKey: new Map([[`8453:${votingEscrowAddress}:170`, {
      lockKey: `8453:${votingEscrowAddress}:170`,
      lockTokenId: "170",
      votingEscrowAddress,
      originTxHash: "0xgov-create",
      originKind: "create_lock",
      status: "unknown",
      coverageStatus: "full",
      confidence: "high",
      reasonCodes: [],
      metadataJson: {
        lockKey: `8453:${votingEscrowAddress}:170`,
        lockedAeroValueUsd: "48264.31",
        veAeroExposure: "1845.771",
      },
    }]]),
    governanceLockByTokenId: new Map([["170", {
      lockKey: `8453:${votingEscrowAddress}:170`,
      lockTokenId: "170",
      votingEscrowAddress,
      originTxHash: "0xgov-create",
      originKind: "create_lock",
      status: "unknown",
      coverageStatus: "full",
      confidence: "high",
      reasonCodes: [],
      metadataJson: {
        lockKey: `8453:${votingEscrowAddress}:170`,
        lockedAeroValueUsd: "48264.31",
        veAeroExposure: "1845.771",
      },
    }]]),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };

  const rows = materializeAllDataViewRows(accounting, context).filter((row) => row.surface === "governance");
  const lockRow = rows.find((row) => (row.rowJson as Record<string, unknown>)?.kind === "lock");
  const eventRow = rows.find((row) => {
    const rowJson = row.rowJson as Record<string, unknown>;
    const event = rowJson?.event as Record<string, unknown> | undefined;
    return rowJson?.kind === "event" && event?.txHash === "0xgov-vote";
  });
  const rewardRow = rows.find((row) => (row.rowJson as Record<string, unknown>)?.kind === "reward");
  const epochRow = rows.find((row) => (row.rowJson as Record<string, unknown>)?.kind === "epoch");
  const metricRow = rows.find((row) => (row.rowJson as Record<string, unknown>)?.kind === "metric");

  const lockPanel = (lockRow?.rowJson as { lockPanel: Record<string, unknown> }).lockPanel;
  const governanceEvent = (eventRow?.rowJson as { event: Record<string, unknown> }).event;
  const governanceReward = (rewardRow?.rowJson as { reward: Record<string, unknown> }).reward;
  const governanceEpoch = (epochRow?.rowJson as { epoch: Record<string, unknown> }).epoch;
  const metricSnapshot = (metricRow?.rowJson as { metricSnapshot: { summary: Record<string, unknown> } }).metricSnapshot;
  const eventMetadata = governanceEvent.metadata as Record<string, unknown>;

  assert.equal(lockPanel.lockedAeroAmount, "2203245000000000000000");
  assert.equal(lockPanel.lockedAeroValueUsd, "48264.31");
  assert.equal(lockPanel.veAeroExposure, "1845.771");
  assert.equal(lockPanel.lockKind, "direct");
  assert.equal(lockPanel.status, "active");
  assert.equal((lockPanel.lifecycle as Array<Record<string, unknown>>)[0]?.durationDeltaDays, 365);
  assert.equal(governanceEvent.protocolSurface, "voter");
  assert.equal(eventMetadata.poolLabel, "WETH / USDC 100");
  assert.equal((eventMetadata.tokenMovements as Array<Record<string, unknown>>)[0]?.tokenSymbol, "AERO");
  assert.equal(governanceReward.rewardType, "fee");
  assert.equal(((governanceReward.token as Record<string, unknown>).symbol), "AERO");
  assert.equal((((governanceReward.pool as Record<string, unknown>).label)), "WETH / USDC 100");
  assert.equal(governanceEpoch.epochStartAt, "2026-01-02T00:00:00.000Z");
  assert.equal(governanceEpoch.epochEndAt, "2026-01-09T00:00:00.000Z");
  assert.equal(metricSnapshot.summary.lockedAero, "2203245000000000000000");
  assert.equal(metricSnapshot.summary.veAeroExposure, "1845.771");
});

test("materializeAllDataViewRows uses the primary direct lock in governance summary metrics when multiple locks exist", () => {
  const votingEscrowAddress = "0x00000000000000000000000000000000000000aa";
  const accounting = runChronologicalAccounting({
    events: [
      {
        id: "gov-grant",
        chainId: 8453,
        walletAddress,
        eventType: "governance_lock_grant",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        txHash: "0xgrant",
        sequenceIndex: 0,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { votingEscrowAddress, lockTokenId: "90" },
      },
      {
        id: "gov-create",
        chainId: 8453,
        walletAddress,
        eventType: "governance_create_lock",
        eventFamily: "governance",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        txHash: "0xdirect",
        sequenceIndex: 1,
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: { votingEscrowAddress, lockTokenId: "170", amountRaw: "2203245000000000000000" },
      },
    ],
    links: [
      { domainEventId: "gov-grant", entityType: "governance_lock", entityId: `8453:${votingEscrowAddress}:90` },
      { domainEventId: "gov-create", entityType: "governance_lock", entityId: `8453:${votingEscrowAddress}:170` },
    ],
  });

  const context: EngineV2MaterializationContext = {
    poolStateByPoolId: new Map(),
    tokenMetadataByAddress: new Map(),
    governanceLockByLockKey: new Map([
      [`8453:${votingEscrowAddress}:90`, {
        lockKey: `8453:${votingEscrowAddress}:90`,
        lockTokenId: "90",
        votingEscrowAddress,
        originTxHash: "0xgrant",
        originKind: "protocol_grant_or_external_transfer",
        status: "unknown",
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          provenance: "protocol_grant",
          lockedAeroValueUsd: "24.00",
          veAeroExposure: "10",
        },
      }],
      [`8453:${votingEscrowAddress}:170`, {
        lockKey: `8453:${votingEscrowAddress}:170`,
        lockTokenId: "170",
        votingEscrowAddress,
        originTxHash: "0xdirect",
        originKind: "create_lock",
        status: "unknown",
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        metadataJson: {
          lockedAeroAmount: "2203245000000000000000",
          lockedAeroValueUsd: "48264.31",
          veAeroExposure: "1845.771",
        },
      }],
    ]),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };

  const rows = materializeAllDataViewRows(accounting, context).filter((row) => row.surface === "governance");
  const metricRow = rows.find((row) => (row.rowJson as Record<string, unknown>)?.kind === "metric");
  const metricSnapshot = (metricRow?.rowJson as { metricSnapshot: { summary: Record<string, unknown> } }).metricSnapshot;

  assert.equal(metricSnapshot.summary.lockedAero, "2203245000000000000000");
  assert.equal(metricSnapshot.summary.veAeroExposure, "1845.771");
});
