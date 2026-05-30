import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";

function loadLocalEnvFile() {
  const envFilePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) {
    return;
  }

  for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getRequiredAddress(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }

  return value.toLowerCase();
}

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value) {
    throw new Error("DATABASE_URL_MISSING");
  }

  return value;
}

type DeleteStep = {
  label: string;
  query: string;
  values?: unknown[];
};

loadLocalEnvFile();

async function main() {
  const walletAddress = getRequiredAddress("TEST_ADDRESS");
  const chainId = SUPPORTED_CHAIN_ID;
  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });

  await client.connect();

  try {
    await client.query("BEGIN");

    const runIds = (await client.query<{ id: string }>(
      `select id from analysis_runs where wallet_address = $1 and chain_id = $2`,
      [walletAddress, chainId],
    )).rows.map((row) => row.id);

    const sliceIds = (await client.query<{ id: string }>(
      `select id from analysis_slices where wallet_address = $1 and chain_id = $2`,
      [walletAddress, chainId],
    )).rows.map((row) => row.id);

    const steps: DeleteStep[] = [
      {
        label: "raw_provider_records",
        query: `
          delete from raw_provider_records
          where (wallet_address = $1 and chain_id = $2)
            or run_id = any($3::uuid[])
            or slice_id = any($4::uuid[])
        `,
        values: [walletAddress, chainId, runIds, sliceIds],
      },
      {
        label: "coverage_reports",
        query: `delete from coverage_reports where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "wallet_contexts",
        query: `delete from wallet_contexts where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "processing_cursors",
        query: `delete from processing_cursors where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "reward_events",
        query: `delete from reward_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "performance_snapshots",
        query: `delete from performance_snapshots where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "portfolio_snapshots",
        query: `delete from portfolio_snapshots where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "pool_timeline_events",
        query: `delete from pool_timeline_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "pool_history_snapshots",
        query: `delete from pool_history_snapshots where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "pool_wallet_summaries",
        query: `delete from pool_wallet_summaries where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "strategy_lifecycle_events",
        query: `delete from strategy_lifecycle_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "strategy_history_snapshots",
        query: `delete from strategy_history_snapshots where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "strategy_wallet_summaries",
        query: `delete from strategy_wallet_summaries where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "deposit_lifecycle_events",
        query: `delete from deposit_lifecycle_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "deposit_performance_decompositions",
        query: `delete from deposit_performance_decompositions where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "deposit_wallet_summaries",
        query: `delete from deposit_wallet_summaries where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "governance_events",
        query: `delete from governance_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "discarded_events",
        query: `delete from discarded_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "inferred_actions",
        query: `delete from inferred_actions where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "approval_links",
        query: `delete from approval_links where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "attribution_source_lots",
        query: `delete from attribution_source_lots where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "attribution_states",
        query: `delete from attribution_states where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "asset_movements",
        query: `delete from asset_movements where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "ledger_events",
        query: `delete from ledger_events where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "processed_txs",
        query: `delete from processed_txs where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "strategy_exposures",
        query: `delete from strategy_exposures where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "deposits",
        query: `delete from deposits where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "analysis_slices",
        query: `delete from analysis_slices where wallet_address = $1 and chain_id = $2`,
      },
      {
        label: "analysis_runs",
        query: `delete from analysis_runs where wallet_address = $1 and chain_id = $2`,
      },
    ];

    const deleted: Record<string, number> = {};
    for (const step of steps) {
      const result = await client.query(step.query, step.values ?? [walletAddress, chainId]);
      deleted[step.label] = result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    console.log(JSON.stringify({
      ok: true,
      walletAddress,
      chainId,
      deleted,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
