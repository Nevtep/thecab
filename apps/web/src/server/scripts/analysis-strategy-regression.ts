import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";

type CheckResult = {
  name: string;
  passed: boolean;
  details: unknown;
};

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

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value) {
    throw new Error("DATABASE_URL_MISSING");
  }
  return value;
}

function getRequiredWalletAddress() {
  const value = (process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS ?? process.argv[2] ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("WALLET_ADDRESS_OR_TEST_ADDRESS_MISSING_OR_INVALID");
  }
  return value.toLowerCase();
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function withinTolerance(value: unknown, tolerance = 0.01) {
  const parsed = parseNumber(value);
  return parsed !== null && Math.abs(parsed) <= tolerance;
}

async function main() {
  loadLocalEnvFile();

  const walletAddress = getRequiredWalletAddress();
  const chainId = Number(process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });

  await client.connect();

  try {
    const lifecycleByTx = await client.query<{
      tx_hash: string | null;
      event_count: string;
      event_types: string[];
      strategy_exposure_ids: string[];
    }>(`
      select tx_hash,
             count(*) as event_count,
             array_agg(event_type order by sequence_index) as event_types,
             array_agg(distinct strategy_exposure_id::text) as strategy_exposure_ids
        from strategy_lifecycle_events
       where chain_id = $1
         and wallet_address = $2
       group by tx_hash
       order by min(occurred_at), tx_hash nulls last
    `, [chainId, walletAddress]);

    const rewardTraceMismatches = await client.query<{
      lifecycle_event_id: string;
      reward_event_id: string | null;
      lifecycle_strategy_exposure_id: string;
      reward_strategy_exposure_id: string | null;
      tx_hash: string | null;
    }>(`
      select sle.id as lifecycle_event_id,
             re.id as reward_event_id,
             sle.strategy_exposure_id::text as lifecycle_strategy_exposure_id,
             re.strategy_exposure_id::text as reward_strategy_exposure_id,
             sle.tx_hash
        from strategy_lifecycle_events sle
        left join reward_events re on re.id = sle.source_reward_event_id
       where sle.chain_id = $1
         and sle.wallet_address = $2
         and sle.source_reward_event_id is not null
         and (
           re.id is null
           or re.strategy_exposure_id is null
           or re.strategy_exposure_id <> sle.strategy_exposure_id
         )
       order by sle.occurred_at, sle.sequence_index
    `, [chainId, walletAddress]);

    const depositStrategyRewardLeaks = await client.query<{
      reward_event_id: string;
      deposit_or_strategy_id: string | null;
      strategy_exposure_id: string | null;
      tx_hash: string | null;
    }>(`
      select re.id as reward_event_id,
             re.deposit_or_strategy_id::text,
             re.strategy_exposure_id::text,
             re.tx_hash
        from reward_events re
       where re.chain_id = $1
         and re.wallet_address = $2
         and re.is_accrual_snapshot = false
         and re.strategy_exposure_id is not null
         and re.deposit_or_strategy_id in (
           select id from deposits where chain_id = $1 and wallet_address = $2
         )
       order by re.occurred_at, re.log_index
    `, [chainId, walletAddress]);

    const poolRewardDeltas = await client.query<{
      pool_id: string;
      pool_total: string;
      deposit_total: string;
      strategy_total: string;
      delta: string;
    }>(`
      with deposit_rewards as (
        select d.pool_id,
               coalesce(sum(re.amount_usd), 0) as deposit_rewards_usd
          from reward_events re
          join deposits d on d.id = re.deposit_or_strategy_id
         where re.chain_id = $1
           and re.wallet_address = $2
           and re.is_accrual_snapshot = false
           and re.resolution_status = 'resolved'
           and re.strategy_exposure_id is null
         group by d.pool_id
      ),
      strategy_rewards as (
        select s.primary_pool_id as pool_id,
               coalesce(sum(re.amount_usd), 0) as strategy_rewards_usd
          from reward_events re
          join strategy_exposures se on se.id = re.strategy_exposure_id
          join strategies s on s.id = se.strategy_id
         where re.chain_id = $1
           and re.wallet_address = $2
           and re.is_accrual_snapshot = false
           and re.resolution_status = 'resolved'
           and re.strategy_exposure_id is not null
         group by s.primary_pool_id
      )
      select pws.pool_id::text,
             pws.total_rewards_usd as pool_total,
             coalesce(dr.deposit_rewards_usd, 0) as deposit_total,
             coalesce(sr.strategy_rewards_usd, 0) as strategy_total,
             pws.total_rewards_usd
               - coalesce(dr.deposit_rewards_usd, 0)
               - coalesce(sr.strategy_rewards_usd, 0) as delta
        from pool_wallet_summaries pws
        left join deposit_rewards dr on dr.pool_id = pws.pool_id
        left join strategy_rewards sr on sr.pool_id = pws.pool_id
       where pws.chain_id = $1
         and pws.wallet_address = $2
       order by abs(
         pws.total_rewards_usd
           - coalesce(dr.deposit_rewards_usd, 0)
           - coalesce(sr.strategy_rewards_usd, 0)
       ) desc
    `, [chainId, walletAddress]);

    const surfaceRewardTotals = await client.query<{
      surface: string;
      rewards_usd: string;
      reward_count: string;
    }>(`
      select 'deposits' as surface,
             coalesce(sum(total_rewards_usd), 0) as rewards_usd,
             count(*) as reward_count
        from deposit_wallet_summaries
       where chain_id = $1 and wallet_address = $2
      union all
      select 'strategies' as surface,
             coalesce(sum(total_rewards_usd), 0) as rewards_usd,
             count(*) as reward_count
        from strategy_wallet_summaries
       where chain_id = $1 and wallet_address = $2
      union all
      select 'pools' as surface,
             coalesce(sum(total_rewards_usd), 0) as rewards_usd,
             count(*) as reward_count
        from pool_wallet_summaries
       where chain_id = $1 and wallet_address = $2
    `, [chainId, walletAddress]);

    const lifecycleTxHashes = lifecycleByTx.rows
      .map((row) => row.tx_hash)
      .filter((txHash): txHash is string => Boolean(txHash));
    const failedPoolDeltas = poolRewardDeltas.rows.filter((row) => !withinTolerance(row.delta));
    const checks: CheckResult[] = [
      {
        name: "strategy_lifecycle_events_have_source_transactions",
        passed: lifecycleByTx.rows.length > 0 && lifecycleTxHashes.length > 0,
        details: lifecycleByTx.rows,
      },
      {
        name: "strategy_reward_lifecycle_rows_match_reward_owner",
        passed: rewardTraceMismatches.rows.length === 0,
        details: rewardTraceMismatches.rows,
      },
      {
        name: "deposit_rewards_do_not_carry_strategy_exposure_id",
        passed: depositStrategyRewardLeaks.rows.length === 0,
        details: depositStrategyRewardLeaks.rows,
      },
      {
        name: "pool_rewards_equal_deposit_plus_strategy_rewards",
        passed: failedPoolDeltas.length === 0,
        details: poolRewardDeltas.rows,
      },
      {
        name: "surface_reward_totals_available",
        passed: surfaceRewardTotals.rows.length === 3,
        details: surfaceRewardTotals.rows,
      },
    ];

    const passed = checks.every((check) => check.passed);
    console.log(JSON.stringify({
      status: passed ? "passed" : "failed",
      walletAddress,
      chainId,
      lifecycleTxHashesForManualReview: lifecycleTxHashes.slice(0, 10),
      checks,
    }, null, 2));

    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
