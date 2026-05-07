import { getSemanticFromObservation } from "@/lib/fixture-loader";

import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { getCurrentRulesetMetadata } from "@/domains/ledger/heuristics/registry";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { PositionLifecycleProjectionService } from "@/domains/ledger/projections/position-lifecycle-projection-service";
import { resolveAcceptedRunChain } from "@/domains/ledger/services/accepted-run-chain";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const CONTRACT_VERSION = "1.0.0";

export class LedgerProjectionService {
  private readonly positionProjectionService = new PositionLifecycleProjectionService();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly ledgerOutputRepository: LedgerOutputRepository,
    private readonly rawObservationRepository: RawObservationRepository,
    private readonly analysisSessionStateRepository: AnalysisSessionStateRepository
  ) {}

  private async resolveAcceptedRuns(analysisSessionId: string) {
    const session = await this.sessionRepository.findById(analysisSessionId);
    const acceptedRuns = resolveAcceptedRunChain(
      await this.reconstructionRunRepository.listAcceptedBySession(analysisSessionId)
    );

    return {
      session,
      acceptedRuns,
      latestAcceptedRun: acceptedRuns.at(-1) ?? null
    };
  }

  async getLatestProjection(analysisSessionId: string) {
    const { session, acceptedRuns, latestAcceptedRun } = await this.resolveAcceptedRuns(analysisSessionId);

    if (!session || !latestAcceptedRun) {
      return {
        contractVersion: CONTRACT_VERSION,
        classifierVersion: getCurrentRulesetMetadata().classifierVersion,
        heuristicsVersion: getCurrentRulesetMetadata().heuristicsVersion,
        sourceBlockRange: {
          fromBlock: 0,
          toBlock: 0
        },
        pools: [],
        residualHoldings: [],
        discardedSummary: {
          totalCount: 0,
          byReasonType: {}
        }
      };
    }

    const acceptedRunIds = acceptedRuns.map((run) => run.reconstructionRunId);

    const [records, sessionState, discardedItems, rawObservations] = await Promise.all([
      this.ledgerOutputRepository.listCanonicalLedgerRecordsByRuns(acceptedRunIds),
      this.analysisSessionStateRepository.findBySession(analysisSessionId),
      this.ledgerOutputRepository.listDiscardedActivityByRuns(acceptedRunIds),
      this.rawObservationRepository.listByRuns(acceptedRunIds)
    ]);
    const semanticEntries: Array<[string, NonNullable<ReturnType<typeof getSemanticFromObservation>>]> = [];
    for (const observation of rawObservations) {
      const txHash = observation.txHash ?? "";
      const semantic = getSemanticFromObservation(observation);
      if (txHash.length > 0 && semantic) {
        semanticEntries.push([txHash, semantic]);
      }
    }
    const semanticByTxHash = new Map(semanticEntries);

    const pools = new Map<
      string,
      {
        poolId: string;
        displayName: string;
        poolAddress: string;
        strategies: Map<
          string,
          {
            strategyId: string;
            strategyType: "manual" | "mellow_auto";
            sourceContractAddress: string | null;
            positions: Map<
              string,
              {
                positionInstanceId: string;
                positionType: "manual_cl" | "mellow_exposure";
                identityReference: string;
                ledgerRecords: Array<{ ledgerRecordId: string; eventType: string; txHash: string; timestamp: string }>;
              }
            >;
          }
        >;
      }
    >();

    for (const record of records) {
      if (!record.poolId || !record.strategyId || !record.positionInstanceId) {
        continue;
      }

      const poolEntry = pools.get(record.poolId) ?? {
        poolId: record.poolId,
        displayName: semanticByTxHash.get(record.txHash)?.pool?.displayName ?? record.poolId,
        poolAddress: semanticByTxHash.get(record.txHash)?.pool?.address ?? record.poolId,
        strategies: new Map()
      };

      const strategyType = record.eventType.startsWith("mellow_") ? "mellow_auto" : "manual";
      const semantic = semanticByTxHash.get(record.txHash);
      const strategyEntry = poolEntry.strategies.get(record.strategyId) ?? {
        strategyId: record.strategyId,
        strategyType,
        sourceContractAddress: semantic?.sourceContractAddress ?? null,
        positions: new Map()
      };

      const identityReference =
        semantic?.tokenId ??
        semantic?.wrapperAddress ??
        semantic?.stakingRewardsAddress ??
        record.positionInstanceId.split(":").at(-1) ??
        record.positionInstanceId;
      const positionEntry = strategyEntry.positions.get(record.positionInstanceId) ?? {
        positionInstanceId: record.positionInstanceId,
        positionType: strategyType === "manual" ? "manual_cl" : "mellow_exposure",
        identityReference,
        ledgerRecords: []
      };

      positionEntry.ledgerRecords.push({
        ledgerRecordId: record.ledgerRecordId,
        eventType: record.eventType,
        txHash: record.txHash,
        timestamp: record.timestamp.toISOString()
      });

      strategyEntry.positions.set(record.positionInstanceId, positionEntry);
      poolEntry.strategies.set(record.strategyId, strategyEntry);
      pools.set(record.poolId, poolEntry);
    }

    return {
      contractVersion: CONTRACT_VERSION,
      classifierVersion: latestAcceptedRun.classifierVersion,
      heuristicsVersion: latestAcceptedRun.heuristicsVersion,
      sourceBlockRange: {
        fromBlock: Number(acceptedRuns[0]?.fromBlock ?? 0n),
        toBlock: Number(latestAcceptedRun.checkpointBlock ?? latestAcceptedRun.toBlock ?? 0n)
      },
      pools: [...pools.values()].map((pool) => ({
        poolId: pool.poolId,
        displayName: pool.displayName,
        poolAddress: pool.poolAddress,
        strategies: [...pool.strategies.values()].map((strategy) => ({
          strategyId: strategy.strategyId,
          strategyType: strategy.strategyType,
          sourceContractAddress: strategy.sourceContractAddress,
          positions: [...strategy.positions.values()].map((position) => ({
            positionInstanceId: position.positionInstanceId,
            positionType: position.positionType,
            status: this.positionProjectionService.buildPositionStatus(
              position.ledgerRecords.map((ledgerRecord) => ({
                positionInstanceId: position.positionInstanceId,
                eventType: ledgerRecord.eventType,
                txHash: ledgerRecord.txHash,
                timestamp: new Date(ledgerRecord.timestamp)
              }))
            ),
            identityReference: position.identityReference,
            ledgerRecords: position.ledgerRecords
          }))
        }))
      })),
      residualHoldings: (sessionState?.residualHoldings ?? []).map((holding) => ({
        residualHoldingId: holding.residualHoldingId,
        tokenAddress: holding.tokenAddress,
        symbol: holding.symbol,
        amountRaw: holding.amountRaw,
        attributionConfidence: Number(holding.attributionConfidence),
        candidatePoolIds: holding.candidatePoolIds,
        reasonCode: holding.reasonCode
      })),
      discardedSummary: {
        totalCount: discardedItems.length,
        byReasonType: discardedItems.reduce<Record<string, number>>((accumulator, item) => {
          accumulator[item.reasonType] = (accumulator[item.reasonType] ?? 0) + 1;
          return accumulator;
        }, {})
      }
    };
  }

  async getLedgerRecordDetail(analysisSessionId: string, ledgerRecordId: string) {
    const { session, latestAcceptedRun } = await this.resolveAcceptedRuns(analysisSessionId);

    if (!session || !latestAcceptedRun) {
      throw new Error("No accepted reconstruction run is available for this session.");
    }

    const record = await this.ledgerOutputRepository.findCanonicalLedgerRecord(ledgerRecordId);
    if (!record) {
      throw new Error("Ledger record not found.");
    }

    const [sources, assetMovements, rawObservations] = await Promise.all([
      this.ledgerOutputRepository.listLedgerRecordSources(ledgerRecordId),
      this.ledgerOutputRepository.listAssetMovements(ledgerRecordId),
      this.rawObservationRepository.listByRun(record.reconstructionRunId)
    ]);

    const rawObservationById = new Map(
      rawObservations.map((observation) => [observation.rawObservationId, observation])
    );

    return {
      contractVersion: CONTRACT_VERSION,
      record: {
        ledgerRecordId: record.ledgerRecordId,
        poolId: record.poolId,
        strategyId: record.strategyId,
        positionInstanceId: record.positionInstanceId,
        eventType: record.eventType,
        txHash: record.txHash,
        blockNumber: Number(record.blockNumber),
        timestamp: record.timestamp.toISOString(),
        explanation: record.explanation,
        sourceObservations: sources.map((source) => ({
          rawObservationId: source.rawObservationId,
          sourceType: rawObservationById.get(source.rawObservationId)?.sourceType ?? "transaction",
          role: source.sourceRole
        })),
        assetMovements: assetMovements.map((movement) => ({
          assetMovementId: movement.assetMovementId,
          tokenAddress: movement.tokenAddress,
          symbol: movement.symbol,
          amountRaw: movement.amountRaw,
          direction: movement.direction,
          movementRole: movement.movementRole
        }))
      }
    };
  }

  async listDiscardedActivity(analysisSessionId: string) {
    const { session, acceptedRuns, latestAcceptedRun } = await this.resolveAcceptedRuns(analysisSessionId);

    if (!session || !latestAcceptedRun) {
      return {
        contractVersion: CONTRACT_VERSION,
        items: []
      };
    }

    const items = await this.ledgerOutputRepository.listDiscardedActivityByRuns(
      acceptedRuns.map((run) => run.reconstructionRunId)
    );
    return {
      contractVersion: CONTRACT_VERSION,
      items: items.map((item) => ({
        discardedActivityId: item.discardedActivityId,
        txHash: item.txHash,
        blockNumber: Number(item.blockNumber),
        timestamp: item.timestamp.toISOString(),
        reasonType: item.reasonType,
        reasonCode: item.reasonCode,
        reasonMessage: item.reasonMessage,
        classifierVersion: item.classifierVersion,
        heuristicsVersion: item.heuristicsVersion,
        sourceObservationIds: item.sourceObservationIds
      }))
    };
  }
}