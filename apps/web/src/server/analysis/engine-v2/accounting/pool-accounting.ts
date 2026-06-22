import type { EngineV2ResidualInventoryProjection } from "./cash-residual-accounting";
import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";
import type { EngineV2DepositProjection } from "./deposit-accounting";
import type { EngineV2RewardProjection } from "./reward-accounting";
import type { EngineV2StrategyProjection } from "./strategy-accounting";

export type EngineV2PoolProjection = {
  poolId: string;
  manualDepositValueUsd: string;
  strategyValueUsd: string;
  rewardValueUsd: string;
  residualTokenAddresses: string[];
  coverageStatus: string;
  reasonCodes: string[];
};

function addNumberString(left: string, right: string | null | undefined) {
  if (!right) return left;
  const total = Number(left) + Number(right);
  return Number.isFinite(total) ? String(total) : left;
}

function poolLinks(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike) {
  if (!event.id) return [];
  return links.filter((link) => link.domainEventId === event.id && link.entityType === "pool").map((link) => link.entityId);
}

function upsertPool(map: Map<string, EngineV2PoolProjection>, poolId: string) {
  const current = map.get(poolId) ?? {
    poolId,
    manualDepositValueUsd: "0",
    strategyValueUsd: "0",
    rewardValueUsd: "0",
    residualTokenAddresses: [],
    coverageStatus: "full",
    reasonCodes: [],
  } satisfies EngineV2PoolProjection;
  map.set(poolId, current);
  return current;
}

export function accountPools(input: {
  events: EngineV2DomainEventLike[];
  links?: EngineV2EntityLinkLike[];
  deposits?: EngineV2DepositProjection[];
  strategies?: EngineV2StrategyProjection[];
  rewards?: EngineV2RewardProjection[];
  residualInventory?: EngineV2ResidualInventoryProjection[];
}) {
  const pools = new Map<string, EngineV2PoolProjection>();

  for (const deposit of input.deposits ?? []) {
    if (!deposit.poolId) continue;
    const pool = upsertPool(pools, deposit.poolId);
    pool.manualDepositValueUsd = addNumberString(pool.manualDepositValueUsd, deposit.currentOrCloseValueUsd ?? deposit.openedValueUsd);
  }

  for (const strategy of input.strategies ?? []) {
    if (!strategy.poolId) continue;
    const pool = upsertPool(pools, strategy.poolId);
    pool.strategyValueUsd = addNumberString(pool.strategyValueUsd, strategy.depositedValueUsd);
  }

  for (const reward of input.rewards ?? []) {
    if (!reward.poolId || reward.poolContribution !== "contributes" || !reward.affectsTotals) continue;
    if (reward.ownerStatus !== "manual_deposit" && reward.ownerStatus !== "strategy") continue;
    const pool = upsertPool(pools, reward.poolId);
    pool.rewardValueUsd = addNumberString(pool.rewardValueUsd, reward.amountUsd);
  }

  for (const event of input.events) {
    for (const poolId of poolLinks(input.links ?? [], event)) {
      const pool = upsertPool(pools, poolId);
      if (event.coverageStatus !== "full") pool.coverageStatus = event.coverageStatus;
      pool.reasonCodes = [...new Set([...pool.reasonCodes, ...event.reasonCodes])];
    }
  }

  for (const residual of input.residualInventory ?? []) {
    if (!residual.poolId) continue;
    const pool = upsertPool(pools, residual.poolId);
    if (!pool.residualTokenAddresses.includes(residual.tokenAddress)) {
      pool.residualTokenAddresses.push(residual.tokenAddress);
    }
  }

  return [...pools.values()];
}
