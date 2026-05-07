import { type ReconstructionRunRecord, ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { isReconstructionRunActive } from "@/domains/ledger/services/active-reconstruction-run-registry";
import { type ReconstructionRunSnapshot, type SessionStatusSnapshot } from "@/domains/wallet-session/model/session-status-snapshot";
import { type WalletAnalysisSessionStatus } from "@/domains/wallet-session/model/analysis-session";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const ORPHANED_RECONSTRUCTION_RUN_GRACE_MS = 15 * 1000;
const STALE_RECONSTRUCTION_RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const RUNNING_RECONSTRUCTION_STATUSES = new Set(["pending", "ingesting", "normalizing", "projecting"]);
const ORPHANED_RECONSTRUCTION_RUN_ERROR =
  "Reconstruction run was interrupted before completion. Start a new reconstruction to resume from the latest checkpoint.";
const STALE_RECONSTRUCTION_RUN_ERROR =
  "Reconstruction run timed out while in progress. The previous process likely exited before completion. Start a new reconstruction to retry with the current RPC configuration.";

export class SessionStatusService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository
  ) {}

  async getStatus(analysisSessionId: string): Promise<SessionStatusSnapshot> {
    const session = await this.sessionRepository.findById(analysisSessionId);
    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const latestRun = await this.reconcileStaleLatestRun(analysisSessionId);

    const [latestAcceptedRun, lastFailure] = await Promise.all([
      this.reconstructionRunRepository.findLatestAcceptedBySession(analysisSessionId),
      this.reconstructionRunRepository.findLatestFailedBySession(analysisSessionId)
    ]);

    const sessionWithReuse = this.sessionRepository.toSessionWithReuseState(session);

    return {
      sessionId: session.analysisSessionId,
      walletAddress: session.walletAddress,
      chainId: session.chainId,
      sessionStatus: session.status as WalletAnalysisSessionStatus,
      reusedSession: sessionWithReuse.reusedSession,
      latestAcceptedRun: this.toRunSnapshot(latestAcceptedRun),
      latestRun: this.toRunSnapshot(latestRun),
      lastFailure: this.toRunSnapshot(lastFailure),
      hasAcceptedProjection: latestAcceptedRun !== null
    };
  }

  private async reconcileStaleLatestRun(analysisSessionId: string) {
    const latestRun = await this.reconstructionRunRepository.findLatestBySession(analysisSessionId);
    if (!latestRun || !RUNNING_RECONSTRUCTION_STATUSES.has(latestRun.status)) {
      return latestRun;
    }

    if (!isReconstructionRunActive(latestRun.reconstructionRunId)) {
      if (Date.now() - latestRun.startedAt.getTime() < ORPHANED_RECONSTRUCTION_RUN_GRACE_MS) {
        return latestRun;
      }

      return this.reconstructionRunRepository.updateStatus(latestRun.reconstructionRunId, {
        status: "failed",
        completedAt: new Date(),
        errorSummary: ORPHANED_RECONSTRUCTION_RUN_ERROR
      });
    }

    if (Date.now() - latestRun.startedAt.getTime() < STALE_RECONSTRUCTION_RUN_TIMEOUT_MS) {
      return latestRun;
    }

    return this.reconstructionRunRepository.updateStatus(latestRun.reconstructionRunId, {
      status: "failed",
      completedAt: new Date(),
      errorSummary: STALE_RECONSTRUCTION_RUN_ERROR
    });
  }

  private toRunSnapshot(run: ReconstructionRunRecord | null): ReconstructionRunSnapshot | null {
    if (!run) {
      return null;
    }

    return {
      reconstructionRunId: run.reconstructionRunId,
      sessionId: run.analysisSessionId,
      runMode: run.runMode as ReconstructionRunSnapshot["runMode"],
      status: run.status as ReconstructionRunSnapshot["status"],
      classifierVersion: run.classifierVersion,
      heuristicsVersion: run.heuristicsVersion,
      fromBlock: run.fromBlock,
      toBlock: run.toBlock,
      checkpointBlock: run.checkpointBlock,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      errorSummary: run.errorSummary
    };
  }
}

export {
  ORPHANED_RECONSTRUCTION_RUN_ERROR,
  ORPHANED_RECONSTRUCTION_RUN_GRACE_MS,
  STALE_RECONSTRUCTION_RUN_ERROR,
  STALE_RECONSTRUCTION_RUN_TIMEOUT_MS
};