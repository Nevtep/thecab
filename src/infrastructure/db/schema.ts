import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp
} from "drizzle-orm/pg-core";

export const analysisSessions = pgTable(
  "analysis_sessions",
  {
    analysisSessionId: text("analysis_session_id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    chainId: integer("chain_id").notNull(),
    connectionSource: text("connection_source").notNull(),
    latestAcceptedRunId: text("latest_accepted_run_id"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastRequestedAt: timestamp("last_requested_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    walletChainIdx: index("analysis_sessions_wallet_chain_active_idx").on(
      table.walletAddress,
      table.chainId
    )
  })
);

export const reconstructionRuns = pgTable(
  "reconstruction_runs",
  {
    reconstructionRunId: text("reconstruction_run_id").primaryKey(),
    analysisSessionId: text("analysis_session_id")
      .references(() => analysisSessions.analysisSessionId)
      .notNull(),
    runMode: text("run_mode").notNull(),
    classifierVersion: text("classifier_version").notNull(),
    heuristicsVersion: text("heuristics_version").notNull(),
    fromBlock: bigint("from_block", { mode: "bigint" }),
    toBlock: bigint("to_block", { mode: "bigint" }),
    checkpointBlock: bigint("checkpoint_block", { mode: "bigint" }),
    status: text("status").notNull(),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => ({
    sessionIdx: index("reconstruction_runs_session_idx").on(
      table.analysisSessionId,
      table.startedAt
    )
  })
);

export const rawObservations = pgTable(
  "raw_observations",
  {
    rawObservationId: text("raw_observation_id").primaryKey(),
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    sourceType: text("source_type").notNull(),
    chainId: integer("chain_id").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    blockHash: text("block_hash"),
    txHash: text("tx_hash"),
    logIndex: integer("log_index"),
    tracePath: text("trace_path"),
    contractAddress: text("contract_address"),
    payloadJson: jsonb("payload_json").$type<unknown>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    runIdx: index("raw_observations_run_idx").on(table.reconstructionRunId, table.sourceType)
  })
);

export const canonicalLedgerRecords = pgTable(
  "canonical_ledger_records",
  {
    ledgerRecordId: text("ledger_record_id").primaryKey(),
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    analysisSessionId: text("analysis_session_id")
      .references(() => analysisSessions.analysisSessionId)
      .notNull(),
    poolId: text("pool_id"),
    strategyId: text("strategy_id"),
    positionInstanceId: text("position_instance_id"),
    eventType: text("event_type").notNull(),
    eventSequence: integer("event_sequence").notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    classificationConfidence: numeric("classification_confidence", {
      precision: 5,
      scale: 4
    }).notNull(),
    classifierVersion: text("classifier_version").notNull(),
    heuristicsVersion: text("heuristics_version").notNull(),
    explanation: text("explanation").notNull()
  },
  (table) => ({
    runIdx: index("canonical_ledger_records_run_idx").on(
      table.reconstructionRunId,
      table.txHash,
      table.eventSequence
    )
  })
);

export const ledgerRecordSources = pgTable(
  "ledger_record_sources",
  {
    ledgerRecordId: text("ledger_record_id")
      .references(() => canonicalLedgerRecords.ledgerRecordId)
      .notNull(),
    rawObservationId: text("raw_observation_id")
      .references(() => rawObservations.rawObservationId)
      .notNull(),
    sourceRole: text("source_role").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ledgerRecordId, table.rawObservationId] })
  })
);

export const assetMovements = pgTable(
  "asset_movements",
  {
    assetMovementId: text("asset_movement_id").primaryKey(),
    ledgerRecordId: text("ledger_record_id")
      .references(() => canonicalLedgerRecords.ledgerRecordId)
      .notNull(),
    tokenAddress: text("token_address").notNull(),
    symbol: text("symbol"),
    amountRaw: text("amount_raw").notNull(),
    decimals: integer("decimals").notNull(),
    direction: text("direction").notNull(),
    movementRole: text("movement_role").notNull()
  },
  (table) => ({
    recordIdx: index("asset_movements_record_idx").on(table.ledgerRecordId)
  })
);

export const residualHoldings = pgTable(
  "residual_holdings",
  {
    residualHoldingId: text("residual_holding_id").primaryKey(),
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    tokenAddress: text("token_address").notNull(),
    symbol: text("symbol"),
    amountRaw: text("amount_raw").notNull(),
    decimals: integer("decimals").notNull(),
    attributionConfidence: numeric("attribution_confidence", {
      precision: 5,
      scale: 4
    }).notNull(),
    candidatePoolIds: jsonb("candidate_pool_ids").$type<string[]>().notNull(),
    latestSourceLedgerRecordId: text("latest_source_ledger_record_id"),
    reasonCode: text("reason_code").notNull()
  },
  (table) => ({
    runIdx: index("residual_holdings_run_idx").on(table.reconstructionRunId, table.tokenAddress)
  })
);

export const discardedActivity = pgTable(
  "discarded_activity",
  {
    discardedActivityId: text("discarded_activity_id").primaryKey(),
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    analysisSessionId: text("analysis_session_id")
      .references(() => analysisSessions.analysisSessionId)
      .notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    reasonType: text("reason_type").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonMessage: text("reason_message").notNull(),
    classifierVersion: text("classifier_version").notNull(),
    heuristicsVersion: text("heuristics_version").notNull(),
    sourceObservationIds: jsonb("source_observation_ids").$type<string[]>().notNull()
  },
  (table) => ({
    runIdx: index("discarded_activity_run_idx").on(table.reconstructionRunId, table.txHash)
  })
);

export const analysisSessionsRelations = relations(analysisSessions, ({ many }) => ({
  reconstructionRuns: many(reconstructionRuns)
}));

export const reconstructionRunsRelations = relations(reconstructionRuns, ({ one, many }) => ({
  analysisSession: one(analysisSessions, {
    fields: [reconstructionRuns.analysisSessionId],
    references: [analysisSessions.analysisSessionId]
  }),
  rawObservations: many(rawObservations),
  canonicalLedgerRecords: many(canonicalLedgerRecords),
  residualHoldings: many(residualHoldings),
  discardedActivity: many(discardedActivity)
}));