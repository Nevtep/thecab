import assert from "node:assert/strict";
import test from "node:test";

import { selectDeterministicLpSugarPositionReference } from "@/server/protocol-positions/readMellowStrategyPositions";

test("selectDeterministicLpSugarPositionReference returns the single wallet-scoped alm match", () => {
  const result = selectDeterministicLpSugarPositionReference({
    wrapperAddress: "0x55F54B1f63125Fce3c90F30856CE9d928FF47C26",
    positions: [
      { id: "71140295", alm: "0x55f54b1f63125fce3c90f30856ce9d928ff47c26" },
      { id: "71496797", alm: "0xcd975e6a5f55137755487f0918b8ca74acce7925" },
    ],
  });

  assert.deepEqual(result, {
    externalDepositReference: "71140295",
    externalDepositReferenceStatus: "resolved",
  });
});

test("selectDeterministicLpSugarPositionReference stays unresolved when multiple rows match the wrapper", () => {
  const result = selectDeterministicLpSugarPositionReference({
    wrapperAddress: "0x55F54B1f63125Fce3c90F30856CE9d928FF47C26",
    positions: [
      { id: "71140295", alm: "0x55f54b1f63125fce3c90f30856ce9d928ff47c26" },
      { id: "71140296", alm: "0x55f54b1f63125fce3c90f30856ce9d928ff47c26" },
    ],
  });

  assert.deepEqual(result, {
    externalDepositReference: null,
    externalDepositReferenceStatus: "unresolved",
  });
});