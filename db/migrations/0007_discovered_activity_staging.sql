CREATE TABLE IF NOT EXISTS discovered_activities (
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs(reconstruction_run_id),
  tx_hash TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  provider_cursor TEXT,
  block_number_hint BIGINT,
  timestamp_hint TIMESTAMPTZ,
  hydration_status TEXT NOT NULL,
  error_summary TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hydrated_at TIMESTAMPTZ,
  PRIMARY KEY (reconstruction_run_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS discovered_activities_status_idx
  ON discovered_activities (reconstruction_run_id, hydration_status);

CREATE INDEX IF NOT EXISTS discovered_activities_provider_idx
  ON discovered_activities (provider_key, discovered_at);
