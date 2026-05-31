import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";

function loadLocalEnvFile() {
  const envFilePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) return;

  for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function getRequiredAddress() {
  const value = (process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("WALLET_ADDRESS_OR_TEST_ADDRESS_MISSING");
  }
  return value.toLowerCase();
}

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value) throw new Error("DATABASE_URL_MISSING");
  return value;
}

async function main() {
  loadLocalEnvFile();
  const walletAddress = getRequiredAddress();
  const chainId = Number(process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });
  await client.connect();

  try {
    const run = await client.query<{ id: string }>(
      `select id from analysis_runs
       where wallet_address = $1 and chain_id = $2
       order by created_at desc
       limit 1`,
      [walletAddress, chainId],
    );
    const runId = run.rows[0]?.id ?? null;
    if (!runId) throw new Error("ANALYSIS_RUN_NOT_FOUND");

    const result = await client.query(
      `insert into governance_metric_snapshots
        (run_id, chain_id, wallet_address, summary_json, selected_detail_json, coverage_status, confidence)
       select
        $3::uuid,
        $2::integer,
        $1::varchar,
        jsonb_build_object(
          'totalEvents', count(*),
          'eventTypes', coalesce(jsonb_object_agg(event_type, event_count), '{}'::jsonb),
          'lockedAero', null,
          'veAeroExposure', null,
          'governanceRewardsClaimedUsd', null,
          'estimatedGovernanceReturn', null
        ),
        null,
        case when count(*) = 0 then 'unavailable' else 'partial' end,
        case when count(*) = 0 then 'none' else 'medium' end
       from (
         select event_type, count(*) as event_count
         from governance_events
         where wallet_address = $1 and chain_id = $2
         group by event_type
       ) grouped`,
      [walletAddress, chainId, runId],
    );

    console.log(JSON.stringify({
      ok: true,
      walletAddress,
      chainId,
      runId,
      insertedMetricSnapshots: result.rowCount ?? 0,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
