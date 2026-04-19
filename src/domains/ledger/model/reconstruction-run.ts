export type ReconstructionRunMode = "initial" | "incremental" | "replay";
export type ReconstructionRunStatus =
  | "pending"
  | "ingesting"
  | "normalizing"
  | "projecting"
  | "accepted"
  | "failed";

export type ReconstructionRun = {
  reconstructionRunId: string;
  analysisSessionId: string;
  runMode: ReconstructionRunMode;
  classifierVersion: string;
  heuristicsVersion: string;
  fromBlock: bigint | null;
  toBlock: bigint | null;
  checkpointBlock: bigint | null;
  startedAt: Date;
  completedAt: Date | null;
  status: ReconstructionRunStatus;
  errorSummary: string | null;
};

export type RawObservation = {
  rawObservationId: string;
  reconstructionRunId: string;
  sourceType: "block_header" | "transaction" | "receipt" | "log" | "trace_frame";
  chainId: number;
  blockNumber: bigint | null;
  blockHash: string | null;
  txHash: string | null;
  logIndex: number | null;
  tracePath: string | null;
  contractAddress: string | null;
  payloadJson: unknown;
  payloadHash: string;
  ingestedAt: Date;
};