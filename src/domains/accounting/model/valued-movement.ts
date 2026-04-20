import { type PriceCoverageDecision } from "@/domains/pricing/model/price-point";

export type ValuedMovement = {
  assetMovementId: string;
  ledgerRecordId: string;
  txHash: string;
  timestamp: Date;
  eventType: string;
  poolId: string | null;
  strategyId: string | null;
  positionInstanceId: string | null;
  tokenAddress: string;
  symbol: string | null;
  amountRaw: string;
  decimals: number;
  amount: string;
  direction: "in" | "out";
  movementRole: string;
  priceAssetId: string;
  pricePointId: string | null;
  priceUsd: string | null;
  eventValueUsd: string | null;
  coverage: PriceCoverageDecision;
};

export type CurrentHoldingValuation = {
  holdingType: "position" | "idle_balance" | "residual_holding";
  subjectId: string;
  poolId: string | null;
  strategyId: string | null;
  positionInstanceId: string | null;
  tokenAddress: string;
  symbol: string | null;
  amount: string;
  costBasisUsd: string;
  currentValueUsd: string | null;
  pricePointId: string | null;
  coverage: PriceCoverageDecision;
  traceLedgerRecordIds: string[];
};