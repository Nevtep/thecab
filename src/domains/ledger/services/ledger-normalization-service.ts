import { AssetMovementService } from "@/domains/ledger/services/asset-movement-service";
import { ClassificationEngine, type ClassificationState } from "@/domains/ledger/classifiers/classification-engine";
import { DiscardedActivityService } from "@/domains/ledger/services/discarded-activity-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { type RawObservationRecord } from "@/domains/ledger/repositories/raw-observation-repository";
import { ResidualHoldingService } from "@/domains/residual-holdings/services/residual-holding-service";

export class LedgerNormalizationService {
  private readonly classificationEngine = new ClassificationEngine();
  private readonly assetMovementService = new AssetMovementService();
  private readonly residualHoldingService = new ResidualHoldingService();
  private readonly discardedActivityService = new DiscardedActivityService();

  constructor(private readonly ledgerOutputRepository: LedgerOutputRepository) {}

  async normalize(input: {
    reconstructionRunId: string;
    analysisSessionId: string;
    rawObservations: RawObservationRecord[];
  }) {
    const groups = new Map<string, RawObservationRecord[]>();
    for (const observation of input.rawObservations) {
      const txHash = observation.txHash ?? observation.rawObservationId;
      const items = groups.get(txHash) ?? [];
      items.push(observation);
      groups.set(txHash, items);
    }

    const orderedGroups = [...groups.entries()].sort((left, right) => {
      const leftBlock = left[1][0]?.blockNumber ?? 0n;
      const rightBlock = right[1][0]?.blockNumber ?? 0n;
      return leftBlock === rightBlock ? left[0].localeCompare(right[0]) : leftBlock < rightBlock ? -1 : 1;
    });

    const state: ClassificationState = {
      manualPositions: new Map(),
      mellowPositions: new Map(),
      poolAddressToId: new Map()
    };

    const records = [];
    const sources = [];
    const movements = [];
    const residuals = [];
    const discarded = [];

    let eventSequence = 0;
    for (const [, observations] of orderedGroups) {
      const classification = this.classificationEngine.classifyTransaction({
        reconstructionRunId: input.reconstructionRunId,
        analysisSessionId: input.analysisSessionId,
        observations: observations.map((observation) => ({
          rawObservationId: observation.rawObservationId,
          sourceType: observation.sourceType as
            | "block_header"
            | "transaction"
            | "receipt"
            | "log"
            | "trace_frame",
          chainId: observation.chainId,
          blockNumber: observation.blockNumber == null ? null : Number(observation.blockNumber),
          blockHash: observation.blockHash,
          txHash: observation.txHash,
          logIndex: observation.logIndex,
          tracePath: observation.tracePath,
          contractAddress: observation.contractAddress,
          payloadJson: observation.payloadJson as {
            semantic?: import("@/lib/fixture-loader").FixtureSemantic;
            [key: string]: unknown;
          }
        })),
        eventSequence,
        state
      });

      if (classification.record) {
        records.push(classification.record);
        sources.push(
          ...classification.sourceRoles.map((source) => ({
            ledgerRecordId: classification.record!.ledgerRecordId,
            rawObservationId: source.rawObservationId,
            sourceRole: source.role
          }))
        );

        if (classification.semantic) {
          movements.push(
            ...this.assetMovementService.build({
              ledgerRecordId: classification.record.ledgerRecordId,
              semantic: classification.semantic
            })
          );
          residuals.push(
            ...this.residualHoldingService.build({
              reconstructionRunId: input.reconstructionRunId,
              semantic: classification.semantic,
              poolAddressToId: state.poolAddressToId,
              latestSourceLedgerRecordId: classification.record.ledgerRecordId
            })
          );
        }
      } else {
        const sourceObservationIds = observations.map((observation) => observation.rawObservationId);
        discarded.push(
          this.discardedActivityService.build({
            reconstructionRunId: input.reconstructionRunId,
            analysisSessionId: input.analysisSessionId,
            classifierVersion: "2026-04-19.1",
            heuristicsVersion: "2026-04-19.1",
            txHash: observations[0]?.txHash ?? observations[0]?.rawObservationId ?? "0x",
            blockNumber: observations[0]?.blockNumber ?? 0n,
            timestamp: new Date(),
            ordinal: eventSequence,
            sourceObservationIds,
            semantic: classification.semantic
          })
        );
      }

      eventSequence += 1;
    }

    await this.ledgerOutputRepository.appendCanonicalLedgerRecords(records);
    await this.ledgerOutputRepository.appendLedgerRecordSources(sources);
    await this.ledgerOutputRepository.appendAssetMovements(movements);
    await this.ledgerOutputRepository.appendResidualHoldings(residuals);
    await this.ledgerOutputRepository.appendDiscardedActivity(discarded);

    return {
      records,
      sources,
      movements,
      residuals,
      discarded
    };
  }
}