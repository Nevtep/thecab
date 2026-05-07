import { buildAnalysisSessionId, buildReconstructionRunId } from "@/domains/ledger/model/ids";
import {
  INTERRUPTED_RECONSTRUCTION_RUN_ERROR,
  ReconstructionRunService
} from "@/domains/ledger/services/reconstruction-run-service";
import { AnalysisSessionService } from "@/domains/wallet-session/services/analysis-session-service";

describe("ledger foundation", () => {
  it("builds deterministic IDs for sessions and reconstruction runs", () => {
    expect(buildAnalysisSessionId(8453, "0xAbC")).toBe(buildAnalysisSessionId(8453, "0xabc"));

    const startedAt = new Date("2026-04-19T00:00:00.000Z");
    expect(
      buildReconstructionRunId({
        analysisSessionId: "session_1",
        startedAt,
        classifierVersion: "1",
        heuristicsVersion: "1",
        fromBlock: 1n,
        toBlock: 2n
      })
    ).toBe(
      buildReconstructionRunId({
        analysisSessionId: "session_1",
        startedAt,
        classifierVersion: "1",
        heuristicsVersion: "1",
        fromBlock: 1n,
        toBlock: 2n
      })
    );
  });

  it("creates or resumes sessions through the session service", async () => {
    const createOrResume = vi.fn().mockResolvedValue({ analysisSessionId: "session_1" });
    const service = new AnalysisSessionService({ createOrResume } as never);

    const result = await service.createOrResume({
      walletAddress: "0x1000000000000000000000000000000000000001",
      chainId: 8453,
      connectionSource: "walletconnect"
    });

    expect(createOrResume).toHaveBeenCalledOnce();
    expect(result.analysisSessionId).toBe("session_1");
  });

  it("starts and accepts reconstruction runs", async () => {
    const create = vi.fn().mockResolvedValue({
      reconstructionRunId: "run_1",
      analysisSessionId: "session_1",
      status: "pending",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      fromBlock: null,
      toBlock: null,
      startedAt: new Date()
    });
    const updateStatus = vi.fn().mockResolvedValue({ reconstructionRunId: "run_1", status: "accepted" });
    const findById = vi.fn().mockResolvedValue({ analysisSessionId: "session_1" });
    const findLatestAcceptedBySession = vi.fn().mockResolvedValue(null);
    const findLatestBySession = vi.fn().mockResolvedValue(null);
    const setLatestAcceptedRun = vi.fn().mockResolvedValue({});

    const service = new ReconstructionRunService(
      { create, updateStatus, findLatestAcceptedBySession, findLatestBySession } as never,
      { findById, setLatestAcceptedRun } as never
    );

    const run = await service.startPendingRun({
      analysisSessionId: "session_1",
      mode: "replay",
      toBlock: 10n
    });
    await service.acceptRun({ analysisSessionId: "session_1", reconstructionRunId: run.reconstructionRunId });

    expect(findById).toHaveBeenCalledWith("session_1");
    expect(create).toHaveBeenCalledOnce();
    expect(updateStatus).toHaveBeenCalled();
    expect(setLatestAcceptedRun).toHaveBeenCalledWith("session_1", "run_1");
  });

  it("resumes a restarted run from the latest checkpoint when the old worker is gone", async () => {
    const create = vi.fn().mockResolvedValue({
      reconstructionRunId: "run_2",
      analysisSessionId: "session_2",
      status: "pending",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      fromBlock: 101n,
      toBlock: 200n,
      startedAt: new Date()
    });
    const updateStatus = vi
      .fn()
      .mockResolvedValueOnce({
        reconstructionRunId: "run_old",
        analysisSessionId: "session_2",
        status: "failed"
      })
      .mockResolvedValue({ reconstructionRunId: "run_2", status: "accepted" });
    const findById = vi.fn().mockResolvedValue({ analysisSessionId: "session_2" });
    const findLatestAcceptedBySession = vi.fn().mockResolvedValue(null);
    const findLatestBySession = vi.fn().mockResolvedValue({
      reconstructionRunId: "run_old",
      analysisSessionId: "session_2",
      runMode: "initial",
      status: "ingesting",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      fromBlock: 0n,
      toBlock: 150n,
      checkpointBlock: 100n,
      startedAt: new Date("2026-04-19T00:00:00.000Z")
    });
    const setLatestAcceptedRun = vi.fn().mockResolvedValue({});

    const service = new ReconstructionRunService(
      { create, updateStatus, findLatestAcceptedBySession, findLatestBySession } as never,
      { findById, setLatestAcceptedRun } as never
    );

    await service.startPendingRun({
      analysisSessionId: "session_2",
      mode: "initial",
      toBlock: 200n
    });

    expect(updateStatus).toHaveBeenCalledWith("run_old", {
      status: "failed",
      completedAt: expect.any(Date),
      errorSummary: INTERRUPTED_RECONSTRUCTION_RUN_ERROR
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: 101n,
        toBlock: 200n
      })
    );
  });
});