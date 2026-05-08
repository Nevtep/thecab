import { AccountingBootstrapService } from "@/domains/accounting/services/accounting-bootstrap-service";
import { accountingResponseSchema } from "@/domains/accounting/contracts/accounting-api-schemas";
import { AccountingSnapshotService } from "@/domains/accounting/services/accounting-snapshot-service";
import { DashboardSessionViewService } from "@/domains/accounting/services/dashboard-session-view-service";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const RUNNING_STATUSES = new Set(["pending", "ingesting", "normalizing", "projecting"]);

export class DashboardCompositionService {
  private readonly sessionViewService = new DashboardSessionViewService();
  private readonly bootstrapService = new AccountingBootstrapService();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly accountingSnapshotService: AccountingSnapshotService
  ) {}

  async composeBootstrap(sessionId: string) {
    const [session, latestAcceptedRun, latestRun] = await Promise.all([
      this.sessionRepository.findById(sessionId),
      this.reconstructionRunRepository.findLatestAcceptedBySession(sessionId),
      this.reconstructionRunRepository.findLatestBySession(sessionId)
    ]);

    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const hasAcceptedSnapshot = Boolean(latestAcceptedRun);
    const isReconstructionRunning = Boolean(latestRun && RUNNING_STATUSES.has(latestRun.status));

    const rawSnapshot = hasAcceptedSnapshot
      ? await this.accountingSnapshotService.getLatestSnapshot(sessionId)
      : null;

    const typedSnapshot = rawSnapshot ? accountingResponseSchema.parse(rawSnapshot) : null;

    // Enforce accepted-run anchoring: never expose a snapshot tied to a different run id.
    const snapshot = typedSnapshot && latestAcceptedRun && typedSnapshot.acceptedRunId === latestAcceptedRun.reconstructionRunId
      ? this.bootstrapService.mapOverviewSnapshot(typedSnapshot)
      : null;

    const sessionView = this.sessionViewService.build({
      analysisSessionId: sessionId,
      walletAddress: session.walletAddress,
      chainId: session.chainId,
      acceptedRunId: latestAcceptedRun?.reconstructionRunId ?? null,
      latestRunId: latestRun?.reconstructionRunId ?? null,
      latestRunStatus: latestRun?.status ?? null,
      hasAcceptedSnapshot: Boolean(snapshot),
      isReconstructionRunning,
      snapshotCoverageStatus: snapshot?.coverageSummary.coverageStatus ?? null
    });

    return {
      session,
      latestRun,
      snapshot,
      hasAcceptedSnapshot: Boolean(snapshot),
      isReconstructionRunning,
      bootstrapState: sessionView.bootstrapState,
      displayState: sessionView.displayState
    };
  }
}
