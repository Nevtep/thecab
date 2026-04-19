import { type ReconstructionRunRecord, ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { type ReconstructionRunSnapshot, type SessionStatusSnapshot } from "@/domains/wallet-session/model/session-status-snapshot";
import { type WalletAnalysisSessionStatus } from "@/domains/wallet-session/model/analysis-session";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

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

    const [latestAcceptedRun, latestRun, lastFailure] = await Promise.all([
      this.reconstructionRunRepository.findLatestAcceptedBySession(analysisSessionId),
      this.reconstructionRunRepository.findLatestBySession(analysisSessionId),
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
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      errorSummary: run.errorSummary
    };
  }
}