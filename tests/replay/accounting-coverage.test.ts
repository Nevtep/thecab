import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting coverage replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps discarded-activity exclusion reasons stable across replay runs", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const first = await fetchAccounting(session.sessionId);

    await reconstructSession(session.sessionId);
    const second = await fetchAccounting(session.sessionId);

    expect(first.body.coverageSummary.reasonCodes).toContain("unsupported_protocol");
    expect(second.body.coverageSummary.reasonCodes).toContain("unsupported_protocol");
    expect(first.body.coverageSummary.reasonCodes).toEqual(second.body.coverageSummary.reasonCodes);
  });
});