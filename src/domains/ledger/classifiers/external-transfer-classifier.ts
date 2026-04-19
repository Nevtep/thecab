import { type FixtureSemantic } from "@/lib/fixture-loader";

export function classifyExternalTransfer(semantic: FixtureSemantic | null) {
  if (!semantic || semantic.protocol !== "wallet") {
    return null;
  }

  if (semantic.action === "external_deposit") {
    return "external_deposit" as const;
  }

  if (semantic.action === "external_withdrawal") {
    return "external_withdrawal" as const;
  }

  return null;
}