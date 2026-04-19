import { runMigrations } from "@/infrastructure/db/migrate";
import { getSqlClient } from "@/infrastructure/db/client";

export function ensureTestEnvironment() {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/the_cab";
  process.env.BASE_RPC_URL ??= "https://mainnet.base.org";
  process.env.BASE_TRACE_RPC_URL ??= "";
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
      raw_observations,
      reconstruction_runs,
      analysis_sessions
    RESTART IDENTITY CASCADE;
  `);
}