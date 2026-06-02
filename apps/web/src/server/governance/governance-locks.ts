import type { GovernanceLockKind, GovernanceLockPanel } from "@/server/governance/governance.types";

function asLower(value: string | null | undefined) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function normalizeGovernanceLockKind(value: string | null | undefined): GovernanceLockKind | null {
  if (
    value === "direct" ||
    value === "deposited_managed" ||
    value === "managed_or_relay" ||
    value === "protocol_grant" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

export function deriveGovernanceLockKind(input: {
  status?: string | null;
  originKind?: string | null;
  managedTokenId?: string | null;
  provenance?: string | null;
  explicitKind?: string | null;
}): GovernanceLockKind {
  const explicitKind = normalizeGovernanceLockKind(input.explicitKind);
  if (explicitKind) return explicitKind;

  const status = asLower(input.status);
  const originKind = asLower(input.originKind);
  const provenance = asLower(input.provenance);

  if (status.includes("relay") || originKind.includes("relay") || provenance.includes("relay")) {
    return "managed_or_relay";
  }

  if (
    status === "deposited_managed" ||
    status === "partial" ||
    (typeof input.managedTokenId === "string" && input.managedTokenId.length > 0)
  ) {
    return "deposited_managed";
  }

  if (provenance === "protocol_grant" || originKind.includes("grant")) {
    return "protocol_grant";
  }

  if (
    status === "active" ||
    status === "expired" ||
    status === "withdrawn" ||
    originKind.includes("create") ||
    originKind.includes("lock")
  ) {
    return "direct";
  }

  return "unknown";
}

export function governanceLockIdentity(lock: Pick<GovernanceLockPanel, "lockExposureId" | "lockId">): string | null {
  return lock.lockExposureId ?? lock.lockId ?? null;
}

function governanceLockRank(lock: GovernanceLockPanel) {
  if (lock.status === "withdrawn") return 60;
  if (lock.lockKind === "direct" && lock.status === "active") return 0;
  if (lock.lockKind === "direct") return 10;
  if (lock.lockKind === "protocol_grant") return 20;
  if (lock.lockKind === "deposited_managed") return 30;
  if (lock.lockKind === "managed_or_relay") return 40;
  return 50;
}

export function sortGovernanceLockPanels(rows: GovernanceLockPanel[]) {
  return [...rows].sort((left, right) => {
    const rankDifference = governanceLockRank(left) - governanceLockRank(right);
    if (rankDifference !== 0) return rankDifference;

    const expiresAtComparison = (right.expiresAt ?? "").localeCompare(left.expiresAt ?? "");
    if (expiresAtComparison !== 0) return expiresAtComparison;

    const createdAtComparison = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
    if (createdAtComparison !== 0) return createdAtComparison;

    return (governanceLockIdentity(left) ?? "").localeCompare(governanceLockIdentity(right) ?? "");
  });
}

export function selectPrimaryGovernanceLockId(rows: GovernanceLockPanel[]) {
  return governanceLockIdentity(sortGovernanceLockPanels(rows)[0] ?? { lockExposureId: null, lockId: null });
}

export function resolvePrimaryGovernanceLockPanel(input: {
  rows: GovernanceLockPanel[];
  primaryLockId: string | null;
}) {
  return input.rows.find((row) => governanceLockIdentity(row) === input.primaryLockId) ?? input.rows[0] ?? null;
}