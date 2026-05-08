import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const ACCOUNTING_CONTRACT_VERSION = "1.0.0";

type EventMarkerType = "claim" | "lock" | "vote" | "rebalance" | "close" | "reopen" | "other";

function usd(amount: number) {
  return {
    currency: "usd" as const,
    amount: amount.toFixed(4)
  };
}

function parseMovementAmount(input: { amountRaw: string; decimals: number }) {
  const raw = Number.parseFloat(input.amountRaw);
  if (!Number.isFinite(raw)) {
    return 0;
  }

  const divisor = 10 ** input.decimals;
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return 0;
  }

  return raw / divisor;
}

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
  if (normalized.includes("reopen")) {
    return "reopen";
  }
  if (normalized.includes("close")) {
    return "close";
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
        seriesState: "empty" as const,
        partialReasonCodes: [],
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
      deployedCapital: { currency: "usd"; amount: string };
    }> }>();

    const partialReasonCodes = new Set<string>();
    let runningPortfolioValue = 0;
    const runningPoolCapitalByPool = new Map<string, number>();

    const portfolioSeries = sortedRecords.map((record) => {
      const perRecordMovements = movementByRecord.get(record.ledgerRecordId) ?? [];
      if (perRecordMovements.length === 0) {
        partialReasonCodes.add("missing_asset_movements");
      }

      const netFlow = perRecordMovements.reduce((sum, movement) => {
        const normalized = parseMovementAmount({
          amountRaw: movement.amountRaw,
          decimals: movement.decimals
        });
        if (movement.direction === "in") {
          return sum + normalized;
        }
        if (movement.direction === "out") {
          return sum - normalized;
        }
        partialReasonCodes.add("unknown_movement_direction");
        return sum;
      }, 0);

      runningPortfolioValue += netFlow;

      return {
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        eventType: record.eventType,
        totalValue: usd(Math.max(runningPortfolioValue, 0)),
        coverageStatus: perRecordMovements.length === 0 ? "partial" as const : "full" as const
      };
    });

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

      const poolNetFlow = perRecordMovements.reduce((sum, movement) => {
        const normalized = parseMovementAmount({
          amountRaw: movement.amountRaw,
          decimals: movement.decimals
        });
        if (movement.direction === "in") {
          return sum + normalized;
        }
        if (movement.direction === "out") {
          return sum - normalized;
        }
        return sum;
      }, 0);

      const runningPoolCapital = (runningPoolCapitalByPool.get(record.poolId) ?? 0) + poolNetFlow;
      runningPoolCapitalByPool.set(record.poolId, runningPoolCapital);

      current.points.push({
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        eventType: record.eventType,
        flowDirection,
        deployedCapital: usd(Math.max(runningPoolCapital, 0))
      });
      poolSeriesMap.set(record.poolId, current);
    }

    const seriesState = partialReasonCodes.size > 0 ? "partial" : "ready";

    return {
      contractVersion: ACCOUNTING_CONTRACT_VERSION,
      sessionId,
      acceptedRunId: acceptedRun.reconstructionRunId,
      quoteCurrency: "usd" as const,
      seriesState,
      partialReasonCodes: [...partialReasonCodes],
      portfolioSeries,
      poolSeries: [...poolSeriesMap.values()],
      eventMarkers
    };
  }
}
