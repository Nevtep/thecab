import {
  createSession,
  fetchAccounting,
  fetchAccountingTimeSeries,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting explainability flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps priced totals visible while disclosing unsupported exclusions", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.totalValue.amount).toBe("400.0000");
    expect(body.coverageSummary.coverageStatus).toBe("partial");
    expect(body.coverageSummary.reasonCodes).toContain("unsupported_protocol");
  });

  it("signals explicit partial state when historical series has sparse coverage", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);

    const series = await fetchAccountingTimeSeries(session.sessionId);

    expect(series.response.status).toBe(200);
    expect(["partial", "ready"]).toContain(series.body.seriesState);
    expect(series.body.portfolioSeries.length).toBeGreaterThan(0);

    if (series.body.seriesState === "partial") {
      expect(series.body.partialReasonCodes.length).toBeGreaterThan(0);
    }
  });
});