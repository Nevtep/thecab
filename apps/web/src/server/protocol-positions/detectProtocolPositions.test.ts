import assert from "node:assert/strict";
import test from "node:test";

import { collectAerodromeManualPositionTokenIds } from "@/server/protocol-positions/detectProtocolPositions";

test("collectAerodromeManualPositionTokenIds keeps active hinted Aerodrome token ids", () => {
  const result = collectAerodromeManualPositionTokenIds({
    hintedTokenIds: ["71093441", "71251309", "71093441", ""],
    reconstructedRows: [
      { protocol: "aerodrome", family: "manual_deposit", tokenId: "71498850" },
      { protocol: "aerodrome", family: "staked_lp", tokenId: "71093441" },
      { protocol: "aerodrome", family: "governance_lock", tokenId: "999" },
      { protocol: "mellow", family: "strategy_exposure", tokenId: "71496437" },
      { protocol: "aerodrome", family: "manual_deposit", tokenId: null },
    ],
  });

  assert.deepEqual(result, ["71093441", "71251309", "71498850"]);
});

test("collectAerodromeManualPositionTokenIds falls back to reconstructed Aerodrome manual state", () => {
  const result = collectAerodromeManualPositionTokenIds({
    reconstructedRows: [
      { protocol: "aerodrome", family: "staked_lp", tokenId: "71093441" },
      { protocol: "aerodrome", family: "manual_deposit", tokenId: "71251309" },
      { protocol: "mellow", family: "strategy_exposure", tokenId: "71140295" },
    ],
  });

  assert.deepEqual(result, ["71093441", "71251309"]);
});