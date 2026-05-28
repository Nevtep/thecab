import assert from "node:assert/strict";
import test from "node:test";

import { resolveCabTokenIcon } from "@/design-system/tokens/tokenAssets";

const BASE_CHAIN_ID = 8453;
const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";

test("explicit address override wins for Base cbBTC", () => {
  const resolution = resolveCabTokenIcon({
    chainId: BASE_CHAIN_ID,
    tokenAddress: BASE_CBBTC_ADDRESS,
    symbol: "BTC",
  });

  assert.equal(resolution.sources[0]?.kind, "addressOverride");
  assert.match(resolution.sources[0]?.src ?? "", /cbbtc|40143/i);
  assert.equal(resolution.matchedSymbol, "cbBTC");
});

test("known symbol map resolves Base WETH when address is absent", () => {
  const resolution = resolveCabTokenIcon({
    chainId: BASE_CHAIN_ID,
    tokenAddress: null,
    symbol: "WETH",
  });

  assert.equal(resolution.sources[0]?.kind, "knownSymbol");
  assert.match(resolution.sources[0]?.src ?? "", /trustwallet/i);
  assert.equal(resolution.matchedSymbol, "WETH");
});

test("unknown token falls through external lookup then local fallback", () => {
  const resolution = resolveCabTokenIcon({
    chainId: BASE_CHAIN_ID,
    tokenAddress: "0x1111111111111111111111111111111111111111",
    symbol: "UNKNOWN",
  });

  assert.deepEqual(
    resolution.sources.map((source) => source.kind),
    ["externalLookup", "localFallback"],
  );
  assert.match(resolution.sources[0]?.src ?? "", /trustwallet/i);
  assert.equal(resolution.fallbackKind, "genericBadge");
});

test("address override takes precedence over symbol map for mismatched symbol input", () => {
  const resolution = resolveCabTokenIcon({
    chainId: BASE_CHAIN_ID,
    tokenAddress: BASE_WETH_ADDRESS,
    symbol: "ETH",
  });

  assert.equal(resolution.sources[0]?.kind, "addressOverride");
  assert.equal(resolution.matchedSymbol, "WETH");
});