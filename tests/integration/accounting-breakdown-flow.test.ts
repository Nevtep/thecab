import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting breakdown flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("reconciles pool totals from manual and mellow strategy summaries", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    const strategyTotal = body.pools[0].strategies.reduce(
      (total: number, strategy: any) => total + Number(strategy.currentValue.amount),
      0
    );

    expect(strategyTotal.toFixed(4)).toBe(body.pools[0].currentValue.amount);
  });
});