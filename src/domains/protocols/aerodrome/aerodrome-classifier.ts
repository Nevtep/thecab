import { getAerodromeAction } from "@/domains/protocols/aerodrome/contracts";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export function classifyAerodromeEventType(semantic: FixtureSemantic) {
  switch (getAerodromeAction(semantic)) {
    case "mint":
      return "manual_position_opened" as const;
    case "increaseLiquidity":
      return "manual_liquidity_added" as const;
    case "decreaseLiquidity":
      return "manual_liquidity_removed" as const;
    case "closePosition":
      return "manual_position_closed" as const;
    case "collect":
      return "manual_fees_collected" as const;
    case "swap":
      return "swap" as const;
    default:
      return null;
  }
}