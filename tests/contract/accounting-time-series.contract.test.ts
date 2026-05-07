import {
  createSession,
  fetchAccountingTimeSeries,
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
    expect(series.body.portfolioSeries).toEqual([]);
  });

  it("returns portfolio and pool series after accepted reconstruction", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId, { mode: "replay" });

    const series = await fetchAccountingTimeSeries(session.sessionId);

    expect(series.response.status).toBe(200);
    expect(series.body.acceptedRunId).toBeTruthy();
    expect(series.body.quoteCurrency).toBe("usd");
    expect(series.body.portfolioSeries.length).toBeGreaterThan(0);
    expect(Array.isArray(series.body.poolSeries)).toBe(true);
  });
});
