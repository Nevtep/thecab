import { createSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("connected wallet session bootstrap flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates or resumes exactly one Base session for the connected wallet", async () => {
    const firstSession = await createSession("0x2000000000000000000000000000000000000002", {
      connectionSource: "injected"
    });
    const secondSession = await createSession("0x2000000000000000000000000000000000000002", {
      connectionSource: "walletconnect"
    });

    expect(firstSession.response.status).toBe(201);
    expect(firstSession.body.reusedSession).toBe(false);
    expect(firstSession.body.walletAddress).toBe("0x2000000000000000000000000000000000000002");

    expect(secondSession.response.status).toBe(201);
    expect(secondSession.body.sessionId).toBe(firstSession.body.sessionId);
    expect(secondSession.body.reusedSession).toBe(true);
    expect(secondSession.body.chainId).toBe(8453);
  });

  it("rejects non-Base bootstrap requests before a session is created", async () => {
    const session = await createSession("0x2000000000000000000000000000000000000002", {
      chainId: 1,
      connectionSource: "injected"
    });

    expect(session.response.status).toBe(400);
    expect(session.body.error).toContain("Base");
  });
});