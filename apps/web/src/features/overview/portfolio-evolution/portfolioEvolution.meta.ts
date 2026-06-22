import { cabColors, type CabIconName } from "@/design-system";
import type { PortfolioEvolutionEventType } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";

export type PortfolioEvolutionSeriesKey = "total" | "deployed" | "idle" | "rewards";

export const portfolioEvolutionSeriesMeta: Record<PortfolioEvolutionSeriesKey, { labelKey: string; color: string }> = {
  total: { labelKey: "charts:series.netPortfolioValue", color: cabColors.brand.signalTeal },
  deployed: { labelKey: "charts:series.deployedValue", color: cabColors.brand.cabGold },
  idle: { labelKey: "charts:series.idleValue", color: cabColors.brand.electricBlue },
  rewards: { labelKey: "charts:series.rewardsAccumulated", color: cabColors.dataViz.violet },
};

export const portfolioEvolutionEventMeta: Record<
  PortfolioEvolutionEventType,
  {
    labelKey: string;
    color: string;
    tone: "warning" | "info" | "success" | "neutral";
  }
> = {
  cash_out: {
    labelKey: "overview:portfolioEvolution.events.cashOut",
    color: cabColors.semantic.warning,
    tone: "warning",
  },
  claim: {
    labelKey: "overview:portfolioEvolution.events.claim",
    color: cabColors.brand.cabGold,
    tone: "warning",
  },
  rebalance: {
    labelKey: "overview:portfolioEvolution.events.rebalance",
    color: cabColors.semantic.info,
    tone: "info",
  },
  move_to_idle: {
    labelKey: "overview:portfolioEvolution.events.moveToIdle",
    color: cabColors.semantic.success,
    tone: "success",
  },
  redeploy: {
    labelKey: "overview:portfolioEvolution.events.redeploy",
    color: cabColors.dataViz.violet,
    tone: "neutral",
  },
  lock: {
    labelKey: "overview:portfolioEvolution.events.lock",
    color: cabColors.semantic.warning,
    tone: "warning",
  },
  vote: {
    labelKey: "overview:portfolioEvolution.events.vote",
    color: cabColors.dataViz.cobalt,
    tone: "info",
  },
  swap: {
    labelKey: "overview:portfolioEvolution.events.swap",
    color: cabColors.brand.signalTeal,
    tone: "info",
  },
};

export const portfolioEvolutionEventOrder: PortfolioEvolutionEventType[] = [
  "cash_out",
  "claim",
  "redeploy",
  "move_to_idle",
  "rebalance",
  "swap",
  "lock",
  "vote",
];

export const portfolioEvolutionEventIcons: Record<PortfolioEvolutionEventType, CabIconName> = {
  cash_out: "externalLink",
  claim: "coins",
  redeploy: "arrowUpToLine",
  move_to_idle: "arrowDownToLine",
  rebalance: "refreshCcw",
  swap: "activity",
  lock: "lock",
  vote: "governance",
};
