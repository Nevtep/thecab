import { PoolAssignmentService } from "@/domains/ledger/services/pool-assignment-service";
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
});