import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAerodromeMintParamsFromTransactionInput,
  extractAerodromeRewardRecordTokenId,
  extractAerodromeRewardTokenIdFromTransactionInput,
  resolveAerodromeRewardCandidateTokenId,
} from "@/server/protocols/aerodrome/decodeDepositLifecycle";

test("extractAerodromeRewardRecordTokenId reads a single nested token id from decoded input", () => {
  const result = extractAerodromeRewardRecordTokenId({
    category: "token receive",
    decoded_call: {
      params: {
        tokenIds: [71093441],
      },
    },
  });

  assert.equal(result, "71093441");
});

test("extractAerodromeRewardTokenIdFromTransactionInput decodes direct CLGauge getReward calldata", () => {
  const result = extractAerodromeRewardTokenIdFromTransactionInput(
    "0x1c4b774b00000000000000000000000000000000000000000000000000000000043cccc1",
  );

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId keeps explicit token ids", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: "71093441",
    lifecycleTokenId: "71093441",
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId falls back to the same-tx lifecycle token id", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: null,
    lifecycleTokenId: "71093441",
  });

  assert.equal(result, "71093441");
});

test("resolveAerodromeRewardCandidateTokenId stays unresolved when the tx has no provable token id", () => {
  const result = resolveAerodromeRewardCandidateTokenId({
    explicitTokenId: null,
    lifecycleTokenId: null,
  });

  assert.equal(result, null);
});

test("extractAerodromeMintParamsFromTransactionInput decodes Aerodrome mint calldata with tick bounds", () => {
  const result = extractAerodromeMintParamsFromTransactionInput(
    "0xb5007d1f0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000064fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf25cfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf5180000000000000000000000000000000000000000000000000a96f932a38fbcff0000000000000000000000000000000000000000000000000000000050a65ed200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ecd939b7fca4dc4a0675d8d28bad12cefae0954000000000000000000000000000000000000000000000000000000006a1223d800000000000000000000000000000000000000000000000000000000000000008779ce964b87d3f89643854abe0262635f7239717a66386f700b0080218021802180218021802180218021",
  );

  assert.deepEqual(result, {
    token0Address: "0x4200000000000000000000000000000000000006",
    token1Address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tickSpacing: 100,
    tickLower: -200100,
    tickUpper: -199400,
  });
});