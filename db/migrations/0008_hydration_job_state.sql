CREATE TABLE IF NOT EXISTS hydration_job_states (
  reconstruction_run_id TEXT NOT NULL REFERENCES reconstruction_runs(reconstruction_run_id),
  tx_hash TEXT NOT NULL,
  job_status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  leased_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reconstruction_run_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS hydration_job_states_run_status_idx
  ON hydration_job_states (reconstruction_run_id, job_status, next_retry_at);

CREATE INDEX IF NOT EXISTS hydration_job_states_lease_idx
  ON hydration_job_states (lease_owner, leased_at);
