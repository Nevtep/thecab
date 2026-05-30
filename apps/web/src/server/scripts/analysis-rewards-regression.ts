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

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value) throw new Error("DATABASE_URL_MISSING");
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
    const rewardStatusCounts = await client.query<{
      resolution_status: string;
      reward_count: string;
      rewards_usd: string;
    }>(`
      select resolution_status,
             count(*) as reward_count,
             coalesce(sum(amount_usd), 0) as rewards_usd
        from reward_events
       where chain_id = $1
         and wallet_address = $2
         and is_accrual_snapshot = false
       group by resolution_status
       order by resolution_status
    `, [chainId, walletAddress]);

    const missingChainIdentity = await client.query<{ id: string }>(`
      select id::text
        from reward_events
       where wallet_address = $1
         and (chain_id is null or chain_id <> $2)
       limit 20
    `, [walletAddress, chainId]);

    const strategyManualLeaks = await client.query<{
      id: string;
      tx_hash: string;
      deposit_or_strategy_id: string | null;
      strategy_exposure_id: string | null;
    }>(`
      select id::text,
             tx_hash,
             deposit_or_strategy_id::text,
             strategy_exposure_id::text
        from reward_events
       where chain_id = $1
         and wallet_address = $2
         and is_accrual_snapshot = false
         and strategy_exposure_id is not null
         and deposit_or_strategy_id in (
           select id from deposits where chain_id = $1 and wallet_address = $2
         )
       order by occurred_at, log_index
    `, [chainId, walletAddress]);

    const poolRewardDeltas = await client.query<{
      pool_id: string;
      pool_total: string;
      resolved_component_total: string;
      delta: string;
    }>(`
      with resolved_pool_rewards as (
        select resolved_pool_id as pool_id,
               coalesce(sum(amount_usd), 0) as rewards_usd
          from reward_events
         where chain_id = $1
           and wallet_address = $2
           and is_accrual_snapshot = false
           and resolution_status = 'resolved'
           and resolved_pool_id is not null
         group by resolved_pool_id
      )
      select pws.pool_id::text,
             pws.total_rewards_usd as pool_total,
             coalesce(rpr.rewards_usd, 0) as resolved_component_total,
             pws.total_rewards_usd - coalesce(rpr.rewards_usd, 0) as delta
        from pool_wallet_summaries pws
        left join resolved_pool_rewards rpr on rpr.pool_id = pws.pool_id
       where pws.chain_id = $1
         and pws.wallet_address = $2
       order by abs(pws.total_rewards_usd - coalesce(rpr.rewards_usd, 0)) desc
    `, [chainId, walletAddress]);

    const unresolvedWithoutReason = await client.query<{ id: string; tx_hash: string }>(`
      select id::text, tx_hash
        from reward_events
       where chain_id = $1
         and wallet_address = $2
         and is_accrual_snapshot = false
         and resolution_status in ('unresolved', 'excluded', 'unavailable')
         and cardinality(resolution_reason_codes) = 0
       order by occurred_at, log_index
       limit 20
    `, [chainId, walletAddress]);

    const excludedIncludedInPool = await client.query<{ id: string; tx_hash: string; resolved_pool_id: string | null }>(`
      select id::text, tx_hash, resolved_pool_id::text
        from reward_events
       where chain_id = $1
         and wallet_address = $2
         and is_accrual_snapshot = false
         and resolution_status = 'excluded'
         and resolved_pool_id is not null
       order by occurred_at, log_index
       limit 20
    `, [chainId, walletAddress]);

    const duplicateRewardIdentity = await client.query<{
      tx_hash: string;
      log_index: number;
      reward_type: string;
      duplicate_count: string;
    }>(`
      select tx_hash, log_index, reward_type, count(*) as duplicate_count
        from reward_events
       where chain_id = $1
         and wallet_address = $2
         and is_accrual_snapshot = false
       group by tx_hash, log_index, reward_type
      having count(*) > 1
       order by duplicate_count desc
    `, [chainId, walletAddress]);

    const failedPoolDeltas = poolRewardDeltas.rows.filter((row) => !withinTolerance(row.delta));
    const checks: CheckResult[] = [
      {
        name: "reward_events_exist_for_wallet_chain",
        passed: rewardStatusCounts.rows.length > 0,
        details: rewardStatusCounts.rows,
      },
      {
        name: "reward_events_are_chain_scoped",
        passed: missingChainIdentity.rows.length === 0,
        details: missingChainIdentity.rows,
      },
      {
        name: "strategy_rewards_do_not_leak_into_manual_deposits",
        passed: strategyManualLeaks.rows.length === 0,
        details: strategyManualLeaks.rows,
      },
      {
        name: "pool_reward_totals_equal_resolved_pool_rewards",
        passed: failedPoolDeltas.length === 0,
        details: poolRewardDeltas.rows,
      },
      {
        name: "unresolved_excluded_unavailable_rows_have_reason_codes",
        passed: unresolvedWithoutReason.rows.length === 0,
        details: unresolvedWithoutReason.rows,
      },
      {
        name: "excluded_rows_do_not_contribute_to_pool_totals",
        passed: excludedIncludedInPool.rows.length === 0,
        details: excludedIncludedInPool.rows,
      },
      {
        name: "reward_event_identity_is_deterministic",
        passed: duplicateRewardIdentity.rows.length === 0,
        details: duplicateRewardIdentity.rows,
      },
    ];

    const passed = checks.every((check) => check.passed);
    console.log(JSON.stringify({
      status: passed ? "passed" : "failed",
      walletAddress,
      chainId,
      checks,
    }, null, 2));

    if (!passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
