import assert from "node:assert/strict";
import test from "node:test";

import { selectPrimaryGovernanceLockId, sortGovernanceLockPanels } from "@/server/governance/governance-locks";
import type { GovernanceLockPanel } from "@/server/governance/governance.types";

function lock(overrides: Partial<GovernanceLockPanel> = {}): GovernanceLockPanel {
  return {
    lockExposureId: "lock-1",
    lockId: "1",
    lockKind: "unknown",
    status: "unknown",
    createdAt: null,
    expiresAt: null,
    managedTokenId: null,
    lockedAeroAmount: null,
    lockedAeroValueUsd: null,
    veAeroExposure: null,
    coverageState: "full",
    confidence: "high",
    reasonCodes: [],
    lifecycle: [],
    ...overrides,
  };
}

test("sortGovernanceLockPanels ranks direct active locks ahead of protocol-grant and deposited-managed locks", () => {
  const rows = sortGovernanceLockPanels([
    lock({ lockExposureId: "grant", lockId: "90", lockKind: "protocol_grant", status: "active" }),
    lock({ lockExposureId: "managed", lockId: "120", lockKind: "deposited_managed", status: "partial", managedTokenId: "500" }),
    lock({ lockExposureId: "direct", lockId: "170", lockKind: "direct", status: "active", expiresAt: "2027-05-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(rows.map((row) => row.lockExposureId), ["direct", "grant", "managed"]);
  assert.equal(selectPrimaryGovernanceLockId(rows), "direct");
});