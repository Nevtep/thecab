import { createHash } from "node:crypto";

function buildId(prefix: string, values: Array<string | number | bigint | Date | null | undefined>) {
  const payload = values
    .map((value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }

      return value == null ? "" : String(value);
    })
    .join("|");

  const digest = createHash("sha256").update(`${prefix}:${payload}`).digest("hex");
  return `${prefix}_${digest.slice(0, 24)}`;
}

export function buildAnalysisSessionId(chainId: number, walletAddress: string) {
  return buildId("session", [chainId, walletAddress.toLowerCase()]);
}

export function buildReconstructionRunId(input: {
  analysisSessionId: string;
  startedAt: Date;
  classifierVersion: string;
  heuristicsVersion: string;
  fromBlock: bigint | null;
  toBlock: bigint | null;
}) {
  return buildId("run", [
    input.analysisSessionId,
    input.startedAt,
    input.classifierVersion,
    input.heuristicsVersion,
    input.fromBlock,
    input.toBlock
  ]);
}

export function buildRawObservationId(input: {
  sourceType: string;
  chainId: number;
  txHash?: string | null;
  logIndex?: number | null;
  tracePath?: string | null;
}) {
  return buildId("raw", [input.sourceType, input.chainId, input.txHash, input.logIndex, input.tracePath]);
}

export function buildPoolId(chainId: number, protocolFamily: string, poolAddress: string) {
  return buildId("pool", [chainId, protocolFamily, poolAddress.toLowerCase()]);
}

export function buildStrategyId(poolId: string, strategyType: string, sourceContractAddress: string | null) {
  return buildId("strategy", [poolId, strategyType, sourceContractAddress?.toLowerCase()]);
}

export function buildPositionInstanceId(strategyId: string, identityReference: string | number | bigint) {
  return buildId("position", [strategyId, identityReference]);
}

export function buildLedgerRecordId(reconstructionRunId: string, txHash: string, ordinal: number) {
  return buildId("ledger", [reconstructionRunId, txHash.toLowerCase(), ordinal]);
}

export function buildAssetMovementId(
  ledgerRecordId: string,
  tokenAddress: string,
  ordinal: number
) {
  return buildId("movement", [ledgerRecordId, tokenAddress.toLowerCase(), ordinal]);
}

export function buildResidualHoldingId(
  reconstructionRunId: string,
  tokenAddress: string,
  candidateContext: string
) {
  return buildId("residual", [reconstructionRunId, tokenAddress.toLowerCase(), candidateContext]);
}

export function buildDiscardedActivityId(reconstructionRunId: string, txHash: string, ordinal: number) {
  return buildId("discarded", [reconstructionRunId, txHash.toLowerCase(), ordinal]);
}