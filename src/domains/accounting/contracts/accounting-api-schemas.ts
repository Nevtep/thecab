import { z } from "zod";

const moneyValueSchema = z.object({
  currency: z.literal("usd"),
  amount: z.string().min(1)
});

const coverageSummarySchema = z.object({
  coverageStatus: z.enum(["full", "partial"]),
  pricedValue: moneyValueSchema,
  excludedValue: moneyValueSchema.nullable(),
  unpricedComponentsCount: z.number().int().nonnegative(),
  reasonCodes: z.array(z.string().min(1))
});

const traceRefsSchema = z.object({
  ledgerRecordIds: z.array(z.string().min(1)),
  pricePointIds: z.array(z.string().min(1))
});

export const idleBalanceSummarySchema = z.object({
  tokenAddress: z.string().min(1),
  symbol: z.string().min(1).nullable(),
  amountRaw: z.string().min(1),
  currentValue: moneyValueSchema.nullable(),
  coverageStatus: z.enum(["priced", "partial", "unpriced"]),
  reasonCode: z.string().min(1),
  candidatePoolIds: z.array(z.string().min(1)),
  traceRefs: traceRefsSchema
});

export const positionAccountingSummarySchema = z.object({
  positionInstanceId: z.string().min(1),
  positionType: z.enum(["manual_cl", "mellow_exposure"]),
  currentValue: moneyValueSchema,
  capitalEntered: moneyValueSchema,
  capitalWithdrawn: moneyValueSchema,
  realizedPnl: moneyValueSchema,
  unrealizedPnl: moneyValueSchema,
  precisionStatus: z.enum(["exact", "rolled_up"]),
  coverageSummary: coverageSummarySchema,
  traceRefs: traceRefsSchema
});

export const strategyAccountingSummarySchema = z.object({
  strategyId: z.string().min(1),
  strategyType: z.enum(["manual", "mellow_auto"]),
  currentValue: moneyValueSchema,
  capitalEntered: moneyValueSchema,
  capitalWithdrawn: moneyValueSchema,
  realizedPnl: moneyValueSchema,
  unrealizedPnl: moneyValueSchema,
  coverageSummary: coverageSummarySchema,
  positions: z.array(positionAccountingSummarySchema),
  traceRefs: traceRefsSchema
});

export const poolAccountingSummarySchema = z.object({
  poolId: z.string().min(1),
  displayName: z.string().min(1),
  currentValue: moneyValueSchema,
  capitalEntered: moneyValueSchema,
  capitalWithdrawn: moneyValueSchema,
  realizedPnl: moneyValueSchema,
  unrealizedPnl: moneyValueSchema,
  coverageSummary: coverageSummarySchema,
  strategies: z.array(strategyAccountingSummarySchema),
  traceRefs: traceRefsSchema
});

export const accountingResponseSchema = z.object({
  contractVersion: z.string().min(1),
  sessionId: z.string().min(1),
  acceptedRunId: z.string().min(1),
  asOf: z.string().datetime(),
  quoteCurrency: z.literal("usd"),
  totalValue: moneyValueSchema,
  capitalEntered: moneyValueSchema,
  capitalWithdrawn: moneyValueSchema,
  realizedPnl: moneyValueSchema,
  unrealizedPnl: moneyValueSchema,
  idleBalanceValue: moneyValueSchema,
  coverageSummary: coverageSummarySchema,
  pools: z.array(poolAccountingSummarySchema),
  idleBalances: z.array(idleBalanceSummarySchema),
  traceRefs: traceRefsSchema
});

const bootstrapRunSummarySchema = z.object({
  reconstructionRunId: z.string().min(1),
  runMode: z.enum(["initial", "incremental", "replay"]),
  status: z.enum(["pending", "ingesting", "normalizing", "projecting", "accepted", "failed"]),
  fromBlock: z.number().int().nullable(),
  toBlock: z.number().int().nullable(),
  checkpointBlock: z.number().int().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  errorSummary: z.string().min(1).nullable()
});

export const accountingBootstrapResponseSchema = z.object({
  contractVersion: z.string().min(1),
  sessionId: z.string().min(1),
  walletAddress: z.string().min(1),
  chainId: z.number().int(),
  hasAcceptedSnapshot: z.boolean(),
  isReconstructionRunning: z.boolean(),
  bootstrapState: z.enum(["empty", "warming", "ready"]),
  snapshot: accountingResponseSchema.nullable(),
  latestRun: bootstrapRunSummarySchema.nullable()
});

const accountingEventMarkerSchema = z.object({
  ledgerRecordId: z.string().min(1),
  blockNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  markerType: z.enum(["claim", "lock", "vote", "rebalance", "withdraw", "deposit", "swap", "other"]),
  label: z.string().min(1)
});

const accountingPortfolioSeriesPointSchema = z.object({
  ledgerRecordId: z.string().min(1),
  blockNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  eventType: z.string().min(1),
  totalValue: moneyValueSchema.nullable()
});

const accountingPoolSeriesPointSchema = z.object({
  ledgerRecordId: z.string().min(1),
  blockNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  eventType: z.string().min(1),
  flowDirection: z.enum(["in", "out", "internal"])
});

const accountingPoolSeriesSchema = z.object({
  poolId: z.string().min(1),
  displayName: z.string().min(1),
  points: z.array(accountingPoolSeriesPointSchema)
});

export const accountingTimeSeriesResponseSchema = z.object({
  contractVersion: z.string().min(1),
  sessionId: z.string().min(1),
  acceptedRunId: z.string().min(1).nullable(),
  quoteCurrency: z.literal("usd"),
  portfolioSeries: z.array(accountingPortfolioSeriesPointSchema),
  poolSeries: z.array(accountingPoolSeriesSchema),
  eventMarkers: z.array(accountingEventMarkerSchema)
});

export const accountingRebalanceFlowsResponseSchema = z.object({
  contractVersion: z.string().min(1),
  sessionId: z.string().min(1),
  acceptedRunId: z.string().min(1).nullable(),
  flows: z.array(
    z.object({
      flowId: z.string().min(1),
      txHash: z.string().min(1),
      fromPoolId: z.string().min(1),
      toPoolId: z.string().min(1),
      fromEventType: z.string().min(1),
      toEventType: z.string().min(1),
      blockNumber: z.number().int().nonnegative(),
      timestamp: z.string().datetime(),
      confidence: z.enum(["heuristic", "high"]),
      explanation: z.string().min(1)
    })
  )
});

export const accountingErrorResponseSchema = z.object({
  error: z.string().min(1)
});

export type AccountingResponse = z.infer<typeof accountingResponseSchema>;
export type AccountingBootstrapResponse = z.infer<typeof accountingBootstrapResponseSchema>;
export type AccountingTimeSeriesResponse = z.infer<typeof accountingTimeSeriesResponseSchema>;
export type AccountingRebalanceFlowsResponse = z.infer<typeof accountingRebalanceFlowsResponseSchema>;