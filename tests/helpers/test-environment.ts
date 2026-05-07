import { runMigrations } from "@/infrastructure/db/migrate";
import { getSqlClient } from "@/infrastructure/db/client";

export function ensureTestEnvironment() {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/the_cab";
  process.env.BASE_RPC_URL ??= "https://mainnet.base.org";
  process.env.BASE_TRACE_RPC_URL ??= "";
  process.env.BASESCAN_API_BASE_URL ??= "https://api.etherscan.io/v2/api";
  process.env.BASESCAN_API_KEY ??= "";
  process.env.BASESCAN_PAGE_SIZE ??= "100";
  process.env.PRICE_PROVIDER_BASE_URL ??= "https://api.coingecko.com/api/v3";
  process.env.PRICE_PROVIDER_API_KEY ??= "";
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??= "test-project-id";
}

export async function prepareDatabase() {
  ensureTestEnvironment();
  await runMigrations();
}

export async function resetDatabase() {
  ensureTestEnvironment();
  const sql = getSqlClient();
  await sql.unsafe(`
    TRUNCATE TABLE
      ledger_record_sources,
      asset_movements,
      canonical_ledger_records,
      residual_holdings,
      discarded_activity,
      analysis_session_states,
      wallet_discovery_checkpoints,
      price_points,
      price_assets,
      raw_observations,
      reconstruction_runs,
      analysis_sessions
    RESTART IDENTITY CASCADE;
  `);
}