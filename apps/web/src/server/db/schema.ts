import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const now = () => new Date();

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    chainId: integer("chain_id").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    stage: varchar("stage", { length: 64 }).notNull().default("queued"),
    progressPct: integer("progress_pct").notNull().default(0),
    mode: varchar("mode", { length: 24 }).notNull().default("full_history"),
    triggeredAtUtc: timestamp("triggered_at_utc", { withTimezone: true }).defaultNow().notNull(),
    utcDayBucket: varchar("utc_day_bucket", { length: 10 }).notNull().default(sql`to_char(timezone('UTC', now()), 'YYYY-MM-DD')`),
    coverage: varchar("coverage", { length: 16 }).notNull().default("unknown"),
    coverageReasonsJson: jsonb("coverage_reasons_json")
      .$type<string[]>()
      .notNull()
      .default([]),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledReason: varchar("cancelled_reason", { length: 64 }),
    lastError: text("last_error"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("analysis_runs_wallet_idx").on(table.walletAddress, table.chainId),
    index("analysis_runs_wallet_day_idx").on(table.chainId, table.walletAddress, table.utcDayBucket),
    index("analysis_runs_status_idx").on(table.status),
    uniqueIndex("analysis_runs_completed_per_day_uidx")
      .on(table.chainId, table.walletAddress, table.utcDayBucket)
      .where(sql`${table.status} = 'complete'`),
  ],
);

export const analysisSlices = pgTable(
  "analysis_slices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    chainId: integer("chain_id").notNull(),
    sliceIndex: integer("slice_index").notNull(),
    sliceStartUtc: timestamp("slice_start_utc", { withTimezone: true }).notNull(),
    sliceEndUtc: timestamp("slice_end_utc", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    coverageReasonsJson: jsonb("coverage_reasons_json").$type<string[]>().notNull().default([]),
    providerAttemptsJson: jsonb("provider_attempts_json")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    txCountSeen: integer("tx_count_seen").notNull().default(0),
    txCountProcessed: integer("tx_count_processed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("analysis_slices_run_index_uidx").on(
      table.runId,
      table.sliceIndex,
    ),
    index("analysis_slices_window_idx").on(
      table.chainId,
      table.walletAddress,
      table.sliceStartUtc,
      table.sliceEndUtc,
    ),
    index("analysis_slices_run_idx").on(table.runId, table.sliceIndex),
    index("analysis_slices_status_idx").on(table.status),
  ],
);

export const processingCursors = pgTable(
  "processing_cursors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    chainId: integer("chain_id").notNull(),
    lastProcessedDayUtc: varchar("last_processed_day_utc", { length: 10 }),
    lastProcessedBlockNumber: numeric("last_processed_block_number", { precision: 38, scale: 0 }),
    lastSuccessfulRunId: uuid("last_successful_run_id").references(() => analysisRuns.id),
    lastAdvancedAt: timestamp("last_advanced_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [uniqueIndex("processing_cursors_identity_uidx").on(table.chainId, table.walletAddress)],
);

export const processedTxs = pgTable(
  "processed_txs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    blockNumber: numeric("block_number", { precision: 38, scale: 0 }).notNull(),
    firstRunId: uuid("first_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    firstSliceId: uuid("first_slice_id")
      .notNull()
      .references(() => analysisSlices.id, { onDelete: "cascade" }),
    processedAtUtc: timestamp("processed_at_utc", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("processed_txs_identity_uidx").on(table.chainId, table.txHash, table.walletAddress),
    index("processed_txs_block_idx").on(table.chainId, table.blockNumber),
  ],
);

export const rawProviderRecords = pgTable(
  "raw_provider_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id),
    sliceId: uuid("slice_id").references(() => analysisSlices.id),
    provider: varchar("provider", { length: 24 }).notNull(),
    endpoint: text("endpoint").notNull(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    requestHash: varchar("request_hash", { length: 64 }).notNull().default(""),
    requestJson: jsonb("request_json").$type<Record<string, unknown>>().notNull().default({}),
    responseJson: jsonb("response_json").$type<Record<string, unknown>>().notNull().default({}),
    confidence: varchar("confidence", { length: 16 }).notNull().default("high"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("raw_provider_records_chain_idx").on(table.chainId),
    index("raw_provider_records_hash_idx").on(table.provider, table.endpoint, table.requestHash),
  ],
);

export const protocolContracts = pgTable(
  "protocol_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    protocol: varchar("protocol", { length: 32 }).notNull(),
    contractType: varchar("contract_type", { length: 48 }).notNull(),
    source: varchar("source", { length: 64 }).notNull().default("manual"),
    sourceReference: text("source_reference"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("protocol_contracts_chain_address_uidx").on(table.chainId, table.address),
  ],
);

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    poolAddress: varchar("pool_address", { length: 42 }).notNull(),
    label: text("label").notNull(),
    token0Address: varchar("token0_address", { length: 42 }),
    token1Address: varchar("token1_address", { length: 42 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [uniqueIndex("pools_chain_address_uidx").on(table.chainId, table.poolAddress)],
);

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    poolId: uuid("pool_id").references(() => pools.id),
    positionManagerAddress: varchar("position_manager_address", { length: 42 }),
    tokenId: text("token_id"),
    mintTxHash: varchar("mint_tx_hash", { length: 66 }),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("deposits_wallet_idx").on(table.walletAddress, table.chainId),
    uniqueIndex("deposits_identity_uidx")
      .on(table.chainId, table.positionManagerAddress, table.tokenId)
      .where(sql`${table.tokenId} is not null and ${table.positionManagerAddress} is not null`),
  ],
);

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    label: text("label").notNull(),
    protocol: varchar("protocol", { length: 32 }).notNull().default("mellow"),
    wrapperAddress: varchar("wrapper_address", { length: 42 }),
    stakingRewardsAddress: varchar("staking_rewards_address", { length: 42 }),
    primaryPoolId: uuid("primary_pool_id").references(() => pools.id),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("strategies_chain_idx").on(table.chainId),
    uniqueIndex("strategies_identity_uidx")
      .on(table.chainId, table.wrapperAddress)
      .where(sql`${table.wrapperAddress} is not null`),
  ],
);

