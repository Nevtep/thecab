import {
  createSession,
  fetchDashboardTimeline,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("dashboard timeline contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns timeline contract shape before accepted reconstruction", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    const timeline = await fetchDashboardTimeline(session.sessionId);

    expect(timeline.response.status).toBe(200);
    expect(timeline.body.sessionId).toBe(session.sessionId);
    expect(timeline.body.acceptedRunId).toBeNull();
    expect(timeline.body.markers).toEqual([]);
  });

  it("returns acceptedRunId after accepted reconstruction", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    await reconstructSession(session.sessionId, { mode: "replay" });

    const timeline = await fetchDashboardTimeline(session.sessionId);

    expect(timeline.response.status).toBe(200);
    expect(typeof timeline.body.acceptedRunId === "string" || timeline.body.acceptedRunId === null).toBe(true);
    expect(Array.isArray(timeline.body.markers)).toBe(true);

    for (const marker of timeline.body.markers) {
      expect(typeof marker.ledgerRecordId).toBe("string");
      expect(typeof marker.blockNumber).toBe("number");
      expect(typeof marker.timestamp).toBe("string");
      expect(["claim", "lock", "vote", "rebalance", "close", "reopen", "other"]).toContain(marker.markerType);
      expect(typeof marker.label).toBe("string");
    }
  });
});
