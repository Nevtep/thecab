import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const ACCOUNTING_CONTRACT_VERSION = "1.0.0";

type EventMarkerType = "claim" | "lock" | "vote" | "rebalance" | "withdraw" | "deposit" | "swap" | "other";

function classifyMarkerType(eventType: string): EventMarkerType {
  const normalized = eventType.toLowerCase();

  if (normalized.includes("claim")) {
    return "claim";
  }
  if (normalized.includes("lock")) {
    return "lock";
  }
  if (normalized.includes("vote")) {
    return "vote";
  }
  if (normalized.includes("rebalance")) {
    return "rebalance";
  }
  if (normalized.includes("withdraw")) {
    return "withdraw";
  }
  if (normalized.includes("deposit")) {
    return "deposit";
  }
  if (normalized.includes("swap")) {
    return "swap";
  }

  return "other";
}

export class AccountingTimeSeriesService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly ledgerOutputRepository: LedgerOutputRepository
  ) {}

  async getTimeSeries(sessionId: string) {
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
        quoteCurrency: "usd" as const,
        portfolioSeries: [],
        poolSeries: [],
        eventMarkers: []
      };
    }

    const records = await this.ledgerOutputRepository.listCanonicalLedgerRecordsByRun(
      acceptedRun.reconstructionRunId
    );
    const sortedRecords = [...records].sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber < right.blockNumber ? -1 : 1;
      }

      if (left.eventSequence !== right.eventSequence) {
        return left.eventSequence - right.eventSequence;
      }

      return left.ledgerRecordId.localeCompare(right.ledgerRecordId);
    });

    const movements = await this.ledgerOutputRepository.listAssetMovementsByLedgerRecordIds(
      sortedRecords.map((record) => record.ledgerRecordId)
    );
    const movementByRecord = new Map<string, typeof movements>();
    for (const movement of movements) {
      const existing = movementByRecord.get(movement.ledgerRecordId) ?? [];
      existing.push(movement);
      movementByRecord.set(movement.ledgerRecordId, existing);
    }

    const poolSeriesMap = new Map<string, { poolId: string; displayName: string; points: Array<{
      ledgerRecordId: string;
      blockNumber: number;
      timestamp: string;
      eventType: string;
      flowDirection: "in" | "out" | "internal";
    }> }>();

    const portfolioSeries = sortedRecords.map((record) => ({
      ledgerRecordId: record.ledgerRecordId,
      blockNumber: Number(record.blockNumber),
      timestamp: record.timestamp.toISOString(),
      eventType: record.eventType,
      totalValue: null
    }));

    const eventMarkers = sortedRecords
      .map((record) => ({
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        markerType: classifyMarkerType(record.eventType),
        label: record.eventType
      }))
      .filter((marker) => marker.markerType !== "other");

    for (const record of sortedRecords) {
      if (!record.poolId) {
        continue;
      }

      const perRecordMovements = movementByRecord.get(record.ledgerRecordId) ?? [];
      const hasIn = perRecordMovements.some((movement) => movement.direction === "in");
      const hasOut = perRecordMovements.some((movement) => movement.direction === "out");
      const flowDirection = hasIn && hasOut ? "internal" : hasIn ? "in" : hasOut ? "out" : "internal";

      const current = poolSeriesMap.get(record.poolId) ?? {
        poolId: record.poolId,
        displayName: record.poolId,
        points: []
      };

      current.points.push({
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        eventType: record.eventType,
        flowDirection
      });
      poolSeriesMap.set(record.poolId, current);
    }

    return {
      contractVersion: ACCOUNTING_CONTRACT_VERSION,
      sessionId,
      acceptedRunId: acceptedRun.reconstructionRunId,
      quoteCurrency: "usd" as const,
      portfolioSeries,
      poolSeries: [...poolSeriesMap.values()],
      eventMarkers
    };
  }
}
