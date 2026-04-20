import { createSession, fetchAccounting, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting explainability contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns coverage metadata and trace refs on partial-coverage snapshots", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.coverageSummary.coverageStatus).toBe("partial");
    expect(body.coverageSummary.reasonCodes).toContain("unsupported_protocol");
    expect(body.traceRefs.ledgerRecordIds.length).toBeGreaterThan(0);
  });
});