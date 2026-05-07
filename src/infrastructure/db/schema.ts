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

export const analysisSessionStates = pgTable(
  "analysis_session_states",
  {
    analysisSessionId: text("analysis_session_id")
      .primaryKey()
      .references(() => analysisSessions.analysisSessionId),
    latestAcceptedRunId: text("latest_accepted_run_id"),
    manualPositionsJson: jsonb("manual_positions_json").$type<unknown[]>().notNull(),
    mellowPositionsJson: jsonb("mellow_positions_json").$type<unknown[]>().notNull(),
    poolAddressToIdJson: jsonb("pool_address_to_id_json").$type<unknown[]>().notNull(),
    residualHoldingsJson: jsonb("residual_holdings_json").$type<unknown[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    latestAcceptedRunIdx: index("analysis_session_states_latest_run_idx").on(table.latestAcceptedRunId)
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

export const walletDiscoveryCheckpoints = pgTable(
  "wallet_discovery_checkpoints",
  {
    walletAddress: text("wallet_address").notNull(),
    chainId: integer("chain_id").notNull(),
    providerKey: text("provider_key").notNull(),
    latestIndexedBlock: bigint("latest_indexed_block", { mode: "bigint" }),
    latestHydratedBlock: bigint("latest_hydrated_block", { mode: "bigint" }),
    latestAcceptedBlock: bigint("latest_accepted_block", { mode: "bigint" }),
    providerCursor: text("provider_cursor"),
    providerStates: jsonb("provider_states").$type<Record<string, { cursor: string | null; updatedAt: string }>>(),
    pendingReconstructionRunId: text("pending_reconstruction_run_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.walletAddress, table.chainId] }),
    latestAcceptedBlockIdx: index("wallet_discovery_checkpoints_latest_accepted_block_idx").on(
      table.chainId,
      table.latestAcceptedBlock
    ),
    pendingRunIdx: index("wallet_discovery_checkpoints_pending_run_idx").on(
      table.pendingReconstructionRunId
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

export const discoveredActivities = pgTable(
  "discovered_activities",
  {
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    txHash: text("tx_hash").notNull(),
    providerKey: text("provider_key").notNull(),
    providerCursor: text("provider_cursor"),
    blockNumberHint: bigint("block_number_hint", { mode: "bigint" }),
    timestampHint: timestamp("timestamp_hint", { withTimezone: true }),
    hydrationStatus: text("hydration_status").notNull(),
    errorSummary: text("error_summary"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
    hydratedAt: timestamp("hydrated_at", { withTimezone: true })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reconstructionRunId, table.txHash] }),
    statusIdx: index("discovered_activities_status_idx").on(table.reconstructionRunId, table.hydrationStatus),
    providerIdx: index("discovered_activities_provider_idx").on(table.providerKey, table.discoveredAt)
  })
);

export const hydrationJobStates = pgTable(
  "hydration_job_states",
  {
    reconstructionRunId: text("reconstruction_run_id")
      .references(() => reconstructionRuns.reconstructionRunId)
      .notNull(),
    txHash: text("tx_hash").notNull(),
    jobStatus: text("job_status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    leaseOwner: text("lease_owner"),
    leasedAt: timestamp("leased_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reconstructionRunId, table.txHash] }),
    runStatusIdx: index("hydration_job_states_run_status_idx").on(
      table.reconstructionRunId,
      table.jobStatus,
      table.nextRetryAt
    ),
    leaseIdx: index("hydration_job_states_lease_idx").on(table.leaseOwner, table.leasedAt)
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

export const priceAssets = pgTable(
  "price_assets",
  {
    priceAssetId: text("price_asset_id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    symbol: text("symbol"),
    decimals: integer("decimals"),
    providerAssetKey: text("provider_asset_key"),
    aliasTargetAssetId: text("alias_target_asset_id"),
    pricingStatus: text("pricing_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    chainTokenIdx: index("price_assets_chain_token_idx").on(table.chainId, table.tokenAddress)
  })
);

export const pricePoints = pgTable(
  "price_points",
  {
    pricePointId: text("price_point_id").primaryKey(),
    priceAssetId: text("price_asset_id")
      .references(() => priceAssets.priceAssetId)
      .notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    sourceKind: text("source_kind").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    priceValue: numeric("price_value", { precision: 36, scale: 18 }).notNull(),
    resolution: text("resolution").notNull(),
    confidence: text("confidence").notNull(),
    pricingMethod: text("pricing_method").notNull(),
    providerName: text("provider_name").notNull(),
    providerReference: text("provider_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    assetEffectiveIdx: index("price_points_asset_effective_idx").on(
      table.priceAssetId,
      table.effectiveAt
    ),
    assetFetchedIdx: index("price_points_asset_fetched_idx").on(table.priceAssetId, table.fetchedAt),
    assetSourceEffectiveIdx: index("price_points_asset_source_effective_idx").on(
      table.priceAssetId,
      table.sourceKind,
      table.effectiveAt,
      table.pricingMethod
    )
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

export const priceAssetsRelations = relations(priceAssets, ({ many }) => ({
  pricePoints: many(pricePoints)
}));

export const pricePointsRelations = relations(pricePoints, ({ one }) => ({
  priceAsset: one(priceAssets, {
    fields: [pricePoints.priceAssetId],
    references: [priceAssets.priceAssetId]
  })
}));