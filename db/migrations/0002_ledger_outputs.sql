CREATE TABLE IF NOT EXISTS canonical_ledger_records (
  ledger_record_id TEXT PRIMARY KEY,
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs (reconstruction_run_id),
  analysis_session_id TEXT NOT NULL REFERENCES analysis_sessions (analysis_session_id),
  pool_id TEXT,
  strategy_id TEXT,
  position_instance_id TEXT,
  event_type TEXT NOT NULL,
  event_sequence INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  classification_confidence NUMERIC(5,4) NOT NULL,
  classifier_version TEXT NOT NULL,
  heuristics_version TEXT NOT NULL,
  explanation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS canonical_ledger_records_run_idx
  ON canonical_ledger_records (reconstruction_run_id, tx_hash, event_sequence);

CREATE TABLE IF NOT EXISTS ledger_record_sources (
  ledger_record_id TEXT NOT NULL REFERENCES canonical_ledger_records (ledger_record_id),
  raw_observation_id TEXT NOT NULL REFERENCES raw_observations (raw_observation_id),
  source_role TEXT NOT NULL,
  PRIMARY KEY (ledger_record_id, raw_observation_id)
);

CREATE TABLE IF NOT EXISTS asset_movements (
  asset_movement_id TEXT PRIMARY KEY,
  ledger_record_id TEXT NOT NULL REFERENCES canonical_ledger_records (ledger_record_id),
  token_address TEXT NOT NULL,
  symbol TEXT,
  amount_raw TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  direction TEXT NOT NULL,
  movement_role TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS asset_movements_record_idx
  ON asset_movements (ledger_record_id);

CREATE TABLE IF NOT EXISTS residual_holdings (
  residual_holding_id TEXT PRIMARY KEY,
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs (reconstruction_run_id),
  token_address TEXT NOT NULL,
  symbol TEXT,
  amount_raw TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  attribution_confidence NUMERIC(5,4) NOT NULL,
  candidate_pool_ids JSONB NOT NULL,
  latest_source_ledger_record_id TEXT,
  reason_code TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS residual_holdings_run_idx
  ON residual_holdings (reconstruction_run_id, token_address);

CREATE TABLE IF NOT EXISTS discarded_activity (
  discarded_activity_id TEXT PRIMARY KEY,
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs (reconstruction_run_id),
  analysis_session_id TEXT NOT NULL REFERENCES analysis_sessions (analysis_session_id),
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  reason_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_message TEXT NOT NULL,
  classifier_version TEXT NOT NULL,
  heuristics_version TEXT NOT NULL,
  source_observation_ids JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS discarded_activity_run_idx
  ON discarded_activity (reconstruction_run_id, tx_hash);