import { fetchLedger, createSession, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

function normalizeProjection(body: Awaited<ReturnType<typeof fetchLedger>>["body"]) {
  return {
    contractVersion: body.contractVersion,
    pools: body.pools.map((pool: any) => ({
      displayName: pool.displayName,
      strategyTypes: pool.strategies.map((strategy: any) => strategy.strategyType).sort(),
      positions: pool.strategies.flatMap((strategy: any) =>
        strategy.positions.map((position: any) => ({
          positionType: position.positionType,
          identityReference: position.identityReference,
          ledgerEvents: position.ledgerRecords.map((record: any) => record.eventType)
        }))
      )
    })),
    residualHoldings: body.residualHoldings,
    discardedSummary: body.discardedSummary
  };
}

describe("wallet replay reconstruction", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("produces stable canonical projections across replay runs", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    await reconstructSession(session.sessionId);
    const firstProjection = await fetchLedger(session.sessionId);

    await reconstructSession(session.sessionId);
    const secondProjection = await fetchLedger(session.sessionId);

    expect(normalizeProjection(firstProjection.body)).toEqual(normalizeProjection(secondProjection.body));
  });
});