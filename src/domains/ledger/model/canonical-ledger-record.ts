export type CanonicalEventType =
  | "external_deposit"
  | "external_withdrawal"
  | "manual_position_opened"
  | "manual_liquidity_added"
  | "manual_liquidity_removed"
  | "manual_fees_collected"
  | "manual_position_closed"
  | "mellow_exposure_opened"
  | "mellow_exposure_increased"
  | "mellow_exposure_decreased"
  | "mellow_reward_claimed"
  | "swap"
  | "residual_balance_update";

export type CanonicalLedgerRecord = {
  ledgerRecordId: string;
  reconstructionRunId: string;
  analysisSessionId: string;
  poolId: string | null;
  strategyId: string | null;
  positionInstanceId: string | null;
  eventType: CanonicalEventType;
  eventSequence: number;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  classificationConfidence: string;
  classifierVersion: string;
  heuristicsVersion: string;
  explanation: string;
};

export type LedgerRecordSourceRole =
  | "primary_call"
  | "supporting_log"
  | "trace_validation"
  | "transfer_evidence";

export type LedgerRecordSource = {
  ledgerRecordId: string;
  rawObservationId: string;
  sourceRole: LedgerRecordSourceRole;
};

export type AssetMovementDirection = "in" | "out" | "internal";
export type AssetMovementRole = "principal" | "reward" | "fee" | "swap_leg" | "residual_change";

export type AssetMovement = {
  assetMovementId: string;
  ledgerRecordId: string;
  tokenAddress: string;
  symbol: string | null;
  amountRaw: string;
  decimals: number;
  direction: AssetMovementDirection;
  movementRole: AssetMovementRole;
};