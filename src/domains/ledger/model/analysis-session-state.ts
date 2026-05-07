import { type MellowPositionState } from "@/domains/ledger/classifiers/classification-engine";
import { type ManualPositionState } from "@/domains/protocols/aerodrome/manual-position-lifecycle-service";
import { type ResidualReasonCode } from "@/domains/residual-holdings/model/residual-holding";

export type ResidualHoldingSnapshot = {
  residualHoldingId: string;
  tokenAddress: string;
  symbol: string | null;
  amountRaw: string;
  decimals: number;
  attributionConfidence: string;
  candidatePoolIds: string[];
  latestSourceLedgerRecordId: string | null;
  reasonCode: ResidualReasonCode;
};

export type AnalysisSessionStateSnapshot = {
  analysisSessionId: string;
  latestAcceptedRunId: string | null;
  manualPositions: ManualPositionState[];
  mellowPositions: MellowPositionState[];
  poolAddressToId: Array<{ poolAddress: string; poolId: string }>;
  residualHoldings: ResidualHoldingSnapshot[];
  updatedAt: Date;
};