import { buildReconstructionRunId } from "@/domains/ledger/model/ids";
import { getCurrentRulesetMetadata } from "@/domains/ledger/heuristics/registry";
import { type ReconstructionRunRecord, ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { type WalletDiscoveryCheckpointRepository } from "@/domains/ledger/repositories/wallet-discovery-checkpoint-repository";
import { isReconstructionRunActive } from "@/domains/ledger/services/active-reconstruction-run-registry";
import { IngestionOrchestrator } from "@/domains/ledger/services/ingestion-orchestrator";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const RUNNING_RECONSTRUCTION_STATUSES = new Set(["pending", "ingesting", "normalizing", "projecting"]);
const INTERRUPTED_RECONSTRUCTION_RUN_ERROR =
  "Reconstruction run was superseded after its worker stopped. A new reconstruction run resumed from the latest checkpoint.";
const NOOP_WALLET_DISCOVERY_CHECKPOINT_REPOSITORY: Pick<WalletDiscoveryCheckpointRepository, "findByWallet"> = {
  async findByWallet() {
    return null;
  }
};

export class ReconstructionRunService {
  private readonly ingestionOrchestrator = new IngestionOrchestrator();

  constructor(
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly walletDiscoveryCheckpointRepository: Pick<WalletDiscoveryCheckpointRepository, "findByWallet"> = NOOP_WALLET_DISCOVERY_CHECKPOINT_REPOSITORY
  ) {}

  async startPendingRun(input: {
    analysisSessionId: string;
    mode: "initial" | "incremental" | "replay";
    fromBlock?: bigint | null;
    toBlock?: bigint | null;
  }) {
    const session = await this.sessionRepository.findById(input.analysisSessionId);
    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const latestRun = await this.reconstructionRunRepository.findLatestBySession(input.analysisSessionId);
    if (latestRun && RUNNING_RECONSTRUCTION_STATUSES.has(latestRun.status)) {
      if (isReconstructionRunActive(latestRun.reconstructionRunId)) {
        return latestRun;
      }

      await this.reconstructionRunRepository.updateStatus(latestRun.reconstructionRunId, {
        status: "failed",
        completedAt: new Date(),
        errorSummary: INTERRUPTED_RECONSTRUCTION_RUN_ERROR
      });
    }

    const resolvedRange = await this.resolveRunRange(input, latestRun);
    if (resolvedRange.latestAcceptedRun && resolvedRange.noNewBlocks) {
      return resolvedRange.latestAcceptedRun;
    }

    const ruleset = getCurrentRulesetMetadata();
    const startedAt = new Date();
    return this.reconstructionRunRepository.create({
      reconstructionRunId: buildReconstructionRunId({
        analysisSessionId: input.analysisSessionId,
        startedAt,
        classifierVersion: ruleset.classifierVersion,
        heuristicsVersion: ruleset.heuristicsVersion,
        fromBlock: resolvedRange.fromBlock,
        toBlock: resolvedRange.toBlock
      }),
      analysisSessionId: input.analysisSessionId,
      runMode: input.mode,
      classifierVersion: ruleset.classifierVersion,
      heuristicsVersion: ruleset.heuristicsVersion,
      fromBlock: resolvedRange.fromBlock,
      toBlock: resolvedRange.toBlock,
      status: "pending",
      startedAt
    });
  }

  async transitionTo(
    reconstructionRunId: string,
    status: "ingesting" | "normalizing" | "projecting" | "accepted",
    input?: {
      checkpointBlock?: bigint | null;
    }
  ) {
    return this.reconstructionRunRepository.updateStatus(reconstructionRunId, {
      status,
      checkpointBlock: input?.checkpointBlock,
      completedAt: status === "accepted" ? new Date() : null
    });
  }

  async acceptRun(input: {
    analysisSessionId: string;
    reconstructionRunId: string;
    checkpointBlock?: bigint | null;
  }) {
    const run = await this.reconstructionRunRepository.updateStatus(input.reconstructionRunId, {
      status: "accepted",
      checkpointBlock: input.checkpointBlock,
      completedAt: new Date()
    });

    await this.sessionRepository.setLatestAcceptedRun(
      input.analysisSessionId,
      input.reconstructionRunId
    );

    return run;
  }

  async failRun(reconstructionRunId: string, errorSummary: string) {
    return this.reconstructionRunRepository.updateStatus(reconstructionRunId, {
      status: "failed",
      errorSummary,
      completedAt: new Date()
    });
  }

  async findLatestAcceptedRun(analysisSessionId: string): Promise<ReconstructionRunRecord | null> {
    return this.reconstructionRunRepository.findLatestAcceptedBySession(analysisSessionId);
  }

  private async resolveRunRange(input: {
    analysisSessionId: string;
    mode: "initial" | "incremental" | "replay";
    fromBlock?: bigint | null;
    toBlock?: bigint | null;
  }, latestRun?: ReconstructionRunRecord | null) {
    const session = await this.sessionRepository.findById(input.analysisSessionId);
    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const resolvedToBlock = input.toBlock ?? (await this.ingestionOrchestrator.resolveCheckpointBlock());
    const latestAcceptedRun = await this.reconstructionRunRepository.findLatestAcceptedBySession(
      input.analysisSessionId
    );
    const walletCheckpoint = await this.walletDiscoveryCheckpointRepository.findByWallet(
      session.walletAddress,
      session.chainId
    );
    const latestProcessedBlock = walletCheckpoint?.latestAcceptedBlock
      ?? latestAcceptedRun?.checkpointBlock
      ?? latestAcceptedRun?.toBlock
      ?? latestAcceptedRun?.fromBlock
      ?? null;
    const resolvedFromBlock = input.fromBlock ?? (
      input.mode !== "replay" && latestProcessedBlock != null
        ? latestProcessedBlock + 1n
        : 0n
    );

    const resumableCheckpoint = this.resolveResumableCheckpoint({
      latestRun: latestRun ?? null,
      mode: input.mode,
      resolvedToBlock
    });
    const effectiveFromBlock = resumableCheckpoint ?? resolvedFromBlock;

    const noNewBlocks = effectiveFromBlock > resolvedToBlock;
    if (noNewBlocks && !latestAcceptedRun && latestProcessedBlock == null) {
      throw new Error("The latest finalized Base block is already indexed for this wallet session.");
    }

    return {
      fromBlock: effectiveFromBlock,
      toBlock: resolvedToBlock,
      latestAcceptedRun,
      noNewBlocks
    };
  }

  private resolveResumableCheckpoint(input: {
    latestRun: ReconstructionRunRecord | null;
    mode: "initial" | "incremental" | "replay";
    resolvedToBlock: bigint;
  }) {
    const latestRun = input.latestRun;
    if (!latestRun || input.mode === "replay") {
      return null;
    }

    if (latestRun.runMode !== input.mode || latestRun.status === "accepted") {
      return null;
    }

    if (latestRun.checkpointBlock == null) {
      return null;
    }

    if (latestRun.checkpointBlock >= input.resolvedToBlock) {
      return latestRun.fromBlock ?? 0n;
    }

    return latestRun.checkpointBlock + 1n;
  }
}

export { INTERRUPTED_RECONSTRUCTION_RUN_ERROR };