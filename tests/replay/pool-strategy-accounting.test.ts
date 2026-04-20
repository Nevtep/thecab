import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("pool and strategy accounting replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("replays mixed manual and mellow strategy totals deterministically", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const first = await fetchAccounting(session.sessionId);

    await reconstructSession(session.sessionId);
    const second = await fetchAccounting(session.sessionId);

    expect(first.body.pools[0].strategies.map((strategy: any) => strategy.currentValue.amount)).toEqual(
      second.body.pools[0].strategies.map((strategy: any) => strategy.currentValue.amount)
    );
  });
});