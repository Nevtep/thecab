import Decimal from "decimal.js";

import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { PricePointRepository } from "@/domains/pricing/repositories/price-point-repository";
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
  const raw = new Decimal(input.amountRaw);
  const divisor = new Decimal(10).pow(input.decimals);

  if (divisor.lte(0)) {
    return new Decimal(0);
  }

  return raw.div(divisor);
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
    private readonly ledgerOutputRepository: LedgerOutputRepository,
    private readonly pricePointRepository: PricePointRepository
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
    const runningPoolCapitalByPool = new Map<string, Decimal>();
    const runningTokenBalances = new Map<string, Decimal>();
    const historicalPriceCache = new Map<
      string,
      {
        knownAsset: boolean;
        points: Array<{
          effectiveAt: Date;
          priceValue: string;
          sourceKind: string;
        }>;
      }
    >();

    const resolveHistoricalPrice = async (tokenAddress: string, timestamp: Date) => {
      const normalizedToken = tokenAddress.toLowerCase();
      let cached = historicalPriceCache.get(normalizedToken);

      if (!cached) {
        const priceAsset = await this.pricePointRepository.findPriceAsset(session.chainId, normalizedToken);

        if (!priceAsset) {
          historicalPriceCache.set(normalizedToken, {
            knownAsset: false,
            points: []
          });
          partialReasonCodes.add("missing_price_asset");
          return null;
        }

        const points = await this.pricePointRepository.listPricePointsForAsset(priceAsset.priceAssetId);
        cached = {
          knownAsset: true,
          points: points.map((point) => ({
            effectiveAt: point.effectiveAt,
            priceValue: point.priceValue,
            sourceKind: point.sourceKind
          }))
        };
        historicalPriceCache.set(normalizedToken, cached);
      }

      if (!cached.knownAsset) {
        return null;
      }

      const historicalPoint = cached.points.find(
        (point) => point.sourceKind === "historical" && point.effectiveAt <= timestamp
      );

      if (!historicalPoint) {
        partialReasonCodes.add("missing_historical_price_point");
        return null;
      }

      return new Decimal(historicalPoint.priceValue);
    };

    const portfolioSeries = [];

    for (const record of sortedRecords) {
      const perRecordMovements = movementByRecord.get(record.ledgerRecordId) ?? [];
      if (perRecordMovements.length === 0) {
        partialReasonCodes.add("missing_asset_movements");
      }

      for (const movement of perRecordMovements) {
        const normalized = parseMovementAmount({
          amountRaw: movement.amountRaw,
          decimals: movement.decimals
        });

        const existing = runningTokenBalances.get(movement.tokenAddress.toLowerCase()) ?? new Decimal(0);

        if (movement.direction === "in") {
          runningTokenBalances.set(movement.tokenAddress.toLowerCase(), existing.plus(normalized));
          continue;
        }

        if (movement.direction === "out") {
          runningTokenBalances.set(movement.tokenAddress.toLowerCase(), existing.minus(normalized));
          continue;
        }

        partialReasonCodes.add("missing_movement_direction");
      }

      let totalValueUsd = new Decimal(0);
      let isPartial = perRecordMovements.length === 0;

      for (const [tokenAddress, balance] of runningTokenBalances.entries()) {
        if (balance.abs().lt("0.0000000000001")) {
          continue;
        }

        const price = await resolveHistoricalPrice(tokenAddress, record.timestamp);
        if (!price) {
          isPartial = true;
          continue;
        }

        totalValueUsd = totalValueUsd.plus(balance.mul(price));
      }

      const clampedPortfolioValueUsd = totalValueUsd.lessThan(0) ? new Decimal(0) : totalValueUsd;

      portfolioSeries.push({
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        eventType: record.eventType,
        totalValue: usd(clampedPortfolioValueUsd.toNumber()),
        coverageStatus: isPartial ? "partial" as const : "full" as const
      });
    }

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

      let poolNetFlowUsd = new Decimal(0);
      for (const movement of perRecordMovements) {
        const normalized = parseMovementAmount({
          amountRaw: movement.amountRaw,
          decimals: movement.decimals
        });

        const price = await resolveHistoricalPrice(movement.tokenAddress, record.timestamp);
        if (!price) {
          continue;
        }

        const movementValueUsd = normalized.mul(price);
        if (movement.direction === "in") {
          poolNetFlowUsd = poolNetFlowUsd.plus(movementValueUsd);
          continue;
        }
        if (movement.direction === "out") {
          poolNetFlowUsd = poolNetFlowUsd.minus(movementValueUsd);
          continue;
        }
      }

      const runningPoolCapital = (runningPoolCapitalByPool.get(record.poolId) ?? new Decimal(0)).plus(poolNetFlowUsd);
      runningPoolCapitalByPool.set(record.poolId, runningPoolCapital);

      current.points.push({
        ledgerRecordId: record.ledgerRecordId,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        eventType: record.eventType,
        flowDirection,
        deployedCapital: usd(runningPoolCapital.lessThan(0) ? 0 : runningPoolCapital.toNumber())
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
