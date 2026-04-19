import { classifyExternalTransfer } from "@/domains/ledger/classifiers/external-transfer-classifier";
import { getCurrentRulesetMetadata } from "@/domains/ledger/heuristics/registry";
import { buildLedgerRecordId } from "@/domains/ledger/model/ids";
import { type PositionIdentity } from "@/domains/ledger/model/position-instance";
import { DISCARDED_REASON_CODES } from "@/domains/ledger/model/discarded-reasons";
import { classifyAerodromeEventType } from "@/domains/protocols/aerodrome/aerodrome-classifier";
import { ManualPositionLifecycleService, type ManualPositionState } from "@/domains/protocols/aerodrome/manual-position-lifecycle-service";
import { classifyMellowEventType } from "@/domains/protocols/mellow/mellow-classifier";
import { PoolAssignmentService } from "@/domains/ledger/services/pool-assignment-service";
import { type FixtureObservation, getSemanticFromObservation } from "@/lib/fixture-loader";

type MellowPositionState = {
  positionInstanceId: string;
  identityReference: string;
  shareBalanceRaw: string | null;
  status: "open" | "partially_reduced" | "closed";
};

export type ClassificationState = {
  manualPositions: Map<string, ManualPositionState>;
  mellowPositions: Map<string, MellowPositionState>;
  poolAddressToId: Map<string, string>;
};

export type ClassifiedTransaction = {
  record:
    | {
        ledgerRecordId: string;
        reconstructionRunId: string;
        analysisSessionId: string;
        poolId: string | null;
        strategyId: string | null;
        positionInstanceId: string | null;
        eventType: string;
        eventSequence: number;
        txHash: string;
        blockNumber: bigint;
        timestamp: Date;
        classificationConfidence: string;
        classifierVersion: string;
        heuristicsVersion: string;
        explanation: string;
      }
    | null;
  positionIdentity: PositionIdentity | null;
  sourceRoles: Array<{ rawObservationId: string; role: "primary_call" | "supporting_log" | "trace_validation" | "transfer_evidence" }>;
  semantic: ReturnType<typeof getSemanticFromObservation>;
};

export class ClassificationEngine {
  private readonly poolAssignmentService = new PoolAssignmentService();
  private readonly manualLifecycleService = new ManualPositionLifecycleService();

  classifyTransaction(input: {
    reconstructionRunId: string;
    analysisSessionId: string;
    observations: FixtureObservation[];
    eventSequence: number;
    state: ClassificationState;
  }): ClassifiedTransaction {
    const semantic = input.observations
      .map((observation) => getSemanticFromObservation(observation))
      .find((candidate) => candidate != null) ?? null;
    const ruleset = getCurrentRulesetMetadata();
    const txHash = input.observations.find((observation) => observation.txHash)?.txHash ?? "0x";
    const blockNumber = BigInt(input.observations.find((observation) => observation.blockNumber != null)?.blockNumber ?? 0);
    const timestamp = new Date(
      String(
        input.observations.find((observation) => {
          const payload = observation.payloadJson as { timestamp?: string };
          return typeof payload.timestamp === "string";
        })
          ? (input.observations.find((observation) => {
              const payload = observation.payloadJson as { timestamp?: string };
              return typeof payload.timestamp === "string";
            })?.payloadJson as { timestamp: string }).timestamp
          : new Date(0).toISOString()
      )
    );

    const sourceRoles = input.observations.map((observation) => ({
      rawObservationId: observation.rawObservationId,
      role:
        observation.sourceType === "transaction"
          ? ("primary_call" as const)
          : observation.sourceType === "trace_frame"
            ? ("trace_validation" as const)
            : observation.sourceType === "log"
              ? ("supporting_log" as const)
              : ("transfer_evidence" as const)
    }));

    if (!semantic) {
      return {
        record: null,
        positionIdentity: null,
        semantic: {
          protocol: "unsupported",
          action: "unsupported",
          discarded: {
            reasonType: "invalid",
            reasonCode: DISCARDED_REASON_CODES.invalidObservation,
            reasonMessage: "No semantic fixture metadata was found for this transaction."
          }
        },
        sourceRoles
      };
    }

    const externalEventType = classifyExternalTransfer(semantic);
    const aerodromeEventType = semantic.protocol === "aerodrome" ? classifyAerodromeEventType(semantic) : null;
    const mellowEventType = semantic.protocol === "mellow" ? classifyMellowEventType(semantic) : null;
    const eventType = externalEventType ?? aerodromeEventType ?? mellowEventType;

    if (!eventType) {
      return {
        record: null,
        positionIdentity: null,
        semantic: {
          ...semantic,
          discarded: semantic.discarded ?? {
            reasonType: "unsupported",
            reasonCode: DISCARDED_REASON_CODES.unsupportedAction,
            reasonMessage: "The transaction uses an unsupported protocol action."
          }
        },
        sourceRoles
      };
    }

    const { pool, strategy } = this.poolAssignmentService.assign({
      chainId: semantic.pool ? input.observations[0]?.chainId ?? 8453 : 8453,
      semantic
    });

    if (pool) {
      input.state.poolAddressToId.set(pool.poolAddress.toLowerCase(), pool.poolId);
    }

    let positionIdentity: PositionIdentity | null = null;

    if (semantic.protocol === "aerodrome" && strategy) {
      const manualPosition = this.manualLifecycleService.resolve({
        semantic,
        strategyId: strategy.strategyId,
        state: input.state.manualPositions
      });

      if (manualPosition) {
        positionIdentity = {
          identityReference: manualPosition.identityReference,
          positionInstanceId: manualPosition.positionInstanceId,
          strategyId: strategy.strategyId,
          positionType: "manual_cl"
        };
      }
    }

    if (semantic.protocol === "mellow" && strategy) {
      const identityReference = semantic.wrapperAddress ?? semantic.stakingRewardsAddress ?? strategy.strategyId;
      const existing = input.state.mellowPositions.get(identityReference);
      const positionInstanceId = existing?.positionInstanceId ?? `${strategy.strategyId}:${identityReference}`;
      const nextStatus = semantic.action === "unstakeAndWithdraw" ? "partially_reduced" : "open";
      const nextState: MellowPositionState = {
        positionInstanceId,
        identityReference,
        shareBalanceRaw: semantic.shareBalanceRaw ?? null,
        status: nextStatus
      };
      input.state.mellowPositions.set(identityReference, nextState);
      positionIdentity = {
        identityReference,
        positionInstanceId,
        strategyId: strategy.strategyId,
        positionType: "mellow_exposure"
      };
    }

    return {
      record: {
        ledgerRecordId: buildLedgerRecordId(input.reconstructionRunId, txHash, input.eventSequence),
        reconstructionRunId: input.reconstructionRunId,
        analysisSessionId: input.analysisSessionId,
        poolId: pool?.poolId ?? null,
        strategyId: strategy?.strategyId ?? null,
        positionInstanceId: positionIdentity?.positionInstanceId ?? null,
        eventType,
        eventSequence: input.eventSequence,
        txHash,
        blockNumber,
        timestamp,
        classificationConfidence: (semantic.classificationConfidence ?? 1).toFixed(4),
        classifierVersion: ruleset.classifierVersion,
        heuristicsVersion: ruleset.heuristicsVersion,
        explanation:
          semantic.explanation ??
          `Classified ${semantic.protocol} ${semantic.action} from deterministic fixture semantics.`
      },
      positionIdentity,
      semantic,
      sourceRoles
    };
  }
}