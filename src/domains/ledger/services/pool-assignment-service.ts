import { buildPoolId, buildStrategyId } from "@/domains/ledger/model/ids";
import { type Pool, type Strategy, type StrategyType } from "@/domains/ledger/model/pool";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export class PoolAssignmentService {
  assign(input: { chainId: number; semantic: FixtureSemantic }) {
    if (!input.semantic.pool) {
      return { pool: null, strategy: null };
    }

    const poolId = buildPoolId(
      input.chainId,
      input.semantic.pool.protocolFamily,
      input.semantic.pool.address
    );
    const strategyType: StrategyType = input.semantic.protocol === "mellow" ? "mellow_auto" : "manual";
    const strategyId = buildStrategyId(poolId, strategyType, input.semantic.sourceContractAddress ?? null);

    const pool: Pool = {
      poolId,
      chainId: input.chainId,
      protocolFamily: input.semantic.pool.protocolFamily,
      poolAddress: input.semantic.pool.address,
      token0Address: input.semantic.pool.token0Address,
      token1Address: input.semantic.pool.token1Address,
      feeTier: input.semantic.pool.feeTier ?? null,
      displayName: input.semantic.pool.displayName,
      status: "active"
    };

    const strategy: Strategy = {
      strategyId,
      poolId,
      strategyType,
      sourceContractAddress: input.semantic.sourceContractAddress ?? null,
      label: strategyType === "manual" ? "Manual" : "Mellow Auto",
      status: "active"
    };

    return { pool, strategy };
  }
}