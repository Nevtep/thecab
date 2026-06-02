import assert from "node:assert/strict";
import test from "node:test";

import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";
import { emptyMaterializationContext } from "@/server/analysis/engine-v2/materializers/load-materialization-context";
import {
  buildGaugePoolIdByGaugeAddress,
  hydrateAccountingInputWithPersistedPrices,
  runEngineV2AccountChronological,
  runEngineV2MaterializeReadModels,
} from "./engine-v2-materialization.task";

const payload = {
  chainId: 8453,
  walletAddress: "0x0000000000000000000000000000000000000001",
  mode: "fixture",
};

const events = [
  {
    id: "newer",
    chainId: 8453,
    walletAddress: payload.walletAddress,
    eventType: "cash_in",
    eventFamily: "cashflow",
    occurredAt: new Date("2026-01-02T00:00:00.000Z"),
    txHash: "0x2",
    sequenceIndex: 1,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    evidenceJson: { movements: [{ direction: "in", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "1" }] },
  },
  {
    id: "older",
    chainId: 8453,
    walletAddress: payload.walletAddress,
    eventType: "cash_in",
    eventFamily: "cashflow",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0x1",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    evidenceJson: { movements: [{ direction: "in", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "1" }] },
  },
];

test("runEngineV2AccountChronological accounts loaded events in chronological order", async () => {
  const persisted: unknown[] = [];
  let accountingPayload: Record<string, unknown> | null = null;
  const result = await runEngineV2AccountChronological(payload, {
    loadAccountingInput: async () => ({
      events: [
        ...events,
        {
          id: "gov-managed",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "governance_deposit_managed",
          eventFamily: "governance",
          occurredAt: new Date("2026-01-03T00:00:00.000Z"),
          txHash: "0x3",
          sequenceIndex: 2,
          coverageStatus: "full",
          confidence: "high",
          reasonCodes: [],
          metadataJson: {
            votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
            lockTokenId: "113464",
            managedTokenId: "10298",
          },
        },
        {
          id: "gov-claim",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "governance_fee_claim",
          eventFamily: "governance",
          occurredAt: new Date("2026-01-04T00:00:00.000Z"),
          txHash: "0x4",
          sequenceIndex: 3,
          coverageStatus: "partial",
          confidence: "medium",
          reasonCodes: ["missing_distributor_pool_link"],
          metadataJson: {
            rewardId: "claim:0",
            rewardType: "governance_fee",
            lockTokenId: "113464",
            amountRaw: "100",
            amountUsd: "5",
            itemIndex: 0,
          },
        },
      ],
      links: [
        { domainEventId: "gov-managed", entityType: "governance_lock", entityId: "lock-113464" },
        { domainEventId: "gov-claim", entityType: "governance_lock", entityId: "lock-113464" },
      ],
    }),
    loadMaterializationContext: async () => emptyMaterializationContext(),
    persistAccounting: async (input) => {
      accountingPayload = input as unknown as Record<string, unknown>;
    },
    persistRows: async ({ rows }) => {
      persisted.push(...rows);
    },
    trigger: async () => undefined,
  });
  const persistedAccounting = accountingPayload as {
    governance?: { locks?: unknown[]; managedLinks?: unknown[] };
    rewards?: unknown[];
  } | null;

  assert.equal(result.eventCount, 4);
  assert.equal(result.cashFlowCount, 2);
  assert.ok(Array.isArray(persistedAccounting?.governance?.locks));
  assert.equal(persistedAccounting?.governance?.managedLinks?.length, 1);
  assert.equal(persistedAccounting?.rewards?.length, 1);
  assert.ok(persisted.length > 0);
});

