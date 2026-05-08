import {
  createSession,
  fetchAccounting,
  fetchAccountingBootstrap,
  fetchSessionStatus,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("portfolio accounting flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("values the US1 wallet portfolio and preserves idle balance separately from open exposure", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.totalValue.amount).toBe("3950.0000");
    expect(body.capitalEntered.amount).toBe("1000.0000");
    expect(body.capitalWithdrawn.amount).toBe("200.0000");
    expect(body.realizedPnl.amount).toBe("0.0000");
    expect(body.unrealizedPnl.amount).toBe("150.0000");
    expect(body.idleBalanceValue.amount).toBe("300.0000");
    expect(body.pools[0].currentValue.amount).toBe("3650.0000");
    expect(body.pools[0].strategies[0].positions[0].currentValue.amount).toBe("3650.0000");
  });

  it("keeps manual and mellow strategies scoped independently for the US2 wallet", async () => {
    const { body: session } = await createSession("0x2000000000000000000000000000000000000002");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    const strategies = [...body.pools[0].strategies].sort((left, right) =>
      left.strategyType.localeCompare(right.strategyType)
    );

    expect(body.totalValue.amount).toBe("4290.0000");
    expect(strategies[0].strategyType).toBe("manual");
    expect(strategies[0].currentValue.amount).toBe("2400.0000");
    expect(strategies[0].positions[0].precisionStatus).toBe("exact");
    expect(strategies[1].strategyType).toBe("mellow_auto");
    expect(strategies[1].currentValue.amount).toBe("1890.0000");
    expect(strategies[1].positions[0].precisionStatus).toBe("exact");
  });

  it("surfaces discarded exclusions while keeping trusted current value for the US3 wallet", async () => {
    const { body: session } = await createSession("0x3000000000000000000000000000000000000003");
    await reconstructSession(session.sessionId);
    const { body } = await fetchAccounting(session.sessionId);

    expect(body.totalValue.amount).toBe("400.0000");
    expect(body.idleBalanceValue.amount).toBe("400.0000");
    expect(body.coverageSummary.coverageStatus).toBe("partial");
    expect(body.coverageSummary.reasonCodes).toContain("unsupported_protocol");
  });

  it("anchors bootstrap to accepted runs and exposes warm-up fallback states", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");

    const beforeAccepted = await fetchAccountingBootstrap(session.sessionId);
    expect(beforeAccepted.body.bootstrapState).toBe("empty");

    await reconstructSession(session.sessionId, { mode: "replay" });

    const status = await fetchSessionStatus(session.sessionId);
    const acceptedRunId = status.body.latestAcceptedRun?.reconstructionRunId;

    const afterAccepted = await fetchAccountingBootstrap(session.sessionId);
    expect(afterAccepted.body.hasAcceptedSnapshot).toBe(true);
    expect(afterAccepted.body.snapshot?.acceptedRunId).toBe(acceptedRunId);
    expect(["ready", "warming"]).toContain(afterAccepted.body.bootstrapState);
  });
});