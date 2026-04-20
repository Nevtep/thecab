import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting breakdown contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns pool, strategy, and position summaries with precision status", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.pools[0].strategies[0]).toHaveProperty("positions");
    expect(body.pools[0].strategies[0].positions[0]).toHaveProperty("precisionStatus");
    expect(body.pools[0].strategies[0].positions[0].traceRefs).toHaveProperty("ledgerRecordIds");
  });
});