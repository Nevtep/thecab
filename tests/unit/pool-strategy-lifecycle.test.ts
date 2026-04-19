import { PoolAssignmentService } from "@/domains/ledger/services/pool-assignment-service";
import { ClassificationEngine } from "@/domains/ledger/classifiers/classification-engine";
import { ManualPositionLifecycleService } from "@/domains/protocols/aerodrome/manual-position-lifecycle-service";

describe("pool, strategy, and lifecycle rules", () => {
  it("keeps manual and mellow activity under one pool but different strategies", () => {
    const service = new PoolAssignmentService();
    const manual = service.assign({
      chainId: 8453,
      semantic: {
        protocol: "aerodrome",
        action: "mint",
        pool: {
          address: "0xpool",
          protocolFamily: "aerodrome_slipstream",
          displayName: "WETH / USDC",
          token0Address: "0xweth",
          token1Address: "0xusdc"
        }
      }
    });
    const mellow = service.assign({
      chainId: 8453,
      semantic: {
        protocol: "mellow",
        action: "depositAndStake",
        pool: {
          address: "0xpool",
          protocolFamily: "aerodrome_slipstream",
          displayName: "WETH / USDC",
          token0Address: "0xweth",
          token1Address: "0xusdc"
        }
      }
    });

    expect(manual.pool?.poolId).toBe(mellow.pool?.poolId);
    expect(manual.strategy?.strategyId).not.toBe(mellow.strategy?.strategyId);
    expect(manual.strategy?.strategyType).toBe("manual");
    expect(mellow.strategy?.strategyType).toBe("mellow_auto");
  });

  it("keeps increaseLiquidity on the same manual lifecycle", () => {
    const service = new ManualPositionLifecycleService();
    const state = new Map();
    const opened = service.resolve({
      semantic: { protocol: "aerodrome", action: "mint", tokenId: "42" },
      strategyId: "strategy_1",
      state
    });
    const increased = service.resolve({
      semantic: { protocol: "aerodrome", action: "increaseLiquidity", tokenId: "42" },
      strategyId: "strategy_1",
      state
    });

    expect(opened?.positionInstanceId).toBe(increased?.positionInstanceId);
  });

  it("keeps mellow identity stable when a staking address is discovered later", async () => {
    const engine = new ClassificationEngine();
    const state = {
      manualPositions: new Map(),
      mellowPositions: new Map(),
      poolAddressToId: new Map()
    };

    const pool = {
      address: "0xpool",
      protocolFamily: "mellow_aerodrome",
      displayName: "WETH / cbBTC",
      token0Address: "0xweth",
      token1Address: "0xcbbtc"
    };

    const opened = await engine.classifyTransaction({
      reconstructionRunId: "run_1",
      analysisSessionId: "session_1",
      walletAddress: "0x1000000000000000000000000000000000000001",
      eventSequence: 0,
      state,
      observations: [
        {
          rawObservationId: "raw_1",
          sourceType: "transaction",
          chainId: 8453,
          blockNumber: 1,
          blockHash: "0xblock1",
          txHash: "0xtx1",
          payloadJson: {
            timestamp: "2026-04-19T00:00:00.000Z",
            semantic: {
              protocol: "mellow",
              action: "depositAndStake",
              pool,
              sourceContractAddress: "0x0df5f2662e4a8c801c04d83df717476509816250",
              wrapperAddress: "0x0df5f2662e4a8c801c04d83df717476509816250",
              shareBalanceRaw: "100",
              lifecycleSequence: 1
            }
          }
        }
      ]
    });

    const reward = await engine.classifyTransaction({
      reconstructionRunId: "run_1",
      analysisSessionId: "session_1",
      walletAddress: "0x1000000000000000000000000000000000000001",
      eventSequence: 1,
      state,
      observations: [
        {
          rawObservationId: "raw_2",
          sourceType: "transaction",
          chainId: 8453,
          blockNumber: 2,
          blockHash: "0xblock2",
          txHash: "0xtx2",
          payloadJson: {
            timestamp: "2026-04-19T00:01:00.000Z",
            semantic: {
              protocol: "mellow",
              action: "claimReward",
              pool,
              sourceContractAddress: "0x0df5f2662e4a8c801c04d83df717476509816250",
              wrapperAddress: "0x0df5f2662e4a8c801c04d83df717476509816250",
              stakingRewardsAddress: "0x2000000000000000000000000000000000000002",
              shareBalanceRaw: "100"
            }
          }
        }
      ]
    });

    expect(opened.positionIdentity?.identityReference).toBe(
      "0x0df5f2662e4a8c801c04d83df717476509816250"
    );
    expect(reward.positionIdentity?.identityReference).toBe(
      "0x0df5f2662e4a8c801c04d83df717476509816250"
    );
    expect(state.mellowPositions.has("0x0df5f2662e4a8c801c04d83df717476509816250")).toBe(true);
  });
});