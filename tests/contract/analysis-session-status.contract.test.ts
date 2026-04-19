import {
  createSession,
  fetchSessionStatus,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("analysis session status contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns the session status summary with latest accepted and latest run metadata", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    const acceptedRun = await reconstructSession(session.sessionId);

    const status = await fetchSessionStatus(session.sessionId);

    expect(status.response.status).toBe(200);
    expect(status.body.session.sessionId).toBe(session.sessionId);
    expect(status.body.session.walletAddress).toBe("0x2000000000000000000000000000000000000002");
    expect(status.body.session.chainId).toBe(8453);
    expect(status.body.session.reusedSession).toBe(false);
    expect(status.body.latestAcceptedRun.reconstructionRunId).toBe(acceptedRun.body.reconstructionRunId);
    expect(status.body.latestAcceptedRun.status).toBe("accepted");
    expect(status.body.latestRun.reconstructionRunId).toBe(acceptedRun.body.reconstructionRunId);
    expect(status.body.latestRun.status).toBe("accepted");
    expect(status.body.lastFailure).toBeNull();
    expect(status.body.hasAcceptedProjection).toBe(true);
  });
});