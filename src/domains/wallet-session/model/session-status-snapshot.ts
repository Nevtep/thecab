import { type ReconstructionRunMode, type ReconstructionRunStatus } from "@/domains/ledger/model/reconstruction-run";
import { type WalletAnalysisSessionStatus } from "@/domains/wallet-session/model/analysis-session";

export type ReconstructionRunSnapshot = {
  reconstructionRunId: string;
  sessionId: string;
  runMode: ReconstructionRunMode;
  status: ReconstructionRunStatus;
  classifierVersion: string;
  heuristicsVersion: string;
  fromBlock: bigint | null;
  toBlock: bigint | null;
  checkpointBlock: bigint | null;
  startedAt: Date;
  completedAt: Date | null;
  errorSummary: string | null;
};

export type SessionStatusSnapshot = {
  sessionId: string;
  walletAddress: string;
  chainId: number;
  sessionStatus: WalletAnalysisSessionStatus;
  reusedSession: boolean;
  latestAcceptedRun: ReconstructionRunSnapshot | null;
  latestRun: ReconstructionRunSnapshot | null;
  lastFailure: ReconstructionRunSnapshot | null;
  hasAcceptedProjection: boolean;
};