export const strategyExposures = pgTable(
  "strategy_exposures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    wrapperAddress: varchar("wrapper_address", { length: 42 }).notNull(),
    sharesRaw: numeric("shares_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    underlying0AmountRaw: numeric("underlying0_amount_raw", { precision: 78, scale: 0 }),
    underlying1AmountRaw: numeric("underlying1_amount_raw", { precision: 78, scale: 0 }),
    valuationBlockNumber: numeric("valuation_block_number", { precision: 38, scale: 0 }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("share_level"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("strategy_exposures_identity_uidx").on(
      table.chainId,
      table.strategyId,
      table.walletAddress,
      table.wrapperAddress,
    ),
  ],
);

export const pricePoints = pgTable(
  "price_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    pricedAt: timestamp("priced_at", { withTimezone: true }).notNull(),
    source: varchar("source", { length: 24 }).notNull().default("alchemy"),
    resolution: varchar("resolution", { length: 24 }).notNull().default("spot"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("high"),
    priceUsd: numeric("price_usd", { precision: 38, scale: 18 }).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("price_points_identity_uidx").on(
      table.chainId,
      table.tokenAddress,
      table.pricedAt,
      table.source,
      table.resolution,
    ),
  ],
);

export const coverageReports = pgTable(
  "coverage_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    scope: varchar("scope", { length: 32 }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    confidence: varchar("confidence", { length: 16 }).notNull().default("medium"),
    details: text("details"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [index("coverage_reports_wallet_idx").on(table.walletAddress, table.chainId)],
);

export const ledgerEvents = pgTable(
  "ledger_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull().default(0),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    classification: varchar("classification", { length: 32 }),
    classificationRunId: uuid("classification_run_id").references(() => analysisRuns.id),
    confidence: varchar("confidence", { length: 16 }).notNull().default("medium"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("ledger_events_identity_uidx").on(
      table.chainId,
      table.txHash,
      table.logIndex,
      table.eventType,
    ),
  ],
);

export const assetMovements = pgTable(
  "asset_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    ledgerEventId: uuid("ledger_event_id").references(() => ledgerEvents.id),
    movementIndex: integer("movement_index").notNull().default(0),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    directionIn: boolean("direction_in").notNull().default(true),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }).notNull(),
    amountUsd: numeric("amount_usd", { precision: 38, scale: 18 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("asset_movements_identity_uidx").on(
      table.chainId,
      table.ledgerEventId,
      table.movementIndex,
    ),
  ],
);

export const rewardEvents = pgTable(
  "reward_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull().default(0),
    rewardType: varchar("reward_type", { length: 32 }).notNull(),
    depositOrStrategyId: uuid("deposit_or_strategy_id"),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    amountUsd: numeric("amount_usd", { precision: 38, scale: 18 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    accrualSnapshotDayUtc: varchar("accrual_snapshot_day_utc", { length: 10 }),
    isAccrualSnapshot: boolean("is_accrual_snapshot").notNull().default(false),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("reward_events_identity_uidx").on(
      table.chainId,
      table.txHash,
      table.logIndex,
      table.rewardType,
    ),
    uniqueIndex("reward_events_accrual_uidx")
      .on(table.chainId, table.depositOrStrategyId, table.accrualSnapshotDayUtc)
      .where(sql`${table.isAccrualSnapshot} = true`),
  ],
);

export const governanceEvents = pgTable(
  "governance_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull().default(0),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("governance_events_identity_uidx").on(
      table.chainId,
      table.txHash,
      table.logIndex,
      table.eventType,
    ),
  ],
);

export const attributionStates = pgTable(
  "attribution_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    poolId: uuid("pool_id").references(() => pools.id),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id),
    residualAmountRaw: numeric("residual_amount_raw", { precision: 78, scale: 0 }).notNull(),
    resolutionStatus: varchar("resolution_status", { length: 32 }).notNull().default("still_waiting"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("attribution_states_wallet_idx").on(table.walletAddress, table.chainId),
    uniqueIndex("attribution_states_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.poolId,
      table.tokenAddress,
      table.sourceLedgerEventId,
    ),
  ],
);

export const attributionSourceLots = pgTable(
  "attribution_source_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("attribution_source_lots_wallet_idx").on(table.walletAddress, table.chainId),
    uniqueIndex("attribution_source_lots_identity_uidx").on(
      table.chainId,
      table.sourceLedgerEventId,
      table.tokenAddress,
    ),
  ],
);

