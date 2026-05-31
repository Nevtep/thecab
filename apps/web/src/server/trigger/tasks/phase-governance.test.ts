import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceMaterializationPlan,
  materializeGovernanceForRun,
} from "@/server/trigger/tasks/phase-governance.task";

test("buildGovernanceMaterializationPlan creates governance rows and metric snapshot", () => {
  const plan = buildGovernanceMaterializationPlan({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    ledgerRows: [
      {
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0x1",
        logIndex: 0,
        eventType: "vote",
        occurredAt: new Date("2026-05-30T00:00:00.000Z"),
        surfaceKind: "governance_vote",
      },
      {
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0x2",
        logIndex: 0,
        eventType: "transfer",
        occurredAt: new Date("2026-05-30T00:00:01.000Z"),
        summary: "Generic transfer",
      },
    ],
    rewardRows: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0x3",
        logIndex: 0,
        rewardType: "governance_bribe_claim",
        resolutionBasis: "governance_reward",
        resolutionReasonCodes: ["explicitOwnerGovernance"],
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        amountRaw: "1000000000000000000",
        amountUsd: "1.00",
        occurredAt: new Date("2026-05-30T00:00:02.000Z"),
        resolutionStatus: "resolved",
        resolvedPoolId: null,
        metadataJson: { sourceSurface: "governance_bribe_claim" },
      },
    ],
  });

  assert.equal(plan.governanceEvents.length, 1);
  assert.equal(plan.governanceRewards.length, 1);
  assert.equal(plan.governanceEvents[0]?.eventType, "vote_cast");
  assert.equal(plan.metricSnapshot.summaryJson.totalEvents, 1);
});

test("materializeGovernanceForRun persists plan through injected deps", async () => {
  let persistedCount = 0;
  const result = await materializeGovernanceForRun(
    {
      runId: "run-1",
      walletAddress: "0x0000000000000000000000000000000000000001",
      chainId: 8453,
    },
    {
      loadLedgerRows: async () => [
        {
          chainId: 8453,
          walletAddress: "0x0000000000000000000000000000000000000001",
          txHash: "0x1",
          logIndex: 0,
          eventType: "bribe",
          occurredAt: new Date("2026-05-30T00:00:00.000Z"),
          surfaceKind: "governance_bribe_claim",
        },
      ],
      loadRewardRows: async () => [],
      persistPlan: async (_payload, plan) => {
        persistedCount = plan.governanceEvents.length;
      },
    },
  );

  assert.equal(result.governanceEventCount, 1);
  assert.equal(result.governanceRewardCount, 0);
  assert.equal(result.metricSnapshotCount, 1);
  assert.equal(persistedCount, 1);
});
