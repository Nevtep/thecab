import { createSession, fetchDiscardedActivity, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("residual and discarded replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("preserves residual holdings and isolates discarded activity", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const ledger = await fetchLedger(session.sessionId);
    const discarded = await fetchDiscardedActivity(session.sessionId);

    expect(ledger.body.residualHoldings).toHaveLength(1);
    expect(ledger.body.discardedSummary.totalCount).toBe(1);
    expect(discarded.body.items).toHaveLength(1);
    expect(discarded.body.items[0].reasonCode).toBe("unsupported_protocol");
  });
});