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
    color: "#8B5CF6",
    tone: "neutral",
  },
  lock: {
    labelKey: "overview:portfolioEvolution.events.lock",
    color: cabColors.semantic.warning,
    tone: "warning",
  },
  vote: {
    labelKey: "overview:portfolioEvolution.events.vote",
    color: "#6366F1",
    tone: "info",
  },
};

export const portfolioEvolutionEventOrder: PortfolioEvolutionEventType[] = [
  "cash_out",
  "claim",
  "redeploy",
  "move_to_idle",
  "rebalance",
  "lock",
  "vote",
];

export const portfolioEvolutionEventIcons: Record<PortfolioEvolutionEventType, CabIconName> = {
  cash_out: "externalLink",
  claim: "coins",
  redeploy: "arrowUpToLine",
  move_to_idle: "arrowDownToLine",
  rebalance: "refreshCcw",
  lock: "lock",
  vote: "governance",
};