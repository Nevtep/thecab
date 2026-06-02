import { accountCashAndResidualInventory } from "./cash-residual-accounting";
import { accountManualDeposits } from "./deposit-accounting";
import { accountGovernance } from "./governance-accounting";
import { accountPools } from "./pool-accounting";
import { accountRewards } from "./reward-accounting";
import { accountStrategies } from "./strategy-accounting";

export type EngineV2DomainEventLike = {
  id?: string | null;
  chainId: number;
  walletAddress: string;
  canonicalTransactionId?: string | null;
  eventType: string;
  eventFamily: string;
  occurredAt: Date;
  txHash: string;
  sequenceIndex: number;
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
  valueEffectJson?: Record<string, unknown> | null;
  evidenceJson?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
};

export type EngineV2EntityLinkLike = {
  domainEventId: string;
  entityType: string;
  entityId: string;
  linkKind?: string;
  confidence?: string;
  evidenceJson?: Record<string, unknown> | null;
};

export type EngineV2AccountingInput = {
  events: EngineV2DomainEventLike[];
  links?: EngineV2EntityLinkLike[];
};

export type EngineV2AccountingOutput = {
  events: EngineV2DomainEventLike[];
  cashFlows: ReturnType<typeof accountCashAndResidualInventory>["cashFlows"];
  residualInventory: ReturnType<typeof accountCashAndResidualInventory>["residualInventory"];
  deposits: ReturnType<typeof accountManualDeposits>;
  strategies: ReturnType<typeof accountStrategies>;
  pools: ReturnType<typeof accountPools>;
  rewards: ReturnType<typeof accountRewards>;
  governance: ReturnType<typeof accountGovernance>;
};

export function sortDomainEventsChronologically(events: EngineV2DomainEventLike[]) {
  return [...events].sort((left, right) => {
    const timeDelta = left.occurredAt.getTime() - right.occurredAt.getTime();
    if (timeDelta !== 0) return timeDelta;
    return left.sequenceIndex - right.sequenceIndex;
  });
}

export function runChronologicalAccounting(input: EngineV2AccountingInput): EngineV2AccountingOutput {
  const events = sortDomainEventsChronologically(input.events);
  const links = input.links ?? [];
  const cash = accountCashAndResidualInventory({ events });
  const deposits = accountManualDeposits({ events, links });
  const strategies = accountStrategies({ events, links });
  const rewards = accountRewards({ events, links, deposits });
  const governance = accountGovernance({ events, links });
  const pools = accountPools({
    events,
    links,
    deposits,
    strategies,
    rewards,
    residualInventory: cash.residualInventory,
  });

  return {
    events,
    cashFlows: cash.cashFlows,
    residualInventory: cash.residualInventory,
    deposits,
    strategies,
    pools,
    rewards,
    governance,
  };
}
