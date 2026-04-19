import { buildReconstructionRunId } from "@/domains/ledger/model/ids";
import { getCurrentRulesetMetadata } from "@/domains/ledger/heuristics/registry";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

export class ReconstructionRunService {
  constructor(
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly sessionRepository: SessionRepository
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

    const ruleset = getCurrentRulesetMetadata();
    const startedAt = new Date();
    return this.reconstructionRunRepository.create({
      reconstructionRunId: buildReconstructionRunId({
        analysisSessionId: input.analysisSessionId,
        startedAt,
        classifierVersion: ruleset.classifierVersion,
        heuristicsVersion: ruleset.heuristicsVersion,
        fromBlock: input.fromBlock ?? null,
        toBlock: input.toBlock ?? null
      }),
      analysisSessionId: input.analysisSessionId,
      runMode: input.mode,
      classifierVersion: ruleset.classifierVersion,
      heuristicsVersion: ruleset.heuristicsVersion,
      fromBlock: input.fromBlock ?? null,
      toBlock: input.toBlock ?? null,
      status: "pending",
      startedAt
    });
  }

  async transitionTo(
    reconstructionRunId: string,
    status: "ingesting" | "normalizing" | "projecting" | "accepted"
  ) {
    return this.reconstructionRunRepository.updateStatus(reconstructionRunId, {
      status,
      completedAt: status === "accepted" ? new Date() : null
    });
  }

  async acceptRun(input: { analysisSessionId: string; reconstructionRunId: string }) {
    const run = await this.reconstructionRunRepository.updateStatus(input.reconstructionRunId, {
      status: "accepted",
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
}