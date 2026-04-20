import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting snapshot contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns nested pool, strategy, and position accounting fields", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.contractVersion).toBe("1.0.0");
    expect(body.quoteCurrency).toBe("usd");
    expect(body.totalValue).toEqual({ currency: "usd", amount: "4290.0000" });
    expect(body.pools).toHaveLength(1);
    expect(body.pools[0].displayName).toBe("WETH / USDC");
    expect(body.pools[0].strategies.map((strategy: any) => strategy.strategyType).sort()).toEqual([
      "manual",
      "mellow_auto"
    ]);
    expect(body.pools[0].strategies[0].positions[0].precisionStatus).toBe("exact");
  });
});