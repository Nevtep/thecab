import type { Address } from "./types";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function normalizeAddress(value: unknown): Address | "" {
  return typeof value === "string" && value.startsWith("0x")
    ? value.toLowerCase() as Address
    : "";
}

export function normalizeTxHash(value: unknown): `0x${string}` | "" {
  return typeof value === "string" && value.startsWith("0x")
    ? value.toLowerCase() as `0x${string}`
    : "";
}

export function topicAddress(topic: unknown): Address | "" {
  if (typeof topic !== "string" || topic.length !== 66) return "";
  return `0x${topic.slice(26)}`.toLowerCase() as Address;
}

export function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "";
}
