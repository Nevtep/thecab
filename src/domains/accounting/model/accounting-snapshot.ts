export type MoneyValue = {
  currency: "usd";
  amount: string;
};

export type AccountingCoverageStatus = "full" | "partial";

export type AccountingCoverageSummary = {
  coverageStatus: AccountingCoverageStatus;
  pricedValue: MoneyValue;
  excludedValue: MoneyValue | null;
  unpricedComponentsCount: number;
  reasonCodes: string[];
};

export type AccountingTraceRefs = {
  ledgerRecordIds: string[];
  pricePointIds: string[];
};

export type PortfolioAccountingSnapshot = {
  contractVersion: string;
  sessionId: string;
  acceptedRunId: string;
  asOf: string;
  quoteCurrency: "usd";
  totalValue: MoneyValue;
  capitalEntered: MoneyValue;
  capitalWithdrawn: MoneyValue;
  realizedPnl: MoneyValue;
  unrealizedPnl: MoneyValue;
  idleBalanceValue: MoneyValue;
  coverageSummary: AccountingCoverageSummary;
  pools: unknown[];
  idleBalances: unknown[];
  traceRefs: AccountingTraceRefs;
};