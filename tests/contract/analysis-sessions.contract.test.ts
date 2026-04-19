import { createSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("analysis session contracts", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates and reuses connected-wallet sessions with the bootstrap contract shape", async () => {
    const firstSession = await createSession("0x1000000000000000000000000000000000000001", {
      connectionSource: "injected"
    });

    expect(firstSession.response.status).toBe(201);
    expect(firstSession.body.sessionId).toBeTruthy();
    expect(firstSession.body.walletAddress).toBe("0x1000000000000000000000000000000000000001");
    expect(firstSession.body.chainId).toBe(8453);
    expect(firstSession.body.status).toBe("active");
    expect(firstSession.body.reusedSession).toBe(false);
    expect(firstSession.body.latestAcceptedRunId).toBeNull();

    const secondSession = await createSession("0x1000000000000000000000000000000000000001", {
      connectionSource: "walletconnect"
    });

    expect(secondSession.response.status).toBe(201);
    expect(secondSession.body.sessionId).toBe(firstSession.body.sessionId);
    expect(secondSession.body.reusedSession).toBe(true);
    expect(secondSession.body.chainId).toBe(8453);
  });

  it("rejects connected-wallet bootstrap requests outside Base", async () => {
    const session = await createSession("0x1000000000000000000000000000000000000001", {
      chainId: 1
    });

    expect(session.response.status).toBe(400);
    expect(session.body.error).toContain("Base");
  });
});