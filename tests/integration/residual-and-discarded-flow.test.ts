import { createSession, fetchDiscardedActivity, fetchLedger, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("residual and discarded inspection", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps residual balances visible and discarded activity reviewable", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const ledger = await fetchLedger(session.sessionId);
    const discarded = await fetchDiscardedActivity(session.sessionId);

    expect(ledger.body.residualHoldings[0].reasonCode).toBe("rebalance_leftover");
    expect(discarded.body.items[0].reasonCode).toBe("unsupported_protocol");
  });
});