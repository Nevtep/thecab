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

export const accountingErrorResponseSchema = z.object({
  error: z.string().min(1)
});

export type AccountingResponse = z.infer<typeof accountingResponseSchema>;