export const performanceSnapshots = pgTable(
  "performance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    scope: varchar("scope", { length: 24 }).notNull(),
    scopeRefId: uuid("scope_ref_id"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    dayUtc: varchar("day_utc", { length: 10 }),
    resolution: varchar("resolution", { length: 16 }).notNull().default("daily"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    valueUsd: numeric("value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    pnlUsd: numeric("pnl_usd", { precision: 38, scale: 18 }),
    annualizedReturnPct: numeric("annualized_return_pct", { precision: 12, scale: 6 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("performance_snapshots_wallet_idx").on(table.walletAddress, table.chainId),
    uniqueIndex("performance_snapshots_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.scope,
      sql`coalesce(${table.scopeRefId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.dayUtc,
      table.resolution,
    ),
  ],
);

export const poolMetricsSnapshots = pgTable(
  "pool_metrics_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    dayUtc: varchar("day_utc", { length: 10 }).notNull(),
    tvlUsd: numeric("tvl_usd", { precision: 38, scale: 18 }),
    volume24hUsd: numeric("volume_24h_usd", { precision: 38, scale: 18 }),
    fees24hUsd: numeric("fees_24h_usd", { precision: 38, scale: 18 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [uniqueIndex("pool_metrics_snapshots_identity_uidx").on(table.chainId, table.poolId, table.dayUtc)],
);

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    totalValueUsd: numeric("total_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    deployedValueUsd: numeric("deployed_value_usd", { precision: 38, scale: 18 }),
    idleValueUsd: numeric("idle_value_usd", { precision: 38, scale: 18 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("portfolio_snapshots_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.capturedAt,
    ),
  ],
);

export const discardedEvents = pgTable(
  "discarded_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    reasonCode: varchar("reason_code", { length: 64 }).notNull(),
    details: text("details"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [index("discarded_events_wallet_idx").on(table.walletAddress, table.chainId)],
);

export const walletContexts = pgTable(
  "wallet_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    lastSuccessfulRunId: uuid("last_successful_run_id").references(() => analysisRuns.id),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [uniqueIndex("wallet_contexts_identity_uidx").on(table.chainId, table.walletAddress)],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    chainId: integer("chain_id"),
    key: text("key").notNull(),
    valueJson: jsonb("value_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("user_preferences_scope_key_uidx").on(
      table.walletAddress,
      sql`coalesce(${table.chainId}, -1)`,
      table.key,
    ),
    index("user_preferences_wallet_idx").on(table.walletAddress, table.chainId),
  ],
);

export type AnalysisRun = typeof analysisRuns.$inferSelect;
