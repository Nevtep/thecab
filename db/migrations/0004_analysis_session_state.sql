CREATE TABLE IF NOT EXISTS analysis_session_states (
  analysis_session_id TEXT PRIMARY KEY REFERENCES analysis_sessions (analysis_session_id),
  latest_accepted_run_id TEXT,
  manual_positions_json JSONB NOT NULL,
  mellow_positions_json JSONB NOT NULL,
  pool_address_to_id_json JSONB NOT NULL,
  residual_holdings_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_session_states_latest_run_idx
  ON analysis_session_states (latest_accepted_run_id);