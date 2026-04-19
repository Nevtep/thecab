import { createSession, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("pool and strategy inspection", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("shows separate manual and mellow strategies inside one pool", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchLedger(session.sessionId);

    expect(body.pools).toHaveLength(1);
    expect(body.pools[0].strategies).toHaveLength(2);
  });
});