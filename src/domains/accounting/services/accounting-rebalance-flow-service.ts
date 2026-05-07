import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const ACCOUNTING_CONTRACT_VERSION = "1.0.0";

export class AccountingRebalanceFlowService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly ledgerOutputRepository: LedgerOutputRepository
  ) {}

  async getRebalanceFlows(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const acceptedRun = await this.reconstructionRunRepository.findLatestAcceptedBySession(sessionId);
    if (!acceptedRun) {
      return {
        contractVersion: ACCOUNTING_CONTRACT_VERSION,
        sessionId,
        acceptedRunId: null,
        flows: []
      };
    }

    const records = await this.ledgerOutputRepository.listCanonicalLedgerRecordsByRun(
      acceptedRun.reconstructionRunId
    );

    const byTxHash = new Map<string, typeof records>();
    for (const record of records) {
      const key = record.txHash.toLowerCase();
      const existing = byTxHash.get(key) ?? [];
      existing.push(record);
      byTxHash.set(key, existing);
    }

    const flows: Array<{
      flowId: string;
      txHash: string;
      fromPoolId: string;
      toPoolId: string;
      fromEventType: string;
      toEventType: string;
      blockNumber: number;
      timestamp: string;
      confidence: "heuristic" | "high";
      explanation: string;
    }> = [];

    for (const [txHash, txRecords] of byTxHash.entries()) {
      const sorted = [...txRecords].sort((left, right) => {
        if (left.eventSequence !== right.eventSequence) {
          return left.eventSequence - right.eventSequence;
        }

        if (left.blockNumber !== right.blockNumber) {
          return left.blockNumber < right.blockNumber ? -1 : 1;
        }

        return left.ledgerRecordId.localeCompare(right.ledgerRecordId);
      });

      for (let index = 0; index < sorted.length - 1; index += 1) {
        const current = sorted[index];
        const next = sorted[index + 1];

        if (!current || !next || !current.poolId || !next.poolId || current.poolId === next.poolId) {
          continue;
        }

        const flowId = `${txHash}:${current.ledgerRecordId}->${next.ledgerRecordId}`;
        flows.push({
          flowId,
          txHash,
          fromPoolId: current.poolId,
          toPoolId: next.poolId,
          fromEventType: current.eventType,
          toEventType: next.eventType,
          blockNumber: Number(next.blockNumber),
          timestamp: next.timestamp.toISOString(),
          confidence: "heuristic",
          explanation: "Cross-pool movement inferred from sequential canonical ledger events in the same transaction."
        });
      }
    }

    flows.sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }

      return left.flowId.localeCompare(right.flowId);
    });

    return {
      contractVersion: ACCOUNTING_CONTRACT_VERSION,
      sessionId,
      acceptedRunId: acceptedRun.reconstructionRunId,
      flows
    };
  }
}
