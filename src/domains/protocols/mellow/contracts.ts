import { type FixtureSemantic } from "@/lib/fixture-loader";

export function isMellowSemantic(semantic: FixtureSemantic | null) {
  return semantic?.protocol === "mellow";
}

export function getMellowAction(semantic: FixtureSemantic | null) {
  if (!semantic || semantic.protocol !== "mellow") {
    return null;
  }

  return semantic.action;
}