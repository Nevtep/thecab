import assert from "node:assert/strict";
import test from "node:test";

import {
  isMellowRewardRecord,
  resolveMellowRewardWrapperAddress,
} from "@/server/protocols/mellow/computeShareLevelAccounting";

test("resolveMellowRewardWrapperAddress finds active strategy wrappers from history signals", () => {
  const wrapperAddress = resolveMellowRewardWrapperAddress({
    record: {
      category: "token receive",
      summary: "Received 7,392.30 AERO from 0xcd...7925",
      to_address: "0xcd975e6a5f55137755487f0918b8ca74acce7925",
      method_label: "getRewards",
    },
    currentWrappers: new Set(["0xcd975e6a5f55137755487f0918b8ca74acce7925"]),
  });

  assert.equal(wrapperAddress, "0xcd975e6a5f55137755487f0918b8ca74acce7925");
});

test("isMellowRewardRecord treats wrapper getRewards token receives as strategy rewards even when protocol detection is not mellow", () => {
  const result = isMellowRewardRecord({
    detectedProtocol: "aerodrome",
    category: "token receive",
    methodLabel: "getRewards",
    summary: "Received 7,392.30 AERO from 0xcd...7925",
    wrapperAddress: "0xcd975e6a5f55137755487f0918b8ca74acce7925",
  });

  assert.equal(result, true);
});

test("isMellowRewardRecord does not treat generic wrapper token receives as rewards without getRewards context", () => {
  const result = isMellowRewardRecord({
    detectedProtocol: "aerodrome",
    category: "token receive",
    methodLabel: "withdraw",
    summary: "Received USDC from wrapper",
    wrapperAddress: "0xcd975e6a5f55137755487f0918b8ca74acce7925",
  });

  assert.equal(result, false);
});