import assert from "node:assert/strict";
import test from "node:test";

import { ASSET_TRUST_CLASSIFIER_VERSION } from "@/server/asset-trust/assetTrust.types";
import { shouldIncludeHistoricalIdleToken } from "@/server/analysis/computeSnapshots";

test("shouldIncludeHistoricalIdleToken excludes dust positions", () => {
  assert.equal(shouldIncludeHistoricalIdleToken({
    trustInput: {
      walletAddress: "0xabc",
      chainId: 8453,
      tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      symbol: "AERO",
      name: "Aerodrome",
      balanceRaw: "1",
      balanceFormatted: "0.000000000000000001",
      valueUsd: 0.25,
      hasReliableAlchemyPrice: true,
      moralisPossibleSpam: false,
      moralisVerifiedContract: true,
      hasLogo: true,
      hasMetadata: true,
      isKnownProtocolAsset: true,
      isNativeAsset: false,
      isDustValue: true,
      classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
    },
    knownProtocolReasonCode: "knownAerodromeToken",
  }), false);
});

test("shouldIncludeHistoricalIdleToken excludes unpriced unsafe assets", () => {
  assert.equal(shouldIncludeHistoricalIdleToken({
    trustInput: {
      walletAddress: "0xabc",
      chainId: 8453,
      tokenAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      symbol: "BONUS",
      name: "Claim Bonus",
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1",
      valueUsd: null,
      hasReliableAlchemyPrice: false,
      moralisPossibleSpam: null,
      moralisVerifiedContract: null,
      hasLogo: true,
      hasMetadata: true,
      isKnownProtocolAsset: false,
      isNativeAsset: false,
      isDustValue: false,
      classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
    },
  }), false);
});

test("shouldIncludeHistoricalIdleToken keeps priced safe assets", () => {
  assert.equal(shouldIncludeHistoricalIdleToken({
    trustInput: {
      walletAddress: "0xabc",
      chainId: 8453,
      tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      symbol: "USDC",
      name: "USD Coin",
      balanceRaw: "1000000",
      balanceFormatted: "1",
      valueUsd: 1,
      hasReliableAlchemyPrice: true,
      moralisPossibleSpam: false,
      moralisVerifiedContract: true,
      hasLogo: true,
      hasMetadata: true,
      isKnownProtocolAsset: false,
      isNativeAsset: false,
      isDustValue: false,
      classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
    },
  }), true);
});