import { type FixtureSemantic } from "@/lib/fixture-loader";

export const AERODROME_POSITION_MANAGER_ADDRESSES = [
  "0x827922686190790b37229fd06084350e74485b72"
] as const;

export function isAerodromeSemantic(semantic: FixtureSemantic | null) {
  return semantic?.protocol === "aerodrome";
}

export function getAerodromeAction(semantic: FixtureSemantic | null) {
  if (!semantic || semantic.protocol !== "aerodrome") {
    return null;
  }

  return semantic.action;
}