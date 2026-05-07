import {
  ORPHANED_RECONSTRUCTION_RUN_ERROR,
  ORPHANED_RECONSTRUCTION_RUN_GRACE_MS,
  SessionStatusService,
  STALE_RECONSTRUCTION_RUN_ERROR
} from "@/domains/wallet-session/services/session-status-service";
import {
  markReconstructionRunActive,
  markReconstructionRunInactive
} from "@/domains/ledger/services/active-reconstruction-run-registry";

describe("session status service", () => {
  afterEach(() => {
    markReconstructionRunInactive("run_stale");
    markReconstructionRunInactive("run_orphaned");
  });

  it("fails stale in-progress runs before returning session status", async () => {
    const startedAt = new Date(Date.now() - 121 * 60 * 1000);
    markReconstructionRunActive("run_stale");
    const latestRun = {
      reconstructionRunId: "run_stale",
      analysisSessionId: "session_1",
      runMode: "initial",
      status: "ingesting",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      fromBlock: null,
      toBlock: null,
      checkpointBlock: null,
      startedAt,
      completedAt: null,
      errorSummary: null
    };
    const updatedRun = {
      ...latestRun,
      status: "failed",
      completedAt: new Date(),
      errorSummary: STALE_RECONSTRUCTION_RUN_ERROR
    };
    const sessionRepository = {
      findById: vi.fn().mockResolvedValue({
        analysisSessionId: "session_1",
        walletAddress: "0x1000000000000000000000000000000000000001",
        chainId: 8453,
        status: "active",
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
        lastRequestedAt: new Date("2026-04-20T00:00:00.000Z")
      }),
      toSessionWithReuseState: vi.fn().mockReturnValue({ reusedSession: false })
    };
    const reconstructionRunRepository = {
      findLatestBySession: vi.fn().mockResolvedValue(latestRun),
      updateStatus: vi.fn().mockResolvedValue(updatedRun),
      findLatestAcceptedBySession: vi.fn().mockResolvedValue(null),
      findLatestFailedBySession: vi.fn().mockResolvedValue(updatedRun)
    };

    const service = new SessionStatusService(sessionRepository as never, reconstructionRunRepository as never);
    const result = await service.getStatus("session_1");

    expect(reconstructionRunRepository.updateStatus).toHaveBeenCalledWith("run_stale", {
      status: "failed",
      completedAt: expect.any(Date),
      errorSummary: STALE_RECONSTRUCTION_RUN_ERROR
    });
    expect(result.latestRun?.status).toBe("failed");
    expect(result.lastFailure?.errorSummary).toBe(STALE_RECONSTRUCTION_RUN_ERROR);
  });

  it("fails orphaned in-progress runs from a previous process quickly", async () => {
    const startedAt = new Date(Date.now() - ORPHANED_RECONSTRUCTION_RUN_GRACE_MS - 1_000);
    const latestRun = {
      reconstructionRunId: "run_orphaned",
      analysisSessionId: "session_2",
      runMode: "initial",
      status: "ingesting",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      fromBlock: 0n,
      toBlock: 100n,
      checkpointBlock: 50n,
      startedAt,
      completedAt: null,
      errorSummary: null
    };
    const updatedRun = {
      ...latestRun,
      status: "failed",
      completedAt: new Date(),
      errorSummary: ORPHANED_RECONSTRUCTION_RUN_ERROR
    };
    const sessionRepository = {
      findById: vi.fn().mockResolvedValue({
        analysisSessionId: "session_2",
        walletAddress: "0x1000000000000000000000000000000000000002",
        chainId: 8453,
        status: "active",
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
        lastRequestedAt: new Date("2026-04-20T00:00:00.000Z")
      }),
      toSessionWithReuseState: vi.fn().mockReturnValue({ reusedSession: true })
    };
    const reconstructionRunRepository = {
      findLatestBySession: vi.fn().mockResolvedValue(latestRun),
      updateStatus: vi.fn().mockResolvedValue(updatedRun),
      findLatestAcceptedBySession: vi.fn().mockResolvedValue(null),
      findLatestFailedBySession: vi.fn().mockResolvedValue(updatedRun)
    };

    const service = new SessionStatusService(sessionRepository as never, reconstructionRunRepository as never);
    const result = await service.getStatus("session_2");

    expect(reconstructionRunRepository.updateStatus).toHaveBeenCalledWith("run_orphaned", {
      status: "failed",
      completedAt: expect.any(Date),
      errorSummary: ORPHANED_RECONSTRUCTION_RUN_ERROR
    });
    expect(result.latestRun?.status).toBe("failed");
  });
});