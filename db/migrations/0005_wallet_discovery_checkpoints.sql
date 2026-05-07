CREATE TABLE IF NOT EXISTS wallet_discovery_checkpoints (
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  provider_key TEXT NOT NULL,
  latest_indexed_block BIGINT,
  latest_hydrated_block BIGINT,
  latest_accepted_block BIGINT,
  provider_cursor TEXT,
  pending_reconstruction_run_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, chain_id)
);

CREATE INDEX IF NOT EXISTS wallet_discovery_checkpoints_latest_accepted_block_idx
  ON wallet_discovery_checkpoints (chain_id, latest_accepted_block);

CREATE INDEX IF NOT EXISTS wallet_discovery_checkpoints_pending_run_idx
  ON wallet_discovery_checkpoints (pending_reconstruction_run_id);