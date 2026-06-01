import assert from "node:assert/strict";
import test from "node:test";

import { governanceLockFromTransferBackfill, shouldBackfillGovernanceLockOrigin } from "./lock-identity-backfill";

test("shouldBackfillGovernanceLockOrigin only applies to governance methods with missing lock identity", () => {
  assert.equal(shouldBackfillGovernanceLockOrigin({
    eventType: "governance_deposit_managed",
    tokenId: "113464",
    hasKnownLock: false,
  }), true);
  assert.equal(shouldBackfillGovernanceLockOrigin({
    eventType: "cash_in_native",
    tokenId: "113464",
    hasKnownLock: false,
  }), false);
});

test("governanceLockFromTransferBackfill records protocol grant provenance", () => {
  const row = governanceLockFromTransferBackfill({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    votingEscrowAddress: "0x0000000000000000000000000000000000000002",
    tokenId: "113464",
    originTxHash: "0xabc",
    source: "nft_transfer_history",
    provenance: "protocol_grant",
  });

  assert.equal(row.coverageStatus, "full");
  assert.equal(row.metadataJson?.provenance, "protocol_grant");
});
