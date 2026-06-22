import {
  mapActivityLedgerRow,
  type ActivityLedgerReadModelInput,
} from "@/server/activity/activity.repository";
import type { ActivityEventRow, ActivitySummary } from "@/server/activity/activity.types";

type ActivityReadModelBuildInput = ActivityLedgerReadModelInput;

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toFixed(value: number, digits = 2) {
  return value.toFixed(digits);
}

export function buildActivityReadModelRow(input: ActivityReadModelBuildInput): ActivityEventRow {
  return mapActivityLedgerRow(input.ledgerEvent, input.movements);
}

export function buildActivityReadModelRows(inputs: ActivityReadModelBuildInput[]): ActivityEventRow[] {
  return inputs.map(buildActivityReadModelRow);
}

export function buildActivityReadModelSummary(rows: ActivityEventRow[]): ActivitySummary {
  const excludedEvents = rows.filter((row) => row.coverage === "excluded").length;
  const unresolvedEvents = rows.filter((row) => row.coverage === "unresolved" || row.coverage === "unavailable").length;
  const fullEvents = rows.filter((row) => row.coverage === "full").length;
  const totalValueUsd = rows
    .filter((row) => row.coverage !== "excluded")
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);
  const walletCapitalInUsd = rows
    .filter((row) => row.coverage !== "excluded" && row.action === "cash_in")
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);
  const walletCapitalOutUsd = rows
    .filter((row) => row.coverage !== "excluded" && row.action === "cash_out")
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);
  const protocolVolumeUsd = rows
    .filter((row) =>
      row.coverage !== "excluded" &&
      ["deposit", "position_created", "withdraw", "swap", "claim", "strategy", "stake", "unstake", "governance"].includes(row.action),
    )
    .reduce((sum, row) => sum + (asNumber(row.valueUsd) ?? 0), 0);

  return {
    totalEvents: rows.length,
    interpretedEvents: rows.length - excludedEvents - unresolvedEvents,
    totalValueUsd: toFixed(totalValueUsd),
    walletCapitalInUsd: toFixed(walletCapitalInUsd),
    walletCapitalOutUsd: toFixed(walletCapitalOutUsd),
    protocolVolumeUsd: toFixed(protocolVolumeUsd),
    excludedEvents,
    unresolvedEvents,
    coveragePercent: rows.length > 0 ? toFixed((fullEvents / rows.length) * 100, 1) : "100.0",
  };
}
