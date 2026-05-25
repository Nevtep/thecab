import assert from "node:assert/strict";
import test from "node:test";

import { buildCapitalAllocationStatusBadges } from "@/features/overview/capitalAllocation.utils";
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