import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { getDb } from "@/infrastructure/db/client";
import { createSession, reconstructSession } from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("external transfer classification replay", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("classifies external deposits and withdrawals as canonical wallet flow events", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    const { body: run } = await reconstructSession(session.sessionId);

    const records = await new LedgerOutputRepository(getDb()).listCanonicalLedgerRecordsByRun(
      run.reconstructionRunId
    );
    const eventTypes = records.map((record) => record.eventType);

    expect(eventTypes).toContain("external_deposit");
    expect(eventTypes).toContain("external_withdrawal");
  });
});