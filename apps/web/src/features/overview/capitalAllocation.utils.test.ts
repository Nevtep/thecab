import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCapitalAllocationStatusBadges,
  buildDistributionCompositionBreakdown,
} from "@/features/overview/capitalAllocation.utils";
import type { OverviewViewModel } from "@/features/overview/overview.types";

function createDistribution(input: {
  source: OverviewViewModel["distribution"]["source"];
  coverageStatus: OverviewViewModel["distribution"]["coverageStatus"];
  coverageReasonCodes: OverviewViewModel["distribution"]["coverageReasonCodes"];
}): OverviewViewModel["distribution"] {
  return {
    source: input.source,
    coverageStatus: input.coverageStatus,
    coverageReasonCodes: input.coverageReasonCodes,
    slices: [
      {
        dimension: "staked_lp",
        label: "LP",
        valueUsd: 100,
        coverageStatus: input.coverageStatus,
        composition: null,
      },
    ],
    exclusions: null,
  };
}

function translate(key: string) {
  return key;
}

function createAssetRow(
  input: Partial<OverviewViewModel["assets"]["rows"][number]>,
): OverviewViewModel["assets"]["rows"][number] {
  return {
    tokenAddress: null,
    chainId: 8453,
    symbol: "UNKNOWN",
    name: null,
    balance: "0",
    priceUsd: null,
    valueUsd: null,
    movement24hPct: null,
    movement7dPct: null,
    classification: "idle",
    priceConfidence: null,
    trustStatus: "unknown",
    trustReasonCodes: [],
    isHiddenByDefault: false,
    classifierVersion: null,
    ...input,
  };
}

test("buildCapitalAllocationStatusBadges omits historical pending when analysis is not pending", () => {
  const badges = buildCapitalAllocationStatusBadges(
    createDistribution({
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: [],
    }),
    translate,
  );

  assert.deepEqual(
    badges.map((badge) => badge.key),
    ["coverage-recent"],
  );
});

test("buildCapitalAllocationStatusBadges shows historical pending only when analysisPending is present", () => {
  const badges = buildCapitalAllocationStatusBadges(
    createDistribution({
      source: "recent_provider_data",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
    }),
    translate,
  );

  assert.deepEqual(
    badges.map((badge) => badge.key),
    ["coverage-partial", "source-pending"],
  );
});

test("buildCapitalAllocationStatusBadges keeps fallback badge when using partial fallback source", () => {
  const badges = buildCapitalAllocationStatusBadges(
    createDistribution({
      source: "partial_fallback",
      coverageStatus: "partial",
      coverageReasonCodes: ["providerPartial"],
    }),
    translate,
  );

  assert.deepEqual(
    badges.map((badge) => badge.key),
    ["coverage-partial", "source-fallback"],
  );
});

test("buildDistributionCompositionBreakdown prices wrapped LP composition by token address", () => {
  const wethAddress = "0x4200000000000000000000000000000000000006";
  const slice: OverviewViewModel["distribution"]["slices"][number] = {
    dimension: "staked_lp",
    label: "LP",
    valueUsd: 3_000,
    coverageStatus: "partial",
    composition: [
      {
        positionKey: "lp-1",
        label: "WETH / cbBTC",
        valueUsd: 3_000,
        tokens: [
          {
            symbol: "WETH",
            tokenAddress: wethAddress,
            amount: 1.5,
          },
        ],
      },
    ],
  };

  const breakdown = buildDistributionCompositionBreakdown(slice, [
    createAssetRow({
      tokenAddress: wethAddress,
      symbol: "ETH",
      priceUsd: 2_000,
    }),
  ]);

  assert.equal(breakdown?.usesEstimatedValue, true);
  assert.equal(breakdown?.tokens[0]?.symbol, "WETH");
  assert.equal(breakdown?.tokens[0]?.tokenAddress, wethAddress);
  assert.equal(breakdown?.tokens[0]?.estimatedValueUsd, 3_000);
});
