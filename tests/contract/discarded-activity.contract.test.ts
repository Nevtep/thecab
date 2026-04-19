import { createSession, fetchDiscardedActivity, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("discarded activity contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns residual holdings and discarded records through the contract routes", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);

    const ledger = await fetchLedger(session.sessionId);
    const discarded = await fetchDiscardedActivity(session.sessionId);

    expect(ledger.body.residualHoldings).toHaveLength(1);
    expect(discarded.body.items[0].reasonType).toBe("unsupported");
  });
});