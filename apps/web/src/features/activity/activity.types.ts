import type { ActivityResponse } from "@/server/activity/activity.types";

export type ActivityUrlState = {
  search: string;
  surface: "all" | "wallet" | "pools" | "deposits" | "strategies" | "rewards" | "governance" | "unknown";
  action: "all" | "approval" | "failed" | "position_created" | "deposit" | "withdraw" | "swap" | "claim" | "strategy" | "governance" | "stake" | "unstake" | "cash_in" | "cash_out" | "noop" | "transfer" | "airdrop" | "unsupported" | "ambiguous";
  coverage: "full" | "partial" | "unresolved" | "excluded" | "unavailable" | null;
  confidence: "high" | "medium" | "low" | "none" | null;
  poolId: string | null;
  depositId: string | null;
  strategyId: string | null;
  rewardEventId: string | null;
  governanceEventId: string | null;
  selectedActivityId: string | null;
  sort: {
    key: "occurredAt" | "valueUsd" | "action" | "coverage" | "confidence";
    direction: "asc" | "desc";
  };
  page: number;
  pageSize: 10 | 25 | 50 | 100;
};

export type ActivityViewModel = ActivityResponse;
