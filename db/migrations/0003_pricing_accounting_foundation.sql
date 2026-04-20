CREATE TABLE IF NOT EXISTS price_assets (
  price_asset_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  symbol TEXT,
  decimals INTEGER,
  provider_asset_key TEXT,
  alias_target_asset_id TEXT,
  pricing_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_assets_chain_token_idx
  ON price_assets (chain_id, token_address);

CREATE TABLE IF NOT EXISTS price_points (
  price_point_id TEXT PRIMARY KEY,
  price_asset_id TEXT NOT NULL REFERENCES price_assets (price_asset_id),
  quote_currency TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  price_value NUMERIC(36,18) NOT NULL,
  resolution TEXT NOT NULL,
  confidence TEXT NOT NULL,
  pricing_method TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_points_asset_source_effective_idx
  ON price_points (price_asset_id, source_kind, effective_at, pricing_method);

CREATE INDEX IF NOT EXISTS price_points_asset_effective_idx
  ON price_points (price_asset_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS price_points_asset_fetched_idx
  ON price_points (price_asset_id, fetched_at DESC);