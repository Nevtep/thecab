CREATE TABLE IF NOT EXISTS analysis_sessions (
  analysis_session_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  connection_source TEXT NOT NULL,
  latest_accepted_run_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_sessions_wallet_chain_active_idx
  ON analysis_sessions (wallet_address, chain_id);

CREATE TABLE IF NOT EXISTS reconstruction_runs (
  reconstruction_run_id TEXT PRIMARY KEY,
  analysis_session_id TEXT NOT NULL REFERENCES analysis_sessions (analysis_session_id),
  run_mode TEXT NOT NULL,
  classifier_version TEXT NOT NULL,
  heuristics_version TEXT NOT NULL,
  from_block BIGINT,
  to_block BIGINT,
  checkpoint_block BIGINT,
  status TEXT NOT NULL,
  error_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reconstruction_runs_session_idx
  ON reconstruction_runs (analysis_session_id, started_at DESC);

CREATE TABLE IF NOT EXISTS raw_observations (
  raw_observation_id TEXT PRIMARY KEY,
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs (reconstruction_run_id),
  source_type TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  block_number BIGINT,
  block_hash TEXT,
  tx_hash TEXT,
  log_index INTEGER,
  trace_path TEXT,
  contract_address TEXT,
  payload_json JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS raw_observations_run_idx
  ON raw_observations (reconstruction_run_id, source_type);