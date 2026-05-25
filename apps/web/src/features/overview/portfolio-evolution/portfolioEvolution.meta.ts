import { ArrowDownToLine, ArrowUpToLine, Coins, Landmark, Lock, RefreshCcw, type LucideIcon } from "lucide-react";

import { cabColors } from "@/design-system/tokens";
import type { PortfolioEvolutionEventType } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";

export type PortfolioEvolutionSeriesKey = "total" | "deployed" | "idle" | "rewards";

export const portfolioEvolutionSeriesMeta: Record<PortfolioEvolutionSeriesKey, { labelKey: string; color: string }> = {
  total: { labelKey: "charts:series.netPortfolioValue", color: cabColors.brand.signalTeal },
  deployed: { labelKey: "charts:series.deployedValue", color: cabColors.brand.cabGold },
  idle: { labelKey: "charts:series.idleValue", color: cabColors.brand.electricBlue },
  rewards: { labelKey: "charts:series.rewardsAccumulated", color: cabColors.semantic.warning },
};

export const portfolioEvolutionEventMeta: Record<
  PortfolioEvolutionEventType,
  {
    labelKey: string;
    color: string;
    tone: "warning" | "info" | "success" | "neutral";
  }
> = {
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
  "claim",
  "redeploy",
  "move_to_idle",
  "rebalance",
  "lock",
  "vote",
];

export const portfolioEvolutionEventIcons: Record<PortfolioEvolutionEventType, LucideIcon> = {
  claim: Coins,
  redeploy: ArrowUpToLine,
  move_to_idle: ArrowDownToLine,
  rebalance: RefreshCcw,
  lock: Lock,
  vote: Landmark,
};