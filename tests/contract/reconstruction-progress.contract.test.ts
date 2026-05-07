import {
  createSession,
  fetchReconstructionProgress,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("reconstruction progress contract", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns progress metadata for a reconstruction run in the session", async () => {
    const { body: session } = await createSession("0x1000000000000000000000000000000000000001");
    const run = await reconstructSession(session.sessionId, {
      mode: "replay"
    });

    const progress = await fetchReconstructionProgress(session.sessionId, run.body.reconstructionRunId);

    expect(progress.response.status).toBe(200);
    expect(progress.body.reconstructionRunId).toBe(run.body.reconstructionRunId);
    expect(progress.body.sessionId).toBe(session.sessionId);
    expect(progress.body.status).toBe("accepted");
    expect(progress.body.latestProcessedBlock).toBe(progress.body.toBlock);
    expect(progress.body.progressPercent).toBe(100);
    expect(progress.body.hydration.total).toBeGreaterThanOrEqual(0);
    expect(progress.body.hydration.hydrated).toBeGreaterThanOrEqual(0);
    expect(progress.body.hydration.failed).toBe(0);
  });
});
