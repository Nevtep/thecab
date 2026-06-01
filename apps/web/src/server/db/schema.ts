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

export const strategyWalletSummaries = pgTable(
  "strategy_wallet_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    strategyExposureId: uuid("strategy_exposure_id")
      .notNull()
      .references(() => strategyExposures.id, { onDelete: "cascade" }),
    primaryPoolId: uuid("primary_pool_id").references(() => pools.id, { onDelete: "set null" }),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    strategyLabel: text("strategy_label").notNull(),
    protocol: varchar("protocol", { length: 32 }).notNull().default("mellow"),
    wrapperAddress: varchar("wrapper_address", { length: 42 }),
    stakingRewardsAddress: varchar("staking_rewards_address", { length: 42 }),
    externalStrategyPositionReference: text("external_strategy_position_reference"),
    externalStrategyPositionReferenceStatus: varchar("external_strategy_position_reference_status", { length: 24 })
      .notNull()
      .default("unresolved"),
    poolMappingStatus: varchar("pool_mapping_status", { length: 24 }).notNull().default("unknown"),
    status: varchar("status", { length: 24 }).notNull().default("unknown"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    coveredStartDayUtc: varchar("covered_start_day_utc", { length: 10 }),
    coveredEndDayUtc: varchar("covered_end_day_utc", { length: 10 }),
    depositedValueUsd: numeric("deposited_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    withdrawnValueUsd: numeric("withdrawn_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentEstimatedValueUsd: numeric("current_estimated_value_usd", { precision: 38, scale: 18 }),
    sharesReceivedRaw: numeric("shares_received_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    sharesRedeemedRaw: numeric("shares_redeemed_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    currentSharesRaw: numeric("current_shares_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    shareSymbol: varchar("share_symbol", { length: 48 }),
    totalRewardsUsd: numeric("total_rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    resolvedRewardCount: integer("resolved_reward_count").notNull().default(0),
    unresolvedRewardCount: integer("unresolved_reward_count").notNull().default(0),
    realizedPnlUsd: numeric("realized_pnl_usd", { precision: 38, scale: 18 }),
    unrealizedPnlUsd: numeric("unrealized_pnl_usd", { precision: 38, scale: 18 }),
    totalReturnUsd: numeric("total_return_usd", { precision: 38, scale: 18 }),
    totalReturnPct: numeric("total_return_pct", { precision: 12, scale: 6 }),
    estimatedAnnualizedReturnPct: numeric("estimated_annualized_return_pct", { precision: 12, scale: 6 }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("share_level"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    coverageReasonCodes: text("coverage_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("strategy_wallet_summaries_identity_uidx").on(table.chainId, table.walletAddress, table.strategyExposureId),
    index("strategy_wallet_summaries_status_idx").on(table.chainId, table.walletAddress, table.status),
    index("strategy_wallet_summaries_pool_idx").on(table.chainId, table.walletAddress, table.primaryPoolId),
    index("strategy_wallet_summaries_coverage_idx").on(table.chainId, table.walletAddress, table.coverageStatus),
    index("strategy_wallet_summaries_value_idx").on(table.chainId, table.walletAddress, table.currentEstimatedValueUsd),
    index("strategy_wallet_summaries_opened_idx").on(table.chainId, table.walletAddress, table.openedAt),
  ],
);

export const strategyHistorySnapshots = pgTable(
  "strategy_history_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    strategyExposureId: uuid("strategy_exposure_id")
      .notNull()
      .references(() => strategyExposures.id, { onDelete: "cascade" }),
    primaryPoolId: uuid("primary_pool_id").references(() => pools.id, { onDelete: "set null" }),
    dayUtc: varchar("day_utc", { length: 10 }).notNull(),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("share_level"),
    shareBalanceRaw: numeric("share_balance_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    estimatedValueUsd: numeric("estimated_value_usd", { precision: 38, scale: 18 }),
    depositedValueUsd: numeric("deposited_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    withdrawnValueUsd: numeric("withdrawn_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    rewardValueUsd: numeric("reward_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    cumulativeRewardsUsd: numeric("cumulative_rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalReturnUsd: numeric("total_return_usd", { precision: 38, scale: 18 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("strategy_history_snapshots_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.strategyExposureId,
      table.dayUtc,
    ),
    index("strategy_history_snapshots_day_idx").on(table.chainId, table.walletAddress, table.dayUtc),
    index("strategy_history_snapshots_exposure_day_idx").on(
      table.chainId,
      table.walletAddress,
      table.strategyExposureId,
      table.dayUtc,
    ),
    index("strategy_history_snapshots_pool_day_idx").on(table.chainId, table.walletAddress, table.primaryPoolId, table.dayUtc),
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
    strategyExposureId: uuid("strategy_exposure_id").references(() => strategyExposures.id),
    resolvedPoolId: uuid("resolved_pool_id").references(() => pools.id),
    resolutionBasis: varchar("resolution_basis", { length: 32 }),
    resolutionReasonCodes: text("resolution_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    amountUsd: numeric("amount_usd", { precision: 38, scale: 18 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    accrualSnapshotDayUtc: varchar("accrual_snapshot_day_utc", { length: 10 }),
    isAccrualSnapshot: boolean("is_accrual_snapshot").notNull().default(false),
    resolutionStatus: varchar("resolution_status", { length: 24 }).notNull().default("unresolved"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("reward_events_wallet_occurred_idx").on(table.chainId, table.walletAddress, table.occurredAt),
    index("reward_events_wallet_resolution_idx").on(table.chainId, table.walletAddress, table.resolutionStatus),
    index("reward_events_wallet_token_idx").on(table.chainId, table.walletAddress, table.tokenAddress),
    index("reward_events_wallet_reward_type_idx").on(table.chainId, table.walletAddress, table.rewardType),
    index("reward_events_wallet_deposit_idx").on(table.chainId, table.walletAddress, table.depositOrStrategyId),
    index("reward_events_strategy_exposure_idx").on(table.strategyExposureId),
    index("reward_events_resolved_pool_idx").on(table.resolvedPoolId),
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

export const strategyLifecycleEvents = pgTable(
  "strategy_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    strategyExposureId: uuid("strategy_exposure_id")
      .notNull()
      .references(() => strategyExposures.id, { onDelete: "cascade" }),
    primaryPoolId: uuid("primary_pool_id").references(() => pools.id, { onDelete: "set null" }),
    sequenceIndex: integer("sequence_index").notNull(),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    logIndex: integer("log_index"),
    blockNumber: numeric("block_number", { precision: 38, scale: 0 }),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id, { onDelete: "set null" }),
    sourceRewardEventId: uuid("source_reward_event_id").references(() => rewardEvents.id, { onDelete: "set null" }),
    usdValue: numeric("usd_value", { precision: 38, scale: 18 }),
    shareDeltaRaw: numeric("share_delta_raw", { precision: 78, scale: 0 }),
    tokenDeltasJson: jsonb("token_deltas_json").$type<unknown[]>().notNull().default([]),
    priceSource: varchar("price_source", { length: 32 }),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("share_level"),
    coverageReasonCodes: text("coverage_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("strategy_lifecycle_events_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.strategyExposureId,
      table.sequenceIndex,
    ),
    index("strategy_lifecycle_events_occurred_idx").on(
      table.chainId,
      table.walletAddress,
      table.strategyExposureId,
      table.occurredAt,
    ),
    index("strategy_lifecycle_events_type_idx").on(table.chainId, table.walletAddress, table.strategyExposureId, table.eventType),
    index("strategy_lifecycle_events_tx_idx").on(table.chainId, table.walletAddress, table.txHash),
    index("strategy_lifecycle_events_reward_idx").on(table.chainId, table.walletAddress, table.sourceRewardEventId),
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

export const governanceLockExposures = pgTable(
  "governance_lock_exposures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    lockId: varchar("lock_id", { length: 128 }),
    status: varchar("status", { length: 24 }).notNull().default("unknown"),
    lockedAeroAmount: numeric("locked_aero_amount", { precision: 78, scale: 18 }),
    lockedAeroValueUsd: numeric("locked_aero_value_usd", { precision: 38, scale: 18 }),
    veAeroExposure: numeric("ve_aero_exposure", { precision: 78, scale: 18 }),
    createdAtUtc: timestamp("created_at_utc", { withTimezone: true }),
    expiresAtUtc: timestamp("expires_at_utc", { withTimezone: true }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unavailable"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("none"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    lifecycleJson: jsonb("lifecycle_json").$type<unknown[]>().notNull().default([]),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    materializedAt: timestamp("materialized_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("governance_lock_exposures_wallet_idx").on(table.chainId, table.walletAddress),
    index("governance_lock_exposures_run_idx").on(table.runId),
  ],
);

export const governanceEpochSummaries = pgTable(
  "governance_epoch_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    epochId: varchar("epoch_id", { length: 64 }).notNull(),
    epochStartUtc: timestamp("epoch_start_utc", { withTimezone: true }),
    epochEndUtc: timestamp("epoch_end_utc", { withTimezone: true }),
    voteMode: varchar("vote_mode", { length: 24 }).notNull().default("unknown"),
    resetState: varchar("reset_state", { length: 24 }).notNull().default("unknown"),
    rewardState: varchar("reward_state", { length: 24 }).notNull().default("unknown"),
    feesUsd: numeric("fees_usd", { precision: 38, scale: 18 }),
    bribesUsd: numeric("bribes_usd", { precision: 38, scale: 18 }),
    rebasesUsd: numeric("rebases_usd", { precision: 38, scale: 18 }),
    votedPoolsJson: jsonb("voted_pools_json").$type<unknown[]>().notNull().default([]),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unavailable"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("none"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    materializedAt: timestamp("materialized_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("governance_epoch_summaries_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.epochId,
    ),
    index("governance_epoch_summaries_wallet_idx").on(table.chainId, table.walletAddress),
    index("governance_epoch_summaries_run_idx").on(table.runId),
  ],
);

export const governanceRewardRows = pgTable(
  "governance_reward_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    rewardEventId: uuid("reward_event_id").references(() => rewardEvents.id, { onDelete: "set null" }),
    governanceEventId: uuid("governance_event_id").references(() => governanceEvents.id, { onDelete: "set null" }),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
    rewardType: varchar("reward_type", { length: 32 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    tokenSymbol: varchar("token_symbol", { length: 24 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    amountDecimal: numeric("amount_decimal", { precision: 78, scale: 18 }),
    valueUsdAtClaim: numeric("value_usd_at_claim", { precision: 38, scale: 18 }),
    epochId: varchar("epoch_id", { length: 64 }),
    poolId: uuid("pool_id").references(() => pools.id, { onDelete: "set null" }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unavailable"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("none"),
    affectsTotals: boolean("affects_totals").notNull().default(false),
    contextJson: jsonb("context_json").$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    materializedAt: timestamp("materialized_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("governance_reward_rows_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.txHash,
      table.logIndex,
      table.rewardType,
    ),
    index("governance_reward_rows_wallet_claimed_idx").on(table.chainId, table.walletAddress, table.claimedAt),
    index("governance_reward_rows_reward_event_idx").on(table.rewardEventId),
    index("governance_reward_rows_pool_idx").on(table.chainId, table.walletAddress, table.poolId),
  ],
);

export const governanceMetricSnapshots = pgTable(
  "governance_metric_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => analysisRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().notNull().default({}),
    selectedDetailJson: jsonb("selected_detail_json").$type<Record<string, unknown> | null>(),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unavailable"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("none"),
    materializedAt: timestamp("materialized_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("governance_metric_snapshots_wallet_idx").on(table.chainId, table.walletAddress),
    index("governance_metric_snapshots_run_idx").on(table.runId),
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

export const inferredActions = pgTable(
  "inferred_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    actionType: varchar("action_type", { length: 48 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    primaryPoolId: uuid("primary_pool_id").references(() => pools.id),
    depositId: uuid("deposit_id").references(() => deposits.id),
    strategyId: uuid("strategy_id").references(() => strategies.id),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id),
    sourceResidualLotId: uuid("source_residual_lot_id").references(() => attributionSourceLots.id),
    consumingLedgerEventIdsJson: jsonb("consuming_ledger_event_ids_json")
      .$type<string[]>()
      .notNull()
      .default([]),
    valueUsd: numeric("value_usd", { precision: 38, scale: 18 }),
    confidence: varchar("confidence", { length: 16 }).notNull().default("medium"),
    latestRunId: uuid("latest_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("inferred_actions_wallet_idx").on(table.walletAddress, table.chainId),
    index("inferred_actions_pool_idx").on(table.primaryPoolId),
    uniqueIndex("inferred_actions_identity_uidx").on(
      table.chainId,
      table.walletAddress,
      table.actionType,
      table.sourceLedgerEventId,
    ),
  ],
);

export const approvalLinks = pgTable(
  "approval_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull().default(0),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    tokenId: varchar("token_id", { length: 80 }),
    spenderAddress: varchar("spender_address", { length: 42 }).notNull(),
    spenderContractType: varchar("spender_contract_type", { length: 32 }),
    relatedPoolId: uuid("related_pool_id").references(() => pools.id),
    relatedDepositId: uuid("related_deposit_id").references(() => deposits.id),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id),
    confidence: varchar("confidence", { length: 16 }).notNull().default("medium"),
    latestRunId: uuid("latest_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("approval_links_wallet_idx").on(table.walletAddress, table.chainId),
    index("approval_links_spender_idx").on(table.spenderAddress, table.chainId),
    uniqueIndex("approval_links_identity_uidx").on(table.chainId, table.txHash, table.logIndex),
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

export const poolWalletSummaries = pgTable(
  "pool_wallet_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    coveredStartDayUtc: varchar("covered_start_day_utc", { length: 10 }).notNull(),
    coveredEndDayUtc: varchar("covered_end_day_utc", { length: 10 }).notNull(),
    firstParticipatedAt: timestamp("first_participated_at", { withTimezone: true }),
    lastParticipatedAt: timestamp("last_participated_at", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("unknown"),
    exposureMix: varchar("exposure_mix", { length: 24 }).notNull().default("unknown"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    currentAttributedValueUsd: numeric("current_attributed_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentDeployedValueUsd: numeric("current_deployed_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentResidualValueUsd: numeric("current_residual_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentManualValueUsd: numeric("current_manual_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentStrategyValueUsd: numeric("current_strategy_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalEnteredUsd: numeric("capital_entered_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalWithdrawnUsd: numeric("capital_withdrawn_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    realizedPnlUsd: numeric("realized_pnl_usd", { precision: 38, scale: 18 }),
    unrealizedPnlUsd: numeric("unrealized_pnl_usd", { precision: 38, scale: 18 }),
    totalRewardsUsd: numeric("total_rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalFeesUsd: numeric("total_fees_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    annualizedReturnPct: numeric("annualized_return_pct", { precision: 12, scale: 6 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("pool_wallet_summaries_identity_uidx").on(table.chainId, table.walletAddress, table.poolId),
    index("pool_wallet_summaries_status_idx").on(table.chainId, table.walletAddress, table.status),
    index("pool_wallet_summaries_coverage_idx").on(table.chainId, table.walletAddress, table.coverageStatus),
    index("pool_wallet_summaries_updated_idx").on(table.chainId, table.walletAddress, table.updatedAt),
  ],
);

export const poolHistorySnapshots = pgTable(
  "pool_history_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    dayUtc: varchar("day_utc", { length: 10 }).notNull(),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    totalValueUsd: numeric("total_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    deployedValueUsd: numeric("deployed_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    residualValueUsd: numeric("residual_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    manualValueUsd: numeric("manual_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    strategyValueUsd: numeric("strategy_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    rewardValueUsd: numeric("reward_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    cumulativeRewardsUsd: numeric("cumulative_rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalInUsd: numeric("capital_in_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalOutUsd: numeric("capital_out_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    pnlUsd: numeric("pnl_usd", { precision: 38, scale: 18 }),
    annualizedReturnPct: numeric("annualized_return_pct", { precision: 12, scale: 6 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("pool_history_snapshots_identity_uidx").on(table.chainId, table.walletAddress, table.poolId, table.dayUtc),
    index("pool_history_snapshots_pool_day_idx").on(table.chainId, table.walletAddress, table.poolId, table.dayUtc),
    index("pool_history_snapshots_day_idx").on(table.chainId, table.walletAddress, table.dayUtc),
  ],
);

export const poolTimelineEvents = pgTable(
  "pool_timeline_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    eventKey: varchar("event_key", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    sourceLedgerEventId: uuid("source_ledger_event_id").references(() => ledgerEvents.id),
    relatedDepositId: uuid("related_deposit_id").references(() => deposits.id),
    relatedStrategyId: uuid("related_strategy_id").references(() => strategies.id),
    confidence: varchar("confidence", { length: 16 }).notNull().default("medium"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    attributedValueUsd: numeric("attributed_value_usd", { precision: 38, scale: 18 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("pool_timeline_events_identity_uidx").on(table.chainId, table.walletAddress, table.poolId, table.eventKey),
    index("pool_timeline_events_occurred_idx").on(table.chainId, table.walletAddress, table.poolId, table.occurredAt),
    index("pool_timeline_events_run_idx").on(table.chainId, table.walletAddress, table.latestRunId),
  ],
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

export const depositWalletSummaries = pgTable(
  "deposit_wallet_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    depositId: uuid("deposit_id")
      .notNull()
      .references(() => deposits.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    positionLabel: text("position_label").notNull(),
    poolKind: varchar("pool_kind", { length: 24 }).notNull().default("cl"),
    feeTierBps: integer("fee_tier_bps"),
    tokenId: text("token_id"),
    token0Address: varchar("token0_address", { length: 42 }),
    token0Symbol: varchar("token0_symbol", { length: 32 }),
    token1Address: varchar("token1_address", { length: 42 }),
    token1Symbol: varchar("token1_symbol", { length: 32 }),
    status: varchar("status", { length: 24 }).notNull().default("open_active"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    openedByTransferIn: boolean("opened_by_transfer_in").notNull().default(false),
    openedValueUsd: numeric("opened_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    currentValueUsd: numeric("current_value_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalEnteredUsd: numeric("capital_entered_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    capitalWithdrawnUsd: numeric("capital_withdrawn_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalRewardsUsd: numeric("total_rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalFeesUsd: numeric("total_fees_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    realizedPnlUsd: numeric("realized_pnl_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    unrealizedPnlUsd: numeric("unrealized_pnl_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalReturnUsd: numeric("total_return_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    totalReturnPct: numeric("total_return_pct", { precision: 12, scale: 6 }),
    estimatedAnnualizedReturnPct: numeric("estimated_annualized_return_pct", { precision: 12, scale: 6 }),
    tickLower: integer("tick_lower"),
    tickUpper: integer("tick_upper"),
    rangeLowerPrice: numeric("range_lower_price", { precision: 38, scale: 18 }),
    rangeUpperPrice: numeric("range_upper_price", { precision: 38, scale: 18 }),
    isInRange: boolean("is_in_range"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    coverageReasonCodes: text("coverage_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    coveredStartDayUtc: varchar("covered_start_day_utc", { length: 10 }),
    coveredEndDayUtc: varchar("covered_end_day_utc", { length: 10 }),
    mellowStrategyCrossLinkId: uuid("mellow_strategy_cross_link_id").references(() => strategies.id, { onDelete: "set null" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("deposit_wallet_summaries_identity_uidx").on(table.chainId, table.walletAddress, table.depositId),
    index("deposit_wallet_summaries_status_idx").on(table.chainId, table.walletAddress, table.status),
    index("deposit_wallet_summaries_opened_idx").on(table.chainId, table.walletAddress, table.openedAt),
    index("deposit_wallet_summaries_pool_idx").on(table.chainId, table.walletAddress, table.poolId),
    index("deposit_wallet_summaries_coverage_idx").on(table.chainId, table.walletAddress, table.coverageStatus),
  ],
);

export const depositLifecycleEvents = pgTable(
  "deposit_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    depositId: uuid("deposit_id")
      .notNull()
      .references(() => deposits.id, { onDelete: "cascade" }),
    sequenceIndex: integer("sequence_index").notNull(),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: integer("block_number").notNull(),
    usdValue: numeric("usd_value", { precision: 38, scale: 18 }),
    signedTokenDeltas: jsonb("signed_token_deltas").$type<unknown[]>().notNull().default([]),
    priceSource: varchar("price_source", { length: 24 }),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    inferredActionId: uuid("inferred_action_id").references(() => inferredActions.id, { onDelete: "set null" }),
    coverageReasonCodes: text("coverage_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("deposit_lifecycle_events_identity_uidx").on(table.chainId, table.walletAddress, table.depositId, table.sequenceIndex),
    index("deposit_lifecycle_events_occurred_idx").on(table.chainId, table.walletAddress, table.depositId, table.occurredAt),
    index("deposit_lifecycle_events_type_idx").on(table.chainId, table.walletAddress, table.depositId, table.eventType),
  ],
);

export const depositPerformanceDecompositions = pgTable(
  "deposit_performance_decompositions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    depositId: uuid("deposit_id")
      .notNull()
      .references(() => deposits.id, { onDelete: "cascade" }),
    latestRunId: uuid("latest_run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    totalReturnUsd: numeric("total_return_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    rewardsUsd: numeric("rewards_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    feesUsd: numeric("fees_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    assetPriceEffectUsd: numeric("asset_price_effect_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    rebalanceEffectUsd: numeric("rebalance_effect_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    realizedPnlUsd: numeric("realized_pnl_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    unrealizedPnlUsd: numeric("unrealized_pnl_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    unattributedUsd: numeric("unattributed_usd", { precision: 38, scale: 18 }).notNull().default("0"),
    unattributedReasonCodes: text("unattributed_reason_codes").array().notNull().default(sql`'{}'::text[]`),
    componentPercentages: jsonb("component_percentages").$type<Record<string, number>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("deposit_performance_decompositions_identity_uidx").on(table.chainId, table.walletAddress, table.depositId),
  ],
);

export const engineV2CollectionRuns = pgTable(
  "engine_v2_collection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    analysisRunId: uuid("analysis_run_id").references(() => analysisRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull().default("moralis"),
    sourceEndpoint: text("source_endpoint").notNull(),
    sourceQueryJson: jsonb("source_query_json").$type<Record<string, unknown>>().notNull().default({}),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    providerRowCount: integer("provider_row_count").notNull().default(0),
    distinctTxCount: integer("distinct_tx_count").notNull().default(0),
    duplicateTxCount: integer("duplicate_tx_count").notNull().default(0),
    collectionVersion: varchar("collection_version", { length: 32 }).notNull().default("engine-v2.0"),
    lastCursor: text("last_cursor"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("engine_v2_collection_runs_wallet_idx").on(table.chainId, table.walletAddress, table.status),
    index("engine_v2_collection_runs_analysis_run_idx").on(table.analysisRunId),
  ],
);

export const engineV2ProviderPages = pgTable(
  "engine_v2_provider_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionRunId: uuid("collection_run_id")
      .notNull()
      .references(() => engineV2CollectionRuns.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    sourceEndpoint: text("source_endpoint").notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    responseHash: varchar("response_hash", { length: 64 }).notNull(),
    cursorIn: text("cursor_in"),
    cursorOut: text("cursor_out"),
    pageIndex: integer("page_index").notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_provider_pages_request_uidx").on(
      table.chainId,
      table.walletAddress,
      table.sourceProvider,
      table.requestHash,
    ),
    index("engine_v2_provider_pages_run_idx").on(table.collectionRunId, table.pageIndex),
  ],
);

export const canonicalTransactions = pgTable(
  "canonical_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    blockNumber: numeric("block_number", { precision: 38, scale: 0 }).notNull(),
    blockTimestamp: timestamp("block_timestamp", { withTimezone: true }).notNull(),
    transactionIndex: integer("transaction_index").notNull().default(0),
    fromAddress: varchar("from_address", { length: 42 }),
    toAddress: varchar("to_address", { length: 42 }),
    valueNativeRaw: numeric("value_native_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    input: text("input"),
    receiptStatus: varchar("receipt_status", { length: 16 }).notNull().default("unknown"),
    gasUsed: numeric("gas_used", { precision: 38, scale: 0 }),
    transactionFeeNative: numeric("transaction_fee_native", { precision: 38, scale: 18 }),
    decodedCallJson: jsonb("decoded_call_json").$type<Record<string, unknown> | null>(),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull().default("moralis"),
    sourceEndpoint: text("source_endpoint").notNull(),
    sourceCursor: text("source_cursor"),
    providerPageId: uuid("provider_page_id").references(() => engineV2ProviderPages.id, { onDelete: "set null" }),
    rawProviderRecordId: text("raw_provider_record_id"),
    collectionRunId: uuid("collection_run_id").references(() => engineV2CollectionRuns.id, { onDelete: "set null" }),
    canonicalizedAt: timestamp("canonicalized_at", { withTimezone: true }).defaultNow().notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("canonical_transactions_identity_uidx").on(table.chainId, table.walletAddress, table.txHash),
    index("canonical_transactions_order_idx").on(table.chainId, table.walletAddress, table.blockNumber, table.transactionIndex),
    index("canonical_transactions_tx_idx").on(table.chainId, table.txHash),
  ],
);

export const canonicalTransactionLogs = pgTable(
  "canonical_transaction_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTransactionId: uuid("canonical_transaction_id")
      .notNull()
      .references(() => canonicalTransactions.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    topic0: varchar("topic0", { length: 66 }),
    topic1: varchar("topic1", { length: 66 }),
    topic2: varchar("topic2", { length: 66 }),
    topic3: varchar("topic3", { length: 66 }),
    data: text("data"),
    decodedEventJson: jsonb("decoded_event_json").$type<Record<string, unknown> | null>(),
    abiId: uuid("abi_id"),
    decodeStatus: varchar("decode_status", { length: 24 }).notNull().default("provider_hint"),
    decodeConfidence: varchar("decode_confidence", { length: 16 }).notNull().default("unknown"),
    sourceKind: varchar("source_kind", { length: 48 }).notNull().default("wallet_history"),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("canonical_transaction_logs_identity_uidx").on(table.chainId, table.txHash, table.logIndex),
    index("canonical_transaction_logs_topic_idx").on(table.chainId, table.address, table.topic0),
    index("canonical_transaction_logs_tx_idx").on(table.canonicalTransactionId, table.logIndex),
  ],
);

export const canonicalInternalTransactions = pgTable(
  "canonical_internal_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTransactionId: uuid("canonical_transaction_id")
      .notNull()
      .references(() => canonicalTransactions.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    traceIndex: integer("trace_index").notNull(),
    fromAddress: varchar("from_address", { length: 42 }),
    toAddress: varchar("to_address", { length: 42 }),
    valueNativeRaw: numeric("value_native_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    callType: varchar("call_type", { length: 32 }),
    gas: numeric("gas", { precision: 38, scale: 0 }),
    error: text("error"),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("canonical_internal_txs_identity_uidx").on(table.chainId, table.txHash, table.traceIndex),
    index("canonical_internal_txs_tx_idx").on(table.canonicalTransactionId, table.traceIndex),
  ],
);

export const canonicalAssetMovements = pgTable(
  "canonical_asset_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTransactionId: uuid("canonical_transaction_id")
      .notNull()
      .references(() => canonicalTransactions.id, { onDelete: "cascade" }),
    canonicalLogId: uuid("canonical_log_id").references(() => canonicalTransactionLogs.id, { onDelete: "set null" }),
    canonicalInternalTransactionId: uuid("canonical_internal_transaction_id").references(() => canonicalInternalTransactions.id, { onDelete: "set null" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    movementIndex: integer("movement_index").notNull(),
    assetType: varchar("asset_type", { length: 24 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    tokenId: text("token_id"),
    fromAddress: varchar("from_address", { length: 42 }),
    toAddress: varchar("to_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    direction: varchar("direction", { length: 16 }).notNull().default("unknown"),
    movementKind: varchar("movement_kind", { length: 48 }).notNull().default("unknown"),
    metadataStatus: varchar("metadata_status", { length: 24 }).notNull().default("missing"),
    priceStatus: varchar("price_status", { length: 24 }).notNull().default("missing"),
    valueUsdAtEvent: numeric("value_usd_at_event", { precision: 38, scale: 18 }),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("canonical_asset_movements_identity_uidx").on(table.chainId, table.txHash, table.movementIndex),
    index("canonical_asset_movements_wallet_idx").on(table.chainId, table.walletAddress, table.txHash),
    index("canonical_asset_movements_token_idx").on(table.chainId, table.tokenAddress, table.tokenId),
  ],
);

export const contractAbis = pgTable(
  "contract_abis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    implementationAddress: varchar("implementation_address", { length: 42 }),
    contractName: text("contract_name"),
    protocol: varchar("protocol", { length: 32 }),
    contractKind: varchar("contract_kind", { length: 64 }).notNull().default("unknown"),
    abiJson: jsonb("abi_json").$type<unknown[]>().notNull().default([]),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    sourceUrl: text("source_url"),
    sourceReference: text("source_reference"),
    bytecodeHash: varchar("bytecode_hash", { length: 66 }),
    isProxy: boolean("is_proxy").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("contract_abis_identity_uidx").on(table.chainId, table.address, table.implementationAddress),
    index("contract_abis_protocol_idx").on(table.chainId, table.protocol, table.contractKind),
  ],
);

export const contractAbiSelectors = pgTable(
  "contract_abi_selectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contractAbiId: uuid("contract_abi_id")
      .notNull()
      .references(() => contractAbis.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    selectorOrTopic: varchar("selector_or_topic", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    fragmentType: varchar("fragment_type", { length: 16 }).notNull(),
    fragmentJson: jsonb("fragment_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("contract_abi_selectors_identity_uidx").on(table.chainId, table.address, table.selectorOrTopic, table.fragmentType),
    index("contract_abi_selectors_lookup_idx").on(table.chainId, table.selectorOrTopic, table.fragmentType),
  ],
);

export const canonicalCalls = pgTable(
  "canonical_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTransactionId: uuid("canonical_transaction_id")
      .notNull()
      .references(() => canonicalTransactions.id, { onDelete: "cascade" }),
    parentCallId: uuid("parent_call_id"),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    callPath: text("call_path").notNull(),
    targetAddress: varchar("target_address", { length: 42 }),
    selector: varchar("selector", { length: 10 }),
    functionName: text("function_name"),
    decodedArgsJson: jsonb("decoded_args_json").$type<Record<string, unknown> | null>(),
    rawCallData: text("raw_call_data"),
    abiId: uuid("abi_id").references(() => contractAbis.id, { onDelete: "set null" }),
    decodeStatus: varchar("decode_status", { length: 24 }).notNull().default("missing_abi"),
    decodeConfidence: varchar("decode_confidence", { length: 16 }).notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("canonical_calls_identity_uidx").on(table.chainId, table.txHash, table.callPath),
    index("canonical_calls_tx_idx").on(table.canonicalTransactionId, table.callPath),
    index("canonical_calls_selector_idx").on(table.chainId, table.targetAddress, table.selector),
  ],
);

export const engineV2ProtocolKnownAddresses = pgTable(
  "engine_v2_protocol_known_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    protocol: varchar("protocol", { length: 32 }).notNull(),
    addressKind: varchar("address_kind", { length: 64 }).notNull(),
    label: text("label"),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    sourceReference: text("source_reference"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("high"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_protocol_known_addresses_uidx").on(table.chainId, table.address, table.addressKind),
    index("engine_v2_protocol_known_addresses_protocol_idx").on(table.chainId, table.protocol, table.addressKind),
  ],
);

export const engineV2TokenMetadata = pgTable(
  "engine_v2_token_metadata",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    symbol: varchar("symbol", { length: 64 }),
    name: text("name"),
    decimals: integer("decimals"),
    category: varchar("category", { length: 64 }),
    verified: boolean("verified").notNull().default(false),
    possibleSpam: boolean("possible_spam").notNull().default(false),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [uniqueIndex("engine_v2_token_metadata_uidx").on(table.chainId, table.tokenAddress)],
);

export const engineV2PricePoints = pgTable(
  "engine_v2_price_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    pricedAt: timestamp("priced_at", { withTimezone: true }),
    blockNumber: numeric("block_number", { precision: 38, scale: 0 }),
    priceUsd: numeric("price_usd", { precision: 38, scale: 18 }),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    resolution: varchar("resolution", { length: 32 }).notNull().default("historical"),
    status: varchar("status", { length: 24 }).notNull().default("resolved"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_price_points_uidx").on(table.chainId, table.tokenAddress, table.blockNumber, table.sourceProvider, table.resolution),
    index("engine_v2_price_points_time_idx").on(table.chainId, table.tokenAddress, table.pricedAt),
  ],
);

export const engineV2ProviderRequests = pgTable(
  "engine_v2_provider_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    naturalKey: text("natural_key").notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    endpoint: text("endpoint").notNull(),
    requestJson: jsonb("request_json").$type<Record<string, unknown>>().notNull().default({}),
    responseReference: text("response_reference"),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_provider_requests_natural_uidx").on(table.chainId, table.naturalKey),
    index("engine_v2_provider_requests_status_idx").on(table.status, table.nextRetryAt),
  ],
);

export const engineV2ProtocolStateSnapshots = pgTable(
  "engine_v2_protocol_state_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    protocol: varchar("protocol", { length: 32 }).notNull(),
    subjectType: varchar("subject_type", { length: 48 }).notNull(),
    subjectAddress: varchar("subject_address", { length: 42 }).notNull(),
    subjectId: text("subject_id"),
    blockNumber: numeric("block_number", { precision: 38, scale: 0 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
    sourceProvider: varchar("source_provider", { length: 32 }).notNull(),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_protocol_state_snapshots_uidx").on(
      table.chainId,
      table.protocol,
      table.subjectType,
      table.subjectAddress,
      table.subjectId,
      table.blockNumber,
    ),
    index("engine_v2_protocol_state_snapshots_subject_idx").on(table.chainId, table.subjectType, table.subjectAddress),
  ],
);

export const engineV2DomainEvents = pgTable(
  "engine_v2_domain_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    canonicalTransactionId: uuid("canonical_transaction_id").references(() => canonicalTransactions.id, { onDelete: "set null" }),
    canonicalCallId: uuid("canonical_call_id").references(() => canonicalCalls.id, { onDelete: "set null" }),
    parentEventId: uuid("parent_event_id"),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    eventFamily: varchar("event_family", { length: 32 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    sequenceIndex: integer("sequence_index").notNull(),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    valueEffectJson: jsonb("value_effect_json").$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_domain_events_identity_uidx").on(table.chainId, table.walletAddress, table.txHash, table.sequenceIndex),
    index("engine_v2_domain_events_wallet_idx").on(table.chainId, table.walletAddress, table.occurredAt),
    index("engine_v2_domain_events_parent_idx").on(table.parentEventId),
  ],
);

export const engineV2DomainEventLinks = pgTable(
  "engine_v2_domain_event_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainEventId: uuid("domain_event_id")
      .notNull()
      .references(() => engineV2DomainEvents.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    entityType: varchar("entity_type", { length: 48 }).notNull(),
    entityId: text("entity_id").notNull(),
    linkKind: varchar("link_kind", { length: 48 }).notNull().default("explicit"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("high"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_domain_event_links_uidx").on(table.domainEventId, table.entityType, table.entityId, table.linkKind),
    index("engine_v2_domain_event_links_entity_idx").on(table.chainId, table.entityType, table.entityId),
  ],
);

export const engineV2ClassificationTraces = pgTable(
  "engine_v2_classification_traces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTransactionId: uuid("canonical_transaction_id")
      .notNull()
      .references(() => canonicalTransactions.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    classifierVersion: varchar("classifier_version", { length: 32 }).notNull(),
    matchedRule: text("matched_rule").notNull(),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull(),
    confidence: varchar("confidence", { length: 16 }).notNull(),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("engine_v2_classification_traces_tx_idx").on(table.chainId, table.txHash),
    index("engine_v2_classification_traces_rule_idx").on(table.classifierVersion, table.matchedRule),
  ],
);

export const engineV2EnrichmentNeeds = pgTable(
  "engine_v2_enrichment_needs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    needType: varchar("need_type", { length: 48 }).notNull(),
    naturalKey: text("natural_key").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    priority: integer("priority").notNull().default(100),
    sourceDomainEventId: uuid("source_domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    requestJson: jsonb("request_json").$type<Record<string, unknown>>().notNull().default({}),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>().notNull().default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_enrichment_needs_natural_uidx").on(table.chainId, table.needType, table.naturalKey),
    index("engine_v2_enrichment_needs_status_idx").on(table.status, table.priority, table.nextRetryAt),
  ],
);

export const engineV2GovernanceLocks = pgTable(
  "engine_v2_governance_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    votingEscrowAddress: varchar("voting_escrow_address", { length: 42 }).notNull(),
    lockTokenId: text("lock_token_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    ownerAddress: varchar("owner_address", { length: 42 }),
    originTxHash: varchar("origin_tx_hash", { length: 66 }),
    originKind: varchar("origin_kind", { length: 48 }).notNull().default("unknown"),
    status: varchar("status", { length: 24 }).notNull().default("unknown"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("partial"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_governance_locks_identity_uidx").on(table.chainId, table.votingEscrowAddress, table.lockTokenId),
    index("engine_v2_governance_locks_wallet_idx").on(table.chainId, table.walletAddress),
  ],
);

export const engineV2GovernanceLockEvents = pgTable(
  "engine_v2_governance_lock_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    governanceLockId: uuid("governance_lock_id")
      .notNull()
      .references(() => engineV2GovernanceLocks.id, { onDelete: "cascade" }),
    domainEventId: uuid("domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    chainId: integer("chain_id").notNull(),
    eventType: varchar("event_type", { length: 48 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    lockEnd: timestamp("lock_end", { withTimezone: true }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("engine_v2_governance_lock_events_uidx").on(table.chainId, table.txHash, table.eventType, table.governanceLockId),
    index("engine_v2_governance_lock_events_lock_idx").on(table.governanceLockId, table.occurredAt),
  ],
);

export const engineV2ManagedLockLinks = pgTable(
  "engine_v2_managed_lock_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    userLockId: uuid("user_lock_id")
      .notNull()
      .references(() => engineV2GovernanceLocks.id, { onDelete: "cascade" }),
    managedLockId: uuid("managed_lock_id").references(() => engineV2GovernanceLocks.id, { onDelete: "set null" }),
    userTokenId: text("user_token_id").notNull(),
    managedTokenId: text("managed_token_id").notNull(),
    managerAddress: varchar("manager_address", { length: 42 }),
    depositedAt: timestamp("deposited_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_managed_lock_links_uidx").on(table.chainId, table.walletAddress, table.userTokenId, table.managedTokenId),
    index("engine_v2_managed_lock_links_user_idx").on(table.userLockId),
  ],
);

export const engineV2GovernanceEpochs = pgTable(
  "engine_v2_governance_epochs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    epochId: text("epoch_id").notNull(),
    epochStart: timestamp("epoch_start", { withTimezone: true }),
    epochEnd: timestamp("epoch_end", { withTimezone: true }),
    lockTokenId: text("lock_token_id"),
    voteContextJson: jsonb("vote_context_json").$type<Record<string, unknown>>().notNull().default({}),
    rewardContextJson: jsonb("reward_context_json").$type<Record<string, unknown>>().notNull().default({}),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_governance_epochs_uidx").on(table.chainId, table.walletAddress, table.epochId, table.lockTokenId),
    index("engine_v2_governance_epochs_wallet_idx").on(table.chainId, table.walletAddress, table.epochStart),
  ],
);

export const engineV2GovernanceClaimBatches = pgTable(
  "engine_v2_governance_claim_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainEventId: uuid("domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    claimSurface: varchar("claim_surface", { length: 48 }).notNull(),
    itemCount: integer("item_count").notNull().default(0),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_governance_claim_batches_uidx").on(table.chainId, table.walletAddress, table.txHash, table.claimSurface),
  ],
);

export const engineV2GovernanceClaimItems = pgTable(
  "engine_v2_governance_claim_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainEventId: uuid("domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    itemIndex: integer("item_index").notNull(),
    rewardType: varchar("reward_type", { length: 32 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    valueUsdAtClaim: numeric("value_usd_at_claim", { precision: 38, scale: 18 }),
    lockTokenId: text("lock_token_id"),
    poolId: uuid("pool_id").references(() => pools.id, { onDelete: "set null" }),
    sourceContract: varchar("source_contract", { length: 42 }),
    affectsTotals: boolean("affects_totals").notNull().default(false),
    poolContribution: varchar("pool_contribution", { length: 24 }).notNull().default("unresolved"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_governance_claim_items_uidx").on(table.chainId, table.walletAddress, table.txHash, table.itemIndex),
    index("engine_v2_governance_claim_items_wallet_idx").on(table.chainId, table.walletAddress, table.rewardType),
  ],
);

export const engineV2DistributorPoolLinks = pgTable(
  "engine_v2_distributor_pool_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    distributorAddress: varchar("distributor_address", { length: 42 }).notNull(),
    poolAddress: varchar("pool_address", { length: 42 }).notNull(),
    gaugeAddress: varchar("gauge_address", { length: 42 }),
    distributorKind: varchar("distributor_kind", { length: 32 }).notNull(),
    sourceTxHash: varchar("source_tx_hash", { length: 66 }),
    sourceLogIndex: integer("source_log_index"),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_distributor_pool_links_uidx").on(table.chainId, table.distributorAddress),
    index("engine_v2_distributor_pool_links_pool_idx").on(table.chainId, table.poolAddress),
  ],
);

export const engineV2AccountingLots = pgTable(
  "engine_v2_accounting_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    sourceDomainEventId: uuid("source_domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    lotKind: varchar("lot_kind", { length: 48 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    valueUsdAtEvent: numeric("value_usd_at_event", { precision: 38, scale: 18 }),
    remainingAmountRaw: numeric("remaining_amount_raw", { precision: 78, scale: 0 }),
    entityType: varchar("entity_type", { length: 48 }),
    entityId: text("entity_id"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("engine_v2_accounting_lots_wallet_idx").on(table.chainId, table.walletAddress, table.tokenAddress),
    index("engine_v2_accounting_lots_entity_idx").on(table.chainId, table.entityType, table.entityId),
  ],
);

export const engineV2CashFlows = pgTable(
  "engine_v2_cash_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    sourceDomainEventId: uuid("source_domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    flowKind: varchar("flow_kind", { length: 48 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    valueUsdAtEvent: numeric("value_usd_at_event", { precision: 38, scale: 18 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("engine_v2_cash_flows_wallet_idx").on(table.chainId, table.walletAddress, table.occurredAt),
    index("engine_v2_cash_flows_event_idx").on(table.sourceDomainEventId),
  ],
);

export const engineV2Valuations = pgTable(
  "engine_v2_valuations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    sourceDomainEventId: uuid("source_domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 48 }),
    entityId: text("entity_id"),
    valuationKind: varchar("valuation_kind", { length: 32 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }),
    valueUsd: numeric("value_usd", { precision: 38, scale: 18 }),
    pricedAt: timestamp("priced_at", { withTimezone: true }),
    pricePointId: uuid("price_point_id").references(() => engineV2PricePoints.id, { onDelete: "set null" }),
    status: varchar("status", { length: 24 }).notNull().default("unknown"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    index("engine_v2_valuations_entity_idx").on(table.chainId, table.entityType, table.entityId),
    index("engine_v2_valuations_event_idx").on(table.sourceDomainEventId),
  ],
);

export const engineV2ResidualInventory = pgTable(
  "engine_v2_residual_inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    amountRaw: numeric("amount_raw", { precision: 78, scale: 0 }).notNull().default("0"),
    valueUsd: numeric("value_usd", { precision: 38, scale: 18 }),
    valuationStatus: varchar("valuation_status", { length: 24 }).notNull().default("unknown"),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("partial"),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(now).notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_residual_inventory_uidx").on(table.chainId, table.walletAddress, table.tokenAddress),
  ],
);

export const engineV2ReadModelRows = pgTable(
  "engine_v2_read_model_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    surface: varchar("surface", { length: 32 }).notNull(),
    rowKey: text("row_key").notNull(),
    sourceDomainEventId: uuid("source_domain_event_id").references(() => engineV2DomainEvents.id, { onDelete: "set null" }),
    coverageStatus: varchar("coverage_status", { length: 24 }).notNull().default("unknown"),
    confidence: varchar("confidence", { length: 16 }).notNull().default("unknown"),
    rowJson: jsonb("row_json").$type<Record<string, unknown>>().notNull().default({}),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    materializedAt: timestamp("materialized_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("engine_v2_read_model_rows_uidx").on(table.chainId, table.walletAddress, table.surface, table.rowKey),
    index("engine_v2_read_model_rows_surface_idx").on(table.chainId, table.walletAddress, table.surface),
  ],
);

export type AnalysisRun = typeof analysisRuns.$inferSelect;
