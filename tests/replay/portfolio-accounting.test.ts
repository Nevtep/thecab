import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

function normalizeAccounting(body: Awaited<ReturnType<typeof fetchAccounting>>["body"]) {
  return {
    contractVersion: body.contractVersion,
    totalValue: body.totalValue,
    capitalEntered: body.capitalEntered,
    capitalWithdrawn: body.capitalWithdrawn,
    realizedPnl: body.realizedPnl,
    unrealizedPnl: body.unrealizedPnl,
    idleBalanceValue: body.idleBalanceValue,
    coverageSummary: body.coverageSummary,
    pools: body.pools.map((pool: any) => ({
      displayName: pool.displayName,
      currentValue: pool.currentValue,
      strategies: pool.strategies.map((strategy: any) => ({
        strategyType: strategy.strategyType,
        currentValue: strategy.currentValue,
        positions: strategy.positions.map((position: any) => ({
          positionType: position.positionType,
          precisionStatus: position.precisionStatus,
          currentValue: position.currentValue
        }))
      }))
    }))
  };
}

describe("portfolio accounting replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("produces stable accounting snapshots across replay runs", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    await reconstructSession(session.sessionId);
    const firstSnapshot = await fetchAccounting(session.sessionId);

    await reconstructSession(session.sessionId);
    const secondSnapshot = await fetchAccounting(session.sessionId);

    expect(normalizeAccounting(firstSnapshot.body)).toEqual(normalizeAccounting(secondSnapshot.body));
  });
});