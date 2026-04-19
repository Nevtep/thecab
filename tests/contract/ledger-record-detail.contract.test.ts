import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { getDb } from "@/infrastructure/db/client";
import { createSession, fetchLedgerRecord, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("ledger record detail contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns provenance and asset movement fields for a canonical ledger record", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    const { body: run } = await reconstructSession(session.sessionId);
    const records = await new LedgerOutputRepository(getDb()).listCanonicalLedgerRecordsByRun(
      run.reconstructionRunId
    );
    const manualRecord = records.find((record) => record.eventType === "manual_position_opened");

    const detail = await fetchLedgerRecord(session.sessionId, manualRecord!.ledgerRecordId);
    expect(detail.response.status).toBe(200);
    expect(detail.body.record.sourceObservations.length).toBeGreaterThan(0);
    expect(detail.body.record.assetMovements.length).toBeGreaterThan(0);
  });
});