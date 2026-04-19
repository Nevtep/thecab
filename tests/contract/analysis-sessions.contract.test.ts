import { createSession, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("analysis session contracts", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates sessions and starts reconstructions with the contract shape", async () => {
    const session = await createSession("0x1000000000000000000000000000000000000001");
    expect(session.response.status).toBe(201);
    expect(session.body.sessionId).toBeTruthy();
    expect(session.body.chainId).toBe(8453);

    const reconstruction = await reconstructSession(session.body.sessionId);
    expect(reconstruction.response.status).toBe(202);
    expect(reconstruction.body.reconstructionRunId).toBeTruthy();
    expect(reconstruction.body.status).toBe("accepted");
  });
});