import type { OverviewRange } from "@/features/overview/overview.types";

export function getOverviewTimeUnit(range: OverviewRange) {
  return range === "24h" ? "hour" : "day";
}