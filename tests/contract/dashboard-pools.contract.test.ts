import {
  createSession,
  fetchDashboardPoolDetail,
  fetchDashboardPools,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("dashboard pools contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns empty pools before accepted reconstruction", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    const pools = await fetchDashboardPools(session.sessionId);

    expect(pools.response.status).toBe(200);
    expect(pools.body.sessionId).toBe(session.sessionId);
    expect(pools.body.acceptedRunId).toBeNull();
    expect(pools.body.pools).toEqual([]);
  });

  it("returns pool list and detail after accepted reconstruction", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId, { mode: "replay" });

    const pools = await fetchDashboardPools(session.sessionId);

    expect(pools.response.status).toBe(200);
    expect(Array.isArray(pools.body.pools)).toBe(true);
    expect(typeof pools.body.acceptedRunId === "string" || pools.body.acceptedRunId === null).toBe(true);

    const firstPoolId = pools.body.pools[0]?.poolId;
    if (firstPoolId) {
      const poolDetail = await fetchDashboardPoolDetail(session.sessionId, firstPoolId);
      expect(poolDetail.response.status).toBe(200);
      expect(poolDetail.body.sessionId).toBe(session.sessionId);
      expect(poolDetail.body.pool?.poolId).toBe(firstPoolId);

      if (poolDetail.body.pool?.strategies?.length) {
        const strategyTypes = new Set(poolDetail.body.pool.strategies.map((strategy: { strategyType: string }) => strategy.strategyType));
        expect(strategyTypes.has("manual") || strategyTypes.has("mellow_auto")).toBe(true);

        const strategyTotal = poolDetail.body.pool.strategies.reduce(
          (sum: number, strategy: { currentValue: { amount: string } }) => sum + Number(strategy.currentValue.amount),
          0
        );
        expect(strategyTotal.toFixed(4)).toBe(poolDetail.body.pool.currentValue.amount);
      }
    }
  });
});
