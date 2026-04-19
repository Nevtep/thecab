import { z } from "zod";

export const createAnalysisSessionRequestSchema = z.object({
  walletAddress: z.string().min(1),
  chainId: z.literal(8453),
  connectionSource: z.string().default("walletconnect")
});

export const analysisSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: z.string().min(1),
  chainId: z.number().int(),
  status: z.enum(["active", "archived", "failed"]),
  reusedSession: z.boolean(),
  latestAcceptedRunId: z.string().min(1).nullable()
});

export const startReconstructionRequestSchema = z.object({
  fromBlock: z.coerce.bigint().nonnegative().optional(),
  toBlock: z.coerce.bigint().nonnegative().optional(),
  mode: z.enum(["initial", "incremental", "replay"]).default("initial")
});

export const reconstructionRunResponseSchema = z.object({
  reconstructionRunId: z.string().min(1),
  sessionId: z.string().min(1),
  runMode: z.enum(["initial", "incremental", "replay"]),
  status: z.enum(["pending", "ingesting", "normalizing", "projecting", "accepted", "failed"]),
  classifierVersion: z.string().min(1),
  heuristicsVersion: z.string().min(1),
  fromBlock: z.number().int().nullable(),
  toBlock: z.number().int().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  errorSummary: z.string().min(1).nullable()
});

export const sessionStatusResponseSchema = z.object({
  session: analysisSessionResponseSchema,
  latestAcceptedRun: reconstructionRunResponseSchema.nullable(),
  latestRun: reconstructionRunResponseSchema.nullable(),
  hasAcceptedProjection: z.boolean()
});

export const ledgerRecordSummarySchema = z.object({
  ledgerRecordId: z.string().min(1),
  eventType: z.string().min(1),
  txHash: z.string().min(1),
  timestamp: z.string().datetime()
});

export const positionLifecycleSchema = z.object({
  positionInstanceId: z.string().min(1),
  positionType: z.enum(["manual_cl", "mellow_exposure"]),
  status: z.enum(["open", "partially_reduced", "closed", "burned", "archived"]),
  identityReference: z.string().min(1),
  ledgerRecords: z.array(ledgerRecordSummarySchema)
});

export const strategyLedgerSchema = z.object({
  strategyId: z.string().min(1),
  strategyType: z.enum(["manual", "mellow_auto"]),
  sourceContractAddress: z.string().min(1).nullable(),
  positions: z.array(positionLifecycleSchema)
});

export const poolLedgerSchema = z.object({
  poolId: z.string().min(1),
  displayName: z.string().min(1),
  poolAddress: z.string().min(1),
  strategies: z.array(strategyLedgerSchema)
});

export const residualHoldingSchema = z.object({
  residualHoldingId: z.string().min(1),
  tokenAddress: z.string().min(1),
  symbol: z.string().min(1).nullable(),
  amountRaw: z.string().min(1),
  attributionConfidence: z.number(),
  candidatePoolIds: z.array(z.string().min(1)),
  reasonCode: z.enum([
    "idle_wallet_balance",
    "rebalance_leftover",
    "unallocated_close_proceeds",
    "low_confidence_attribution"
  ])
});

export const discardedSummarySchema = z.object({
  totalCount: z.number().int().nonnegative(),
  byReasonType: z.record(z.string(), z.number().int().nonnegative())
});

export const ledgerProjectionResponseSchema = z.object({
  contractVersion: z.string().min(1),
  classifierVersion: z.string().min(1),
  heuristicsVersion: z.string().min(1),
  sourceBlockRange: z.object({
    fromBlock: z.number().int().nonnegative(),
    toBlock: z.number().int().nonnegative()
  }),
  pools: z.array(poolLedgerSchema),
  residualHoldings: z.array(residualHoldingSchema),
  discardedSummary: discardedSummarySchema
});

export const sourceObservationRefSchema = z.object({
  rawObservationId: z.string().min(1),
  sourceType: z.enum(["block_header", "transaction", "receipt", "log", "trace_frame"]),
  role: z.enum(["primary_call", "supporting_log", "trace_validation", "transfer_evidence"])
});

export const assetMovementResponseSchema = z.object({
  assetMovementId: z.string().min(1),
  tokenAddress: z.string().min(1),
  symbol: z.string().nullable().optional(),
  amountRaw: z.string().min(1),
  direction: z.enum(["in", "out", "internal"]),
  movementRole: z.enum(["principal", "reward", "fee", "swap_leg", "residual_change"])
});

export const ledgerRecordDetailResponseSchema = z.object({
  contractVersion: z.string().min(1),
  record: z.object({
    ledgerRecordId: z.string().min(1),
    poolId: z.string().min(1).nullable(),
    strategyId: z.string().min(1).nullable(),
    positionInstanceId: z.string().min(1).nullable(),
    eventType: z.string().min(1),
    txHash: z.string().min(1),
    blockNumber: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    explanation: z.string().min(1),
    sourceObservations: z.array(sourceObservationRefSchema),
    assetMovements: z.array(assetMovementResponseSchema)
  })
});

export const discardedActivityListResponseSchema = z.object({
  contractVersion: z.string().min(1),
  items: z.array(
    z.object({
      discardedActivityId: z.string().min(1),
      txHash: z.string().min(1),
      blockNumber: z.number().int().nonnegative(),
      timestamp: z.string().datetime(),
      reasonType: z.enum(["unsupported", "malicious", "ambiguous", "invalid"]),
      reasonCode: z.string().min(1),
      reasonMessage: z.string().min(1),
      classifierVersion: z.string().min(1),
      heuristicsVersion: z.string().min(1),
      sourceObservationIds: z.array(z.string().min(1))
    })
  )
});

export const errorResponseSchema = z.object({
  error: z.string().min(1)
});

export type CreateAnalysisSessionRequest = z.infer<typeof createAnalysisSessionRequestSchema>;
export type AnalysisSessionResponse = z.infer<typeof analysisSessionResponseSchema>;
export type StartReconstructionRequest = z.infer<typeof startReconstructionRequestSchema>;
export type ReconstructionRunResponse = z.infer<typeof reconstructionRunResponseSchema>;
export type SessionStatusResponse = z.infer<typeof sessionStatusResponseSchema>;