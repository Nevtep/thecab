import {
  createSession,
  fetchAccountingRebalanceFlows,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("accounting rebalance-flows contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns empty flow payload before accepted reconstruction", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    const flows = await fetchAccountingRebalanceFlows(session.sessionId);

    expect(flows.response.status).toBe(200);
    expect(flows.body.acceptedRunId).toBeNull();
    expect(flows.body.flows).toEqual([]);
  });

  it("returns rebalance flow payload shape after reconstruction", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId, { mode: "replay" });

    const flows = await fetchAccountingRebalanceFlows(session.sessionId);

    expect(flows.response.status).toBe(200);
    expect(flows.body.acceptedRunId).toBeTruthy();
    expect(Array.isArray(flows.body.flows)).toBe(true);

    const first = flows.body.flows[0];
    if (first) {
      expect(first).toHaveProperty("txHash");
      expect(first).toHaveProperty("fromPoolId");
      expect(first).toHaveProperty("toPoolId");
      expect(first).toHaveProperty("confidence");
    }
  });
});
