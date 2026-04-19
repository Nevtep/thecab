import { createSession, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("analysis session flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a session, reconstructs the wallet, and exposes a ledger projection", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    await reconstructSession(session.sessionId);
    const { body } = await fetchLedger(session.sessionId);

    expect(body.pools).toHaveLength(1);
    expect(body.discardedSummary.totalCount).toBe(0);
  });
});