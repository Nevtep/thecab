import { createSession, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("pool and strategy lifecycle replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps manual and mellow records under one pool while preserving manual continuity", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchLedger(session.sessionId);

    expect(body.pools).toHaveLength(1);
    expect(body.pools[0].strategies.map((strategy: any) => strategy.strategyType).sort()).toEqual([
      "manual",
      "mellow_auto"
    ]);

    const manualStrategy = body.pools[0].strategies.find((strategy: any) => strategy.strategyType === "manual");
    expect(manualStrategy.positions).toHaveLength(1);
    expect(manualStrategy.positions[0].ledgerRecords.map((record: any) => record.eventType)).toEqual([
      "manual_position_opened",
      "manual_liquidity_added"
    ]);
  });
});