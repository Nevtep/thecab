ALTER TABLE wallet_discovery_checkpoints
  ADD COLUMN IF NOT EXISTS provider_states JSONB;
