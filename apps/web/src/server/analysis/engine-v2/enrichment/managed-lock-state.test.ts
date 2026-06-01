import assert from "node:assert/strict";
import test from "node:test";

import { managedLockLinkValues, managedLockStateSnapshot } from "./managed-lock-state.worker";

test("managedLockLinkValues stores userTokenId to managedTokenId without ownership merge", () => {
  const row = managedLockLinkValues({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    userLockId: "lock-user",
    managedLockId: "lock-managed",
    userTokenId: "113464",
    managedTokenId: "10298",
  });

  assert.equal(row.userTokenId, "113464");
  assert.equal(row.managedTokenId, "10298");
  assert.equal(row.evidenceJson?.relationKind, "deposited_managed");
});

test("managedLockStateSnapshot is current-state evidence", () => {
  const row = managedLockStateSnapshot({
    chainId: 8453,
    votingEscrowAddress: "0x0000000000000000000000000000000000000001",
    userTokenId: "113464",
    managedTokenId: "10298",
  });

  assert.equal(row.subjectType, "managed_lock_relation");
  assert.equal(row.stateJson?.managedTokenId, "10298");
});
