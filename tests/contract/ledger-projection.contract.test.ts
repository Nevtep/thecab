import { createSession, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("ledger projection contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns pool and strategy fields for the canonical ledger projection", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchLedger(session.sessionId);

    expect(body.pools[0].displayName).toBe("WETH / USDC");
    expect(body.pools[0].strategies.map((strategy: any) => strategy.strategyType).sort()).toEqual([
      "manual",
      "mellow_auto"
    ]);
  });
});