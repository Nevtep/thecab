import { createSession, fetchDiscardedActivity, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("discarded activity contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps discarded activity reviewable without blocking the main ledger contract", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);

    const ledger = await fetchLedger(session.sessionId);
    const discarded = await fetchDiscardedActivity(session.sessionId);

    expect(ledger.body.residualHoldings).toHaveLength(1);
    expect(ledger.body.discardedSummary.totalCount).toBeGreaterThan(0);
    expect(discarded.response.status).toBe(200);
    expect(discarded.body.items[0].discardedActivityId).toBeTruthy();
    expect(discarded.body.items[0].reasonType).toBe("unsupported");
    expect(discarded.body.items[0].reasonMessage).toBeTruthy();
  });
});