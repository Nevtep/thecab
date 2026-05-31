import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityReadModelRow,
  buildActivityReadModelRows,
  buildActivityReadModelSummary,
} from "@/server/analysis/activity-read-models";

const walletAddress = "0x1111111111111111111111111111111111111111";

function input(overrides: Partial<Parameters<typeof buildActivityReadModelRow>[0]> = {}) {
  return {
    ledgerEvent: {
      activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      chainId: 8453,
      walletAddress,
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      logIndex: 0,
      eventType: "claim",
      occurredAt: new Date("2026-05-16T14:32:18.000Z"),
      classification: "claim",
      confidence: "high",
      metadataJson: {
        coverageStatus: "full",
        poolId: "33333333-3333-4333-8333-333333333333",
        poolLabel: "WETH / cbBTC-100",
        depositId: "44444444-4444-4444-8444-444444444444",
        strategyExposureId: "55555555-5555-4555-8555-555555555555",
        rewardEventId: "66666666-6666-4666-8666-666666666666",
        governanceEventId: "77777777-7777-4777-8777-777777777777",
      },
    },
    movements: [{
      id: "movement-1",
      tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      tokenSymbol: "AERO",
      direction: "in" as const,
      amountRaw: "1250000000000000000000",
      amountUsd: "1245.18",
    }],
    ...overrides,
  };
}

test("buildActivityReadModelRow preserves identity, valuation, movements, and explicit entity links", () => {
  const row = buildActivityReadModelRow(input());

  assert.equal(row.activityId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(row.chainId, 8453);
  assert.equal(row.valueUsd, "1245.18");
  assert.equal(row.primaryTokenSymbol, "AERO");
  assert.deepEqual(row.linkedEntities.map((entity) => entity.kind), [
    "pool",
    "deposit",
    "strategy",
    "reward",
    "governance",
  ]);
});

test("buildActivityReadModelRow keeps spam airdrops excluded without value contribution", () => {
  const row = buildActivityReadModelRow(input({
    ledgerEvent: {
      ...input().ledgerEvent,
      eventType: "airdrop",
      classification: "spam_airdrop",
      confidence: "low",
      metadataJson: {
        economicExclusionReason: "airdrop_spam",
      },
    },
  }));

  assert.equal(row.action, "airdrop");
  assert.equal(row.coverage, "excluded");
  assert.equal(row.confidence, "none");
  assert.ok(row.reasonCodes.includes("airdrop_spam"));
});

test("buildActivityReadModelSummary counts full, unresolved, and excluded rows separately", () => {
  const rows = buildActivityReadModelRows([
    input(),
    input({
      ledgerEvent: {
        ...input().ledgerEvent,
        activityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        classification: "unknown",
        confidence: "low",
        metadataJson: { coverageStatus: "unavailable" },
      },
      movements: [],
    }),
    input({
      ledgerEvent: {
        ...input().ledgerEvent,
        activityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        eventType: "airdrop",
        classification: "airdrop",
        confidence: "low",
        metadataJson: { economicExclusionReason: "airdrop_spam" },
      },
    }),
  ]);
  const summary = buildActivityReadModelSummary(rows);

  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.interpretedEvents, 1);
  assert.equal(summary.excludedEvents, 1);
  assert.equal(summary.unresolvedEvents, 1);
  assert.equal(summary.totalValueUsd, "1245.18");
});
