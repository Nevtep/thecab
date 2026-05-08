import {
  createSession,
  fetchAccountingTimeSeries,
  fetchSessionStatus,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting time-series contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns an empty time-series payload before accepted reconstruction", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    const series = await fetchAccountingTimeSeries(session.sessionId);

    expect(series.response.status).toBe(200);
    expect(series.body.sessionId).toBe(session.sessionId);
    expect(series.body.acceptedRunId).toBeNull();
    expect(series.body.seriesState).toBe("empty");
    expect(series.body.partialReasonCodes).toEqual([]);
    expect(series.body.portfolioSeries).toEqual([]);
  });

  it("returns portfolio and pool series after accepted reconstruction", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId, { mode: "replay" });
    const status = await fetchSessionStatus(session.sessionId);

    const series = await fetchAccountingTimeSeries(session.sessionId);

    expect(series.response.status).toBe(200);
    expect(series.body.acceptedRunId).toBe(status.body.latestAcceptedRun?.reconstructionRunId ?? null);
    expect(series.body.quoteCurrency).toBe("usd");
    expect(["ready", "partial"]).toContain(series.body.seriesState);
    expect(series.body.portfolioSeries.length).toBeGreaterThan(0);
    expect(Array.isArray(series.body.poolSeries)).toBe(true);

    const firstPortfolioPoint = series.body.portfolioSeries[0];
    expect(firstPortfolioPoint.totalValue.currency).toBe("usd");
    expect(firstPortfolioPoint.totalValue.amount).toMatch(/^-?[0-9]+\.[0-9]{4}$/);
    expect(["full", "partial"]).toContain(firstPortfolioPoint.coverageStatus);

    const firstPool = series.body.poolSeries[0];
    if (firstPool && firstPool.points.length > 0) {
      expect(firstPool.points[0]?.deployedCapital.currency).toBe("usd");
      expect(firstPool.points[0]?.deployedCapital.amount).toMatch(/^-?[0-9]+\.[0-9]{4}$/);
    }
  });
});
