import { buildDiscardedActivityId } from "@/domains/ledger/model/ids";
import {
  DISCARDED_REASON_CODES,
  type DiscardedReasonType
} from "@/domains/ledger/model/discarded-reasons";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export class DiscardedActivityService {
  build(input: {
    reconstructionRunId: string;
    analysisSessionId: string;
    classifierVersion: string;
    heuristicsVersion: string;
    txHash: string;
    blockNumber: bigint;
    timestamp: Date;
    ordinal: number;
    sourceObservationIds: string[];
    semantic: FixtureSemantic | null;
  }) {
    const discarded = input.semantic?.discarded;
    const reasonType: DiscardedReasonType = discarded?.reasonType ?? "invalid";
    const reasonCode = discarded?.reasonCode ?? DISCARDED_REASON_CODES.invalidObservation;
    const reasonMessage = discarded?.reasonMessage ?? "The transaction could not be classified into the trusted ledger.";

    return {
      discardedActivityId: buildDiscardedActivityId(
        input.reconstructionRunId,
        input.txHash,
        input.ordinal
      ),
      reconstructionRunId: input.reconstructionRunId,
      analysisSessionId: input.analysisSessionId,
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      timestamp: input.timestamp,
      reasonType,
      reasonCode,
      reasonMessage,
      classifierVersion: input.classifierVersion,
      heuristicsVersion: input.heuristicsVersion,
      sourceObservationIds: input.sourceObservationIds
    };
  }
}