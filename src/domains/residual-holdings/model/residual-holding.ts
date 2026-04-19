export type ResidualReasonCode =
  | "idle_wallet_balance"
  | "rebalance_leftover"
  | "unallocated_close_proceeds"
  | "low_confidence_attribution";

export type ResidualHolding = {
  residualHoldingId: string;
  reconstructionRunId: string;
  tokenAddress: string;
  symbol: string | null;
  amountRaw: string;
  decimals: number;
  attributionConfidence: string;
  candidatePoolIds: string[];
  latestSourceLedgerRecordId: string | null;
  reasonCode: ResidualReasonCode;
};

export type DiscardedActivity = {
  discardedActivityId: string;
  reconstructionRunId: string;
  analysisSessionId: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  reasonType: "unsupported" | "malicious" | "ambiguous" | "invalid";
  reasonCode: string;
  reasonMessage: string;
  classifierVersion: string;
  heuristicsVersion: string;
  sourceObservationIds: string[];
};