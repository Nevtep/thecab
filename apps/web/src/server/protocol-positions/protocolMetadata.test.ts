import assert from "node:assert/strict";
import test from "node:test";

import { extractTokenSymbols } from "@/server/protocol-positions/protocolMetadata";

test("extractTokenSymbols ignores date-like slash pairs", () => {
  const result = extractTokenSymbols({
    summary: "Position closes on 2026 / 05",
  });

  assert.deepEqual(result, {
    primaryTokenSymbol: null,
    secondaryTokenSymbol: null,
  });
});

test("extractTokenSymbols still recognizes symbol pairs with letters", () => {
  const result = extractTokenSymbols({
    summary: "Aerodrome WETH / USDC 100 position",
  });

  assert.deepEqual(result, {
    primaryTokenSymbol: "WETH",
    secondaryTokenSymbol: "USDC",
  });
});