test("runEngineV2MaterializeReadModels persists rows and reports surface counts", async () => {
  const persisted: unknown[] = [];
  const result = await runEngineV2MaterializeReadModels(payload, {
    loadAccountingInput: async () => ({ events }),
    loadMaterializationContext: async () => emptyMaterializationContext(),
    persistRows: async ({ rows }) => {
      persisted.push(...rows);
    },
    finalizeRun: async () => undefined as never,
  });

  assert.equal(result.bySurface.activity, 2);
  assert.equal(persisted.length, result.rowCount);
});

test("runEngineV2MaterializeReadModels can finalize from already-persisted rows without reloading accounting", async () => {
  const finalizeCalls: Array<Record<string, unknown>> = [];

  const result = await runEngineV2MaterializeReadModels({
    ...payload,
    analysisRunId: "00000000-0000-4000-8000-000000000001",
    rowsAlreadyPersisted: true,
  }, {
    updateRunProgress: async () => ({ } as never),
    loadAccountingInput: async () => {
      throw new Error("should not reload accounting");
    },
    loadMaterializedRowStats: async () => ({
      rowCount: 2,
      bySurface: { activity: 2 },
      coverage: "full",
      coverageReasonsJson: [],
    }),
    finalizeRun: async (input) => {
      finalizeCalls.push(input as unknown as Record<string, unknown>);
      return undefined as never;
    },
  });

  assert.equal(result.rowCount, 2);
  assert.equal(result.bySurface.activity, 2);
  assert.equal(finalizeCalls.length, 1);
});

test("hydrateAccountingInputWithPersistedPrices carries historical pricing into deposit, strategy, and reward projections", () => {
  const occurredAt = new Date("2026-01-01T00:00:00.000Z");
  const accountingInput = hydrateAccountingInputWithPersistedPrices({
    accountingInput: {
      events: [
        {
          id: "deposit-open",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "manual_position_created",
          eventFamily: "deposit",
          occurredAt,
          txHash: "0xdep",
          sequenceIndex: 0,
          coverageStatus: "partial",
          confidence: "medium",
          reasonCodes: ["missing_historical_price"],
          metadataJson: {
            depositId: "dep-1",
            tokenId: "1",
            poolId: "8453:0xpool",
          },
          evidenceJson: {
            movements: [
              { assetType: "erc20", direction: "out", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "1000000000000000000", valueUsdAtEvent: null },
              { assetType: "erc20", direction: "out", tokenAddress: "0x00000000000000000000000000000000000000bb", amountRaw: "100000000", valueUsdAtEvent: null },
              { assetType: "erc721", direction: "in", tokenAddress: "0x00000000000000000000000000000000000000cc", tokenId: "1", amountRaw: "1", valueUsdAtEvent: null },
            ],
          },
        },
        {
          id: "strategy-open",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "strategy_deposit",
          eventFamily: "strategy",
          occurredAt,
          txHash: "0xstrat",
          sequenceIndex: 1,
          coverageStatus: "partial",
          confidence: "medium",
          reasonCodes: ["missing_historical_price"],
          metadataJson: {
            strategyExposureId: "strategy-1",
            wrapperAddress: "0x00000000000000000000000000000000000000dd",
            poolId: "8453:0xpool",
          },
          evidenceJson: {
            movements: [
              { assetType: "erc20", direction: "out", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "500000000000000000", valueUsdAtEvent: null },
              { assetType: "erc20", direction: "in", tokenAddress: "0x00000000000000000000000000000000000000dd", amountRaw: "1000", valueUsdAtEvent: null },
              { assetType: "erc20", direction: "internal", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "500000000000000000", valueUsdAtEvent: null },
            ],
          },
        },
        {
          id: "strategy-reward",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "strategy_reward_claim",
          eventFamily: "strategy",
          occurredAt,
          txHash: "0xreward",
          sequenceIndex: 2,
          coverageStatus: "partial",
          confidence: "medium",
          reasonCodes: ["missing_historical_price"],
          metadataJson: {
            strategyExposureId: "strategy-1",
            tokenAddress: "0x00000000000000000000000000000000000000ee",
            amountRaw: "5000000000000000000",
          },
          evidenceJson: {
            movements: [
              { assetType: "erc20", direction: "in", tokenAddress: "0x00000000000000000000000000000000000000ee", amountRaw: "5000000000000000000", valueUsdAtEvent: null },
            ],
          },
        },
      ],
      links: [],
    },
    tokenMetadataRows: [
      { tokenAddress: "0x00000000000000000000000000000000000000aa", decimals: 18 },
      { tokenAddress: "0x00000000000000000000000000000000000000bb", decimals: 6 },
      { tokenAddress: "0x00000000000000000000000000000000000000ee", decimals: 18 },
    ],
    pricePointRows: [
      { tokenAddress: "0x00000000000000000000000000000000000000aa", pricedAt: occurredAt, priceUsd: "2500" },
      { tokenAddress: "0x00000000000000000000000000000000000000bb", pricedAt: occurredAt, priceUsd: "1" },
      { tokenAddress: "0x00000000000000000000000000000000000000ee", pricedAt: occurredAt, priceUsd: "2" },
    ],
  });

  const accounting = runChronologicalAccounting(accountingInput);

  assert.equal(accounting.events[0]?.metadataJson?.valueUsd, "2600");
  assert.equal(accounting.events[1]?.metadataJson?.valueUsd, "1250");
  assert.equal(accounting.events[2]?.metadataJson?.amountUsd, "10");
  assert.equal(accounting.deposits[0]?.openedValueUsd, "2600");
  assert.equal(accounting.strategies[0]?.depositedValueUsd, "1250");
  assert.equal(accounting.strategies[0]?.rewardsUsd, "10");
  assert.equal(accounting.rewards[0]?.amountUsd, "10");
  assert.equal(
    (accounting.events[1]?.evidenceJson as { movements?: Array<{ direction?: string; valueUsdAtEvent?: string | null }> })?.movements?.find((movement) => movement.direction === "out")?.valueUsdAtEvent,
    "1250",
  );
  assert.equal(
    (accounting.events[1]?.evidenceJson as { movements?: Array<{ direction?: string; valueUsdAtEvent?: string | null }> })?.movements?.find((movement) => movement.direction === "internal")?.valueUsdAtEvent ?? null,
    null,
  );
});

