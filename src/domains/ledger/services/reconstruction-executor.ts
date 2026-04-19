import { CandidateTransactionService } from "@/domains/ledger/services/candidate-transaction-service";
import { IngestionOrchestrator } from "@/domains/ledger/services/ingestion-orchestrator";
import { LedgerNormalizationService } from "@/domains/ledger/services/ledger-normalization-service";
import { RawObservationIngestor } from "@/domains/ledger/services/raw-observation-ingestor";
import { ReconstructionRunService } from "@/domains/ledger/services/reconstruction-run-service";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

export class ReconstructionExecutor {
  private readonly candidateTransactionService = new CandidateTransactionService();
  private readonly ingestionOrchestrator = new IngestionOrchestrator();
  private readonly rawObservationIngestor = new RawObservationIngestor();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly rawObservationRepository: RawObservationRepository,
    private readonly reconstructionRunService: ReconstructionRunService,
    private readonly ledgerNormalizationService: LedgerNormalizationService
  ) {}

  async execute(input: {
    analysisSessionId: string;
    reconstructionRunId: string;
    fromBlock: bigint | null;
    toBlock: bigint | null;
  }) {
    const session = await this.sessionRepository.findById(input.analysisSessionId);
    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const walletAddress = session.walletAddress;
    const provisionalDiscovery = await this.candidateTransactionService.discover({
      walletAddress,
      fromBlock: input.fromBlock ?? 0n,
      toBlock: input.toBlock ?? 9_999_999_999n
    });
    const context = provisionalDiscovery.fixtureWallet
      ? {
          walletAddress,
          fromBlock: input.fromBlock ?? 0n,
          toBlock:
            input.toBlock ??
            BigInt(
              provisionalDiscovery.observationCorpus.reduce((highest, observation) => {
                return observation.blockNumber != null && observation.blockNumber > highest
                  ? observation.blockNumber
                  : highest;
              }, 0)
            ),
          protocolAllowlists: {
            aerodrome: [],
            mellow: []
          }
        }
      : await this.ingestionOrchestrator.buildCandidateDiscoveryContext({
          walletAddress,
          fromBlock: input.fromBlock,
          toBlock: input.toBlock
        });

    await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "ingesting");
    const discovery = provisionalDiscovery.fixtureWallet
      ? provisionalDiscovery
      : await this.candidateTransactionService.discover(context);

    const rawObservationSeeds = [];
    for (const txHash of discovery.txHashes) {
      rawObservationSeeds.push(
        ...(await this.rawObservationIngestor.hydrateTransaction(txHash as `0x${string}`, discovery.observationCorpus))
      );
    }

    await this.rawObservationRepository.appendMany(
      rawObservationSeeds.map((observation) => ({
        ...observation,
        rawObservationId: `${input.reconstructionRunId}:${observation.rawObservationId}`,
        reconstructionRunId: input.reconstructionRunId
      }))
    );

    await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "normalizing");
    const rawObservations = await this.rawObservationRepository.listByRun(input.reconstructionRunId);
    await this.ledgerNormalizationService.normalize({
      reconstructionRunId: input.reconstructionRunId,
      analysisSessionId: input.analysisSessionId,
      rawObservations
    });

    await this.reconstructionRunService.transitionTo(input.reconstructionRunId, "projecting");
    await this.reconstructionRunService.acceptRun({
      analysisSessionId: input.analysisSessionId,
      reconstructionRunId: input.reconstructionRunId
    });

    return this.reconstructionRunService.transitionTo(input.reconstructionRunId, "accepted");
  }
}