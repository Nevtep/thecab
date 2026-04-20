import { type AccountingCoverageSummary, type AccountingTraceRefs, type MoneyValue } from "@/domains/accounting/model/accounting-snapshot";

export type PositionAccountingSummary = {
  positionInstanceId: string;
  positionType: "manual_cl" | "mellow_exposure";
  currentValue: MoneyValue;
  capitalEntered: MoneyValue;
  capitalWithdrawn: MoneyValue;
  realizedPnl: MoneyValue;
  unrealizedPnl: MoneyValue;
  precisionStatus: "exact" | "rolled_up";
  coverageSummary: AccountingCoverageSummary;
  traceRefs: AccountingTraceRefs;
};

export type StrategyAccountingSummary = {
  strategyId: string;
  strategyType: "manual" | "mellow_auto";
  currentValue: MoneyValue;
  capitalEntered: MoneyValue;
  capitalWithdrawn: MoneyValue;
  realizedPnl: MoneyValue;
  unrealizedPnl: MoneyValue;
  coverageSummary: AccountingCoverageSummary;
  positions: PositionAccountingSummary[];
  traceRefs: AccountingTraceRefs;
};

export type PoolAccountingSummary = {
  poolId: string;
  displayName: string;
  currentValue: MoneyValue;
  capitalEntered: MoneyValue;
  capitalWithdrawn: MoneyValue;
  realizedPnl: MoneyValue;
  unrealizedPnl: MoneyValue;
  coverageSummary: AccountingCoverageSummary;
  strategies: StrategyAccountingSummary[];
  traceRefs: AccountingTraceRefs;
};