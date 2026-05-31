import type { ActivityResponse } from "@/server/activity/activity.types";

export type ActivityUrlState = {
  search: string;
  surface: "all" | "wallet" | "pools" | "deposits" | "strategies" | "rewards" | "governance" | "unknown";
  action: "all" | "deposit" | "withdraw" | "swap" | "claim" | "strategy" | "governance" | "transfer" | "airdrop" | "unsupported" | "ambiguous";
  coverage: "full" | "partial" | "unresolved" | "excluded" | "unavailable" | null;
  confidence: "high" | "medium" | "low" | "none" | null;
  selectedActivityId: string | null;
  sort: {
    key: "occurredAt" | "valueUsd" | "action" | "coverage" | "confidence";
    direction: "asc" | "desc";
  };
  page: number;
  pageSize: 10 | 25 | 50 | 100;
};

export type ActivityViewModel = ActivityResponse;
