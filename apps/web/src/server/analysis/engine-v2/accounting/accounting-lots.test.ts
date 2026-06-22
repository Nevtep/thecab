import assert from "node:assert/strict";
import test from "node:test";

import { accountCashAndResidualInventory, runChronologicalAccounting, toCashFlowValues, toResidualInventoryValues } from "./index";
import type { EngineV2DomainEventLike } from "./index";

const walletAddress = "0x0000000000000000000000000000000000000001";

function event(overrides: Partial<EngineV2DomainEventLike>): EngineV2DomainEventLike {
  return {
    id: overrides.id ?? "event-1",
    chainId: 8453,
    walletAddress,
    eventType: "cash_in",
    eventFamily: "cashflow",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0xabc",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    ...overrides,
  };
}

test("accountCashAndResidualInventory tracks chronological cash-in, swap, cash-out, and residual balances", () => {
  const token = "0x00000000000000000000000000000000000000aa";
  const result = accountCashAndResidualInventory({
    events: [
      event({ id: "1", eventType: "cash_in", evidenceJson: { movements: [{ direction: "in", tokenAddress: token, amountRaw: "100", amountUsd: "100" }] } }),
      event({ id: "2", eventType: "swap", eventFamily: "swap", sequenceIndex: 1, evidenceJson: { movements: [{ direction: "out", tokenAddress: token, amountRaw: "40", amountUsd: "40" }] } }),
      event({ id: "3", eventType: "cash_out", sequenceIndex: 2, evidenceJson: { movements: [{ direction: "out", tokenAddress: token, amountRaw: "10", amountUsd: "10" }] } }),
    ],
  });

  assert.deepEqual(result.cashFlows.map((flow) => flow.flowKind), ["cash_in", "swap_out", "cash_out"]);
  assert.equal(result.residualInventory[0]?.tokenAddress, token);
  assert.equal(result.residualInventory[0]?.amountRaw, "50");
});

test("accountCashAndResidualInventory tracks pool-scoped residual lots by source withdrawal", () => {
  const token = "0x00000000000000000000000000000000000000aa";
  const poolId = "8453:0xpool";
  const result = accountCashAndResidualInventory({
    events: [
      event({
        id: "withdraw-1",
        eventType: "manual_position_withdraw",
        eventFamily: "deposit",
        evidenceJson: { movements: [{ direction: "in", tokenAddress: token, amountRaw: "100", amountUsd: "100" }] },
        metadataJson: { poolId },
      }),
    ],
  });

  assert.equal(result.residualInventory[0]?.poolId, poolId);
  assert.equal(result.residualInventory[0]?.sourceWithdrawalId, "withdraw-1");
  assert.equal(result.residualInventory[0]?.tokenAddress, token);
  assert.equal(result.residualInventory[0]?.amountRaw, "100");
});

test("runChronologicalAccounting emits derived same-pool rebalance without removing primitive events", () => {
  const token0 = "0x00000000000000000000000000000000000000aa";
  const token1 = "0x00000000000000000000000000000000000000bb";
  const poolId = "8453:0xpool";
  const output = runChronologicalAccounting({
    events: [
      event({
        id: "withdraw-1",
        eventType: "manual_position_withdraw",
        eventFamily: "deposit",
        txHash: "0xwithdraw",
        evidenceJson: { movements: [{ direction: "in", tokenAddress: token0, amountRaw: "100", amountUsd: "100" }] },
        metadataJson: { poolId },
      }),
      event({
        id: "swap-1",
        eventType: "swap",
        eventFamily: "swap",
        txHash: "0xswap",
        sequenceIndex: 1,
        occurredAt: new Date("2026-01-01T00:01:00.000Z"),
        evidenceJson: {
          movements: [
            { direction: "out", tokenAddress: token0, amountRaw: "100", amountUsd: "100" },
            { direction: "in", tokenAddress: token1, amountRaw: "90", amountUsd: "90" },
          ],
        },
      }),
      event({
        id: "deposit-1",
        eventType: "manual_position_created",
        eventFamily: "deposit",
        txHash: "0xdeposit",
        sequenceIndex: 2,
        occurredAt: new Date("2026-01-01T00:02:00.000Z"),
        evidenceJson: { movements: [{ direction: "out", tokenAddress: token1, amountRaw: "90", amountUsd: "90" }] },
        metadataJson: { poolId },
      }),
    ],
  });

  assert.deepEqual(output.events.map((item) => item.id), ["withdraw-1", "swap-1", "deposit-1"]);
  assert.equal(output.rebalances.length, 1);
  assert.equal(output.rebalances[0]?.poolId, poolId);
  assert.equal(output.rebalances[0]?.sourceWithdrawalId, "withdraw-1");
  assert.deepEqual(output.rebalances[0]?.swapEventIds, ["swap-1"]);
  assert.equal(output.rebalances[0]?.depositEventId, "deposit-1");
  assert.equal(output.rebalances[0]?.withdrawnCapitalUsd, "100");
  assert.equal(output.rebalances[0]?.redeployedCapitalUsd, "90");
  assert.equal(output.rebalances[0]?.capitalDeltaUsd, "-10");
});

test("runChronologicalAccounting sorts oldest transaction first before projection", () => {
  const output = runChronologicalAccounting({
    events: [
      event({ id: "newer", txHash: "0x2", occurredAt: new Date("2026-01-02T00:00:00.000Z") }),
      event({ id: "older", txHash: "0x1", occurredAt: new Date("2026-01-01T00:00:00.000Z") }),
    ],
  });

  assert.deepEqual(output.events.map((item) => item.id), ["older", "newer"]);
});

test("accounting repository value builders preserve chain and wallet identity", () => {
  const source = event({ id: "source", evidenceJson: { movements: [{ tokenAddress: "0xabc", amountRaw: "1" }] } });
  const cashFlow = toCashFlowValues({ event: source, flowKind: "cash_in", tokenAddress: "0x00000000000000000000000000000000000000aa" });
  const residual = toResidualInventoryValues({
    chainId: source.chainId,
    walletAddress: source.walletAddress,
    tokenAddress: "0x00000000000000000000000000000000000000aa",
    amountRaw: "1",
  });

  assert.equal(cashFlow.chainId, 8453);
  assert.equal(cashFlow.walletAddress, walletAddress);
  assert.equal(residual.tokenAddress, "0x00000000000000000000000000000000000000aa");
});
