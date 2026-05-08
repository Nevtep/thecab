import {
  createSession,
  fetchAccountingBootstrap,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting bootstrap contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns empty bootstrap state before accepted reconstruction", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    const bootstrap = await fetchAccountingBootstrap(session.sessionId);

    expect(bootstrap.response.status).toBe(200);
    expect(bootstrap.body.sessionId).toBe(session.sessionId);
    expect(bootstrap.body.bootstrapState).toBe("empty");
    expect(bootstrap.body.hasAcceptedSnapshot).toBe(false);
    expect(bootstrap.body.snapshot).toBeNull();
  });

  it("returns ready bootstrap state and snapshot after accepted reconstruction", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId, { mode: "replay" });

    const bootstrap = await fetchAccountingBootstrap(session.sessionId);

    expect(bootstrap.response.status).toBe(200);
    expect(bootstrap.body.bootstrapState).toBe("ready");
    expect(bootstrap.body.hasAcceptedSnapshot).toBe(true);
    expect(bootstrap.body.snapshot).toBeTruthy();
    expect(bootstrap.body.snapshot.quoteCurrency).toBe("usd");
    expect(bootstrap.body.snapshot.totalValue.amount).toMatch(/^[0-9]+\.[0-9]{4}$/);
  });
});
