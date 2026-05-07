import { type ClassificationState } from "@/domains/ledger/classifiers/classification-engine";
import { type AnalysisSessionStateSnapshot } from "@/domains/ledger/model/analysis-session-state";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { type ReconstructionRunMode } from "@/domains/ledger/model/reconstruction-run";
import { WalletDiscoveryCheckpointRepository } from "@/domains/ledger/repositories/wallet-discovery-checkpoint-repository";
import { markReconstructionRunInactive } from "@/domains/ledger/services/active-reconstruction-run-registry";
import { CandidateTransactionService } from "@/domains/ledger/services/candidate-transaction-service";
import { IngestionOrchestrator } from "@/domains/ledger/services/ingestion-orchestrator";
import { LedgerNormalizationService } from "@/domains/ledger/services/ledger-normalization-service";
import { RawObservationIngestor } from "@/domains/ledger/services/raw-observation-ingestor";
import { ReconstructionRunService } from "@/domains/ledger/services/reconstruction-run-service";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { type AnalysisSessionRecord } from "@/domains/wallet-session/repositories/session-repository";

export class ReconstructionExecutor {
  private readonly candidateTransactionService = new CandidateTransactionService();
  private readonly ingestionOrchestrator = new IngestionOrchestrator();
  private readonly rawObservationIngestor = new RawObservationIngestor();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly rawObservationRepository: RawObservationRepository,
    private readonly reconstructionRunService: ReconstructionRunService,
    private readonly ledgerNormalizationService: LedgerNormalizationService,
    private readonly analysisSessionStateRepository: AnalysisSessionStateRepository,
    private readonly walletDiscoveryCheckpointRepository: WalletDiscoveryCheckpointRepository
  ) {}

  async execute(input: {
    analysisSessionId: string;
    reconstructionRunId: string;
    mode: ReconstructionRunMode;
    fromBlock: bigint | null;
    toBlock: bigint | null;
  }) {
    let session: AnalysisSessionRecord | null = null;
    let latestProviderKey = "unknown";

    try {
      session = await this.sessionRepository.findById(input.analysisSessionId);
      if (!session) {
        throw new Error("Analysis session not found.");
      }

      const walletAddress = session.walletAddress;
      const previousSessionState = input.mode === "incremental"
        ? await this.analysisSessionStateRepository.findBySession(input.analysisSessionId)
        : null;
      const context = await this.ingestionOrchestrator.buildCandidateDiscoveryContext({
        walletAddress,
        fromBlock: input.fromBlock,
        toBlock: input.toBlock
      });

      await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "ingesting", {
        checkpointBlock: context.fromBlock
      });

      const processingWindows = input.mode === "replay"
        ? [{ fromBlock: context.fromBlock, toBlock: context.toBlock }]
        : this.ingestionOrchestrator.buildProcessingWindows({
            fromBlock: context.fromBlock,
            toBlock: context.toBlock
          });

      for (const window of processingWindows) {
        const providerKey = await this.ingestWindow({
          walletAddress,
          reconstructionRunId: input.reconstructionRunId,
          mode: input.mode,
          fromBlock: window.fromBlock,
          toBlock: window.toBlock
        });
        latestProviderKey = providerKey;

        if (input.mode !== "replay") {
          await this.walletDiscoveryCheckpointRepository.upsert({
            walletAddress,
            chainId: session.chainId,
            providerKey,
            latestIndexedBlock: window.toBlock,
            latestHydratedBlock: window.toBlock,
            pendingReconstructionRunId: input.reconstructionRunId,
            lastSyncedAt: new Date()
          });
        }

        await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "ingesting", {
          checkpointBlock: window.toBlock
        });
      }

      await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "normalizing", {
        checkpointBlock: context.toBlock
      });
      const rawObservations = await this.rawObservationRepository.listByRun(input.reconstructionRunId);
      const normalizationResult = await this.ledgerNormalizationService.normalize({
        reconstructionRunId: input.reconstructionRunId,
        analysisSessionId: input.analysisSessionId,
        walletAddress,
        rawObservations,
        initialState: this.toClassificationState(previousSessionState),
        initialResidualHoldings: previousSessionState?.residualHoldings ?? []
      });

      await this.analysisSessionStateRepository.upsert({
        analysisSessionId: input.analysisSessionId,
        latestAcceptedRunId: input.reconstructionRunId,
        manualPositions: [...normalizationResult.state.manualPositions.values()],
        mellowPositions: [...normalizationResult.state.mellowPositions.values()],
        poolAddressToId: [...normalizationResult.state.poolAddressToId.entries()].map(([poolAddress, poolId]) => ({
          poolAddress,
          poolId
        })),
        residualHoldings: normalizationResult.residualSnapshot
      });

      await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "projecting", {
        checkpointBlock: context.toBlock
      });
      await this.reconstructionRunService.acceptRun({
        analysisSessionId: input.analysisSessionId,
        reconstructionRunId: input.reconstructionRunId,
        checkpointBlock: context.toBlock
      });

      if (input.mode !== "replay") {
        await this.walletDiscoveryCheckpointRepository.upsert({
          walletAddress,
          chainId: session.chainId,
          providerKey: latestProviderKey,
          latestIndexedBlock: context.toBlock,
          latestHydratedBlock: context.toBlock,
          latestAcceptedBlock: context.toBlock,
          pendingReconstructionRunId: null,
          lastSyncedAt: new Date()
        });
      }

      return this.reconstructionRunService.transitionTo(input.reconstructionRunId, "accepted", {
        checkpointBlock: context.toBlock
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to execute reconstruction run.";
      if (session && input.mode !== "replay") {
        await this.walletDiscoveryCheckpointRepository.clearPendingRun(
          session.walletAddress,
          session.chainId,
          input.reconstructionRunId
        );
      }
      return this.reconstructionRunService.failRun(input.reconstructionRunId, message);
    } finally {
      markReconstructionRunInactive(input.reconstructionRunId);
    }
  }

  private async ingestWindow(input: {
    walletAddress: string;
    reconstructionRunId: string;
    mode: ReconstructionRunMode;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const discovery = await this.candidateTransactionService.discover({
      walletAddress: input.walletAddress,
      fromBlock: input.fromBlock,
      toBlock: input.toBlock,
      mode: input.mode
    });

    const rawObservationSeeds = [];
    for (const txHash of discovery.txHashes) {
      rawObservationSeeds.push(
        ...(await this.rawObservationIngestor.hydrateTransaction(
          txHash as `0x${string}`,
          discovery.observationCorpus
        ))
      );
    }

    await this.rawObservationRepository.appendMany(
      rawObservationSeeds.map((observation) => ({
        ...observation,
        rawObservationId: `${input.reconstructionRunId}:${observation.rawObservationId}`,
        reconstructionRunId: input.reconstructionRunId
      }))
    );

    return discovery.providerKey ?? "unknown";
  }

  private toClassificationState(snapshot: AnalysisSessionStateSnapshot | null): ClassificationState | undefined {
    if (!snapshot) {
      return undefined;
    }

    return {
      manualPositions: new Map(snapshot.manualPositions.map((position) => [position.tokenId, { ...position }])),
      mellowPositions: new Map(
        snapshot.mellowPositions.map((position) => [position.identityReference, { ...position }])
      ),
      poolAddressToId: new Map(
        snapshot.poolAddressToId.map((entry) => [entry.poolAddress.toLowerCase(), entry.poolId])
      )
    } satisfies ClassificationState;
  }
}