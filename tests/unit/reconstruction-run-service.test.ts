import { ReconstructionRunService } from "@/domains/ledger/services/reconstruction-run-service";

describe("reconstruction run service", () => {
  it("starts new live runs from the wallet checkpoint instead of block zero", async () => {
    const sessionRepository = {
      findById: vi.fn().mockResolvedValue({
        analysisSessionId: "session_1",
        walletAddress: "0x1000000000000000000000000000000000000001",
        chainId: 8453
      })
    };
    const reconstructionRunRepository = {
      findLatestBySession: vi.fn().mockResolvedValue(null),
      findLatestAcceptedBySession: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (input) => input),
      updateStatus: vi.fn()
    };
    const walletDiscoveryCheckpointRepository = {
      findByWallet: vi.fn().mockResolvedValue({
        walletAddress: "0x1000000000000000000000000000000000000001",
        chainId: 8453,
        providerKey: "basescan_v2",
        latestIndexedBlock: 150n,
        latestHydratedBlock: 150n,
        latestAcceptedBlock: 150n,
        providerCursor: null,
        pendingReconstructionRunId: null,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
    };

    const service = new ReconstructionRunService(
      reconstructionRunRepository as never,
      sessionRepository as never,
      walletDiscoveryCheckpointRepository as never
    );

    const run = await service.startPendingRun({
      analysisSessionId: "session_1",
      mode: "initial",
      toBlock: 200n
    });

    expect(run.fromBlock).toBe(151n);
    expect(run.toBlock).toBe(200n);
    expect(walletDiscoveryCheckpointRepository.findByWallet).toHaveBeenCalledWith(
      "0x1000000000000000000000000000000000000001",
      8453
    );
  });
});