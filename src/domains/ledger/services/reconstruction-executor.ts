import { type ClassificationState } from "@/domains/ledger/classifiers/classification-engine";
import { type AnalysisSessionStateSnapshot } from "@/domains/ledger/model/analysis-session-state";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { type ReconstructionRunMode } from "@/domains/ledger/model/reconstruction-run";
import { DiscoveredActivityRepository } from "@/domains/ledger/repositories/discovered-activity-repository";
import { HydrationJobStateRepository } from "@/domains/ledger/repositories/hydration-job-state-repository";
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
  private static readonly DEFAULT_HYDRATION_BATCH_SIZE = 25;
  private static readonly DEFAULT_HYDRATION_CONCURRENCY = 4;
  private static readonly DEFAULT_MAX_HYDRATION_ATTEMPTS = 2;

  private readonly candidateTransactionService = new CandidateTransactionService();
  private readonly ingestionOrchestrator = new IngestionOrchestrator();
  private readonly rawObservationIngestor = new RawObservationIngestor();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly rawObservationRepository: RawObservationRepository,
    private readonly discoveredActivityRepository: DiscoveredActivityRepository,
    private readonly hydrationJobStateRepository: HydrationJobStateRepository,
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
        const discoveryMetadata = await this.ingestWindow({
          walletAddress,
          chainId: session.chainId,
          reconstructionRunId: input.reconstructionRunId,
          mode: input.mode,
          fromBlock: window.fromBlock,
          toBlock: window.toBlock
        });
        latestProviderKey = discoveryMetadata.providerKey;

        if (input.mode !== "replay" && discoveryMetadata.providerCursor != null) {
          await this.walletDiscoveryCheckpointRepository.upsertProviderCursor({
            walletAddress,
            chainId: session.chainId,
            providerAlias: discoveryMetadata.providerKey,
            cursor: discoveryMetadata.providerCursor
          });
        }

        if (input.mode !== "replay") {
          await this.walletDiscoveryCheckpointRepository.upsert({
            walletAddress,
            chainId: session.chainId,
            providerKey: discoveryMetadata.providerKey,
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
    chainId: number;
    reconstructionRunId: string;
    mode: ReconstructionRunMode;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const checkpoint = input.mode === "replay"
      ? null
      : await this.walletDiscoveryCheckpointRepository.findByWallet(input.walletAddress, input.chainId);
    const providerCursor = checkpoint?.providerKey
      ? await this.walletDiscoveryCheckpointRepository.getProviderCursor(
          input.walletAddress,
          input.chainId,
          checkpoint.providerKey
        )
      : null;

    const discovery = await this.candidateTransactionService.discover({
      walletAddress: input.walletAddress,
      fromBlock: input.fromBlock,
      toBlock: input.toBlock,
      mode: input.mode,
      providerCursor
    });

    await this.discoveredActivityRepository.upsertManyQueued({
      reconstructionRunId: input.reconstructionRunId,
      providerKey: discovery.providerKey ?? "unknown",
      providerCursor: discovery.providerCursor ?? null,
      txHashes: discovery.txHashes
    });
    await this.hydrationJobStateRepository.enqueueMany({
      reconstructionRunId: input.reconstructionRunId,
      txHashes: discovery.txHashes
    });

    const rawObservationSeeds = [];
    const hydrationErrors: string[] = [];
    const leaseOwner = `executor:${input.reconstructionRunId}`;
    const batchSize = this.getHydrationBatchSize();

    for (;;) {
      const claimedJobs = await this.hydrationJobStateRepository.claimBatch({
        reconstructionRunId: input.reconstructionRunId,
        leaseOwner,
        limit: batchSize
      });

      if (claimedJobs.length === 0) {
        break;
      }

      const chunks = this.chunk(claimedJobs, this.getHydrationConcurrency());
      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (job) => {
            const txHash = job.txHash;
            const hydratedSeeds = await this.rawObservationIngestor.hydrateTransaction(
              txHash as `0x${string}`,
              discovery.observationCorpus
            );

            await this.discoveredActivityRepository.markHydrated({
              reconstructionRunId: input.reconstructionRunId,
              txHash
            });
            await this.hydrationJobStateRepository.markHydrated({
              reconstructionRunId: input.reconstructionRunId,
              txHash
            });

            return hydratedSeeds;
          })
        );

        for (let index = 0; index < results.length; index += 1) {
          const result = results[index];
          const job = chunk[index];
          if (!job) {
            continue;
          }

          if (result.status === "fulfilled") {
            rawObservationSeeds.push(...result.value);
            continue;
          }

          const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
          const shouldRetry = job.attemptCount < this.getMaxHydrationAttempts();

          if (shouldRetry) {
            await this.hydrationJobStateRepository.markFailed({
              reconstructionRunId: input.reconstructionRunId,
              txHash: job.txHash,
              errorSummary: message,
              retryAt: new Date()
            });
            continue;
          }

          await this.discoveredActivityRepository.markFailed({
            reconstructionRunId: input.reconstructionRunId,
            txHash: job.txHash,
            errorSummary: message
          });
          await this.hydrationJobStateRepository.markFailed({
            reconstructionRunId: input.reconstructionRunId,
            txHash: job.txHash,
            errorSummary: message
          });
          hydrationErrors.push(`${job.txHash}: ${message}`);
        }
      }
    }

    if (hydrationErrors.length > 0) {
      throw new Error(`Hydration failed for ${hydrationErrors.length} transactions.`);
    }

    rawObservationSeeds.sort((left, right) => {
      const leftBlock = left.blockNumber ?? 0n;
      const rightBlock = right.blockNumber ?? 0n;
      if (leftBlock !== rightBlock) {
        return leftBlock < rightBlock ? -1 : 1;
      }

      const leftLog = left.logIndex ?? Number.MAX_SAFE_INTEGER;
      const rightLog = right.logIndex ?? Number.MAX_SAFE_INTEGER;
      if (leftLog !== rightLog) {
        return leftLog - rightLog;
      }

      return left.rawObservationId.localeCompare(right.rawObservationId);
    });

    await this.rawObservationRepository.appendMany(
      rawObservationSeeds.map((observation) => ({
        ...observation,
        rawObservationId: `${input.reconstructionRunId}:${observation.rawObservationId}`,
        reconstructionRunId: input.reconstructionRunId
      }))
    );

    return {
      providerKey: discovery.providerKey ?? "unknown",
      providerCursor: discovery.providerCursor ?? null
    };
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

  private getHydrationBatchSize() {
    const value = Number.parseInt(process.env.HYDRATION_WORKER_BATCH_SIZE ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : ReconstructionExecutor.DEFAULT_HYDRATION_BATCH_SIZE;
  }

  private getHydrationConcurrency() {
    const value = Number.parseInt(process.env.HYDRATION_WORKER_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : ReconstructionExecutor.DEFAULT_HYDRATION_CONCURRENCY;
  }

  private getMaxHydrationAttempts() {
    const value = Number.parseInt(process.env.HYDRATION_WORKER_MAX_ATTEMPTS ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : ReconstructionExecutor.DEFAULT_MAX_HYDRATION_ATTEMPTS;
  }

  private chunk<T>(values: T[], size: number) {
    const chunkSize = Math.max(1, size);
    const result: T[][] = [];

    for (let index = 0; index < values.length; index += chunkSize) {
      result.push(values.slice(index, index + chunkSize));
    }

    return result;
  }
}