test("buildGaugePoolIdByGaugeAddress falls back to gauge lifecycle events when protocol metadata is missing", () => {
  const result = buildGaugePoolIdByGaugeAddress({
    chainId: 8453,
    rewardClaimGaugeAddresses: ["0x519BbD1dd8C6a94c46080e24F316c14Ee758C025"],
    protocolGaugeRows: [],
    eventGaugeRows: [
      {
        gaugeAddress: "0x519bbd1dd8c6a94c46080e24f316c14ee758c025",
        poolId: "8453:0xcdac0d6c6c59727a65f871236188350531885c43",
      },
    ],
  });

  assert.equal(
    result.get("0x519bbd1dd8c6a94c46080e24f316c14ee758c025"),
    "8453:0xcdac0d6c6c59727a65f871236188350531885c43",
  );
});

test("buildGaugePoolIdByGaugeAddress keeps protocol metadata as the primary source", () => {
  const result = buildGaugePoolIdByGaugeAddress({
    chainId: 8453,
    rewardClaimGaugeAddresses: ["0x4f09bab2f0e15e2a078a227fe1537665f55b8360"],
    protocolGaugeRows: [
      {
        address: "0x4f09bab2f0e15e2a078a227fe1537665f55b8360",
        metadataJson: {
          poolId: "8453:0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d",
        },
      },
    ],
    eventGaugeRows: [
      {
        gaugeAddress: "0x4f09bab2f0e15e2a078a227fe1537665f55b8360",
        poolId: "8453:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      },
    ],
  });

  assert.equal(
    result.get("0x4f09bab2f0e15e2a078a227fe1537665f55b8360"),
    "8453:0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d",
  );
});
