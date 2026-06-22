import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";

type ReadModelRow = {
  surface: string;
  row_key: string;
  coverage_status: string;
  confidence: string;
  row_json: Record<string, unknown>;
};

type CheckResult = {
  name: string;
  passed: boolean;
  skipped?: boolean;
  details: unknown;
};

const REVIEWED_WALLET = "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954";
const EXPECTED_OPEN_POOLS = 5;
const EXPECTED_CLOSED_POOLS = 2;

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

function getWalletAddress() {
  const value = (process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS ?? process.argv[2] ?? REVIEWED_WALLET).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("WALLET_ADDRESS_OR_TEST_ADDRESS_MISSING_OR_INVALID");
  }
  return value.toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function addCount(map: Map<string, number>, key: string, count = 1) {
  map.set(key, (map.get(key) ?? 0) + count);
}

function countEntries(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) addCount(counts, value || "unknown");
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sumBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number) {
  const sums = new Map<string, { count: number; valueUsd: number }>();
  for (const item of items) {
    const group = key(item) || "unknown";
    const current = sums.get(group) ?? { count: 0, valueUsd: 0 };
    current.count += 1;
    current.valueUsd += value(item);
    sums.set(group, current);
  }
  return Object.fromEntries([...sums.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }
  return 0;
}

function poolCurrentValue(row: Record<string, unknown>) {
  return firstNumber(row, [
    "currentAttributedValueUsd",
    "currentValueUsd",
    "totalValueUsd",
    "capitalInvestedUsd",
  ]);
}

function poolComponentValue(row: Record<string, unknown>, key: string) {
  const value = asNumber(row[key]);
  return value ?? 0;
}

function rewardValue(row: Record<string, unknown>) {
  return firstNumber(row, ["usdValueAtClaim", "valueUsd", "amountUsd"]);
}

function rewardOwner(row: Record<string, unknown>) {
  const owner = asRecord(row.owner);
  return asString(owner.status) ??
    asString(row.sourceSurface) ??
    asString(row.ownerKind) ??
    "unknown";
}

function governanceKind(row: Record<string, unknown>) {
  return asString(row.kind) ?? "unknown";
}

function summarizePools(poolRows: ReadModelRow[]) {
  const byStatus = countEntries(poolRows.map((row) => asString(row.row_json.status) ?? "unknown"));
  const openRows = poolRows.filter((row) => {
    const status = (asString(row.row_json.status) ?? "").toLowerCase();
    return status === "active" || status === "open" || status === "inactive";
  });
  const closedRows = poolRows.filter((row) => (asString(row.row_json.status) ?? "").toLowerCase() === "closed");
  const totals = poolRows.reduce((acc, row) => {
    acc.currentValueUsd += poolCurrentValue(row.row_json);
    acc.manualValueUsd += poolComponentValue(row.row_json, "currentManualValueUsd");
    acc.strategyValueUsd += poolComponentValue(row.row_json, "currentStrategyValueUsd");
    acc.residualValueUsd += poolComponentValue(row.row_json, "currentResidualValueUsd");
    return acc;
  }, {
    currentValueUsd: 0,
    manualValueUsd: 0,
    strategyValueUsd: 0,
    residualValueUsd: 0,
  });

  return {
    totalPools: poolRows.length,
    openPools: openRows.length,
    closedPools: closedRows.length,
    byStatus,
    totals,
    topPoolsByCurrentValue: [...poolRows]
      .sort((left, right) => poolCurrentValue(right.row_json) - poolCurrentValue(left.row_json))
      .slice(0, 10)
      .map((row) => ({
        rowKey: row.row_key,
        label: row.row_json.label,
        status: row.row_json.status,
        currentValueUsd: poolCurrentValue(row.row_json),
        manualValueUsd: poolComponentValue(row.row_json, "currentManualValueUsd"),
        strategyValueUsd: poolComponentValue(row.row_json, "currentStrategyValueUsd"),
        residualValueUsd: poolComponentValue(row.row_json, "currentResidualValueUsd"),
      })),
  };
}

function summarizeRewards(rewardRows: ReadModelRow[]) {
  return {
    totalRewards: rewardRows.length,
    byOwner: sumBy(rewardRows, (row) => rewardOwner(row.row_json), (row) => rewardValue(row.row_json)),
    byToken: sumBy(
      rewardRows,
      (row) => asString(asRecord(row.row_json.token).symbol) ?? "unknown",
      (row) => rewardValue(row.row_json),
    ),
    unresolvedOrExcluded: rewardRows
      .filter((row) => {
        const coverage = asString(row.row_json.coverageState) ?? row.coverage_status;
        const poolContribution = asRecord(row.row_json.poolContribution);
        const poolStatus = asString(poolContribution.status);
        return coverage === "partial" || coverage === "unresolved" || poolStatus === "unresolved";
      })
      .slice(0, 20)
      .map((row) => ({
        rowKey: row.row_key,
        rewardType: row.row_json.rewardType,
        owner: rewardOwner(row.row_json),
        token: asRecord(row.row_json.token).symbol,
        valueUsd: rewardValue(row.row_json),
        coverageState: row.row_json.coverageState,
        reasonCodes: row.row_json.resolutionReasonCodes,
        poolContribution: row.row_json.poolContribution,
      })),
  };
}

function summarizeDeposits(depositRows: ReadModelRow[]) {
  const zeroRewardDeposits = depositRows
    .filter((row) => firstNumber(row.row_json, ["totalRewardsUsd"]) === 0)
    .map((row) => ({
      rowKey: row.row_key,
      depositId: row.row_json.depositId,
      poolLabel: row.row_json.poolLabel,
      status: row.row_json.status,
      openedAt: row.row_json.openedAt,
      closedAt: row.row_json.closedAt,
      totalRewardsUsd: firstNumber(row.row_json, ["totalRewardsUsd"]),
      coverageStatus: row.coverage_status,
      reasonCodes: row.row_json.coverageReasonCodes,
    }));

  return {
    totalDeposits: depositRows.length,
    zeroRewardDepositCount: zeroRewardDeposits.length,
    zeroRewardDeposits,
  };
}

function summarizeActivity(activityRows: ReadModelRow[]) {
  return {
    totalActivities: activityRows.length,
    byAction: countEntries(activityRows.map((row) => asString(row.row_json.action) ?? "unknown")),
    bySurface: countEntries(activityRows.map((row) => asString(row.row_json.surface) ?? "unknown")),
    deterministicRowsAtRisk: activityRows
      .filter((row) => {
        const action = asString(row.row_json.action) ?? "";
        return action.startsWith("approval_") ||
          action === "failed_transaction" ||
          action === "manual_position_created";
      })
      .reduce((acc, row) => {
        const action = asString(row.row_json.action) ?? "unknown";
        addCount(acc, action);
        return acc;
      }, new Map<string, number>()),
  };
}

function summarizeGovernance(governanceRows: ReadModelRow[]) {
  return {
    totalGovernanceRows: governanceRows.length,
    byKind: countEntries(governanceRows.map((row) => governanceKind(row.row_json))),
    byCoverage: countEntries(governanceRows.map((row) => row.coverage_status)),
    lockRows: governanceRows
      .filter((row) => governanceKind(row.row_json) === "lock")
      .map((row) => {
        const lockPanel = asRecord(row.row_json.lockPanel);
        return {
          rowKey: row.row_key,
          lockId: lockPanel.lockId ?? row.row_json.tokenId,
          status: lockPanel.status,
          lockedAeroAmount: lockPanel.lockedAeroAmount,
          veAeroExposure: lockPanel.veAeroExposure,
          reasonCodes: row.row_json.reasonCodes,
        };
      }),
  };
}

async function main() {
  loadLocalEnvFile();

  const walletAddress = getWalletAddress();
  const chainId = Number(process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });
  await client.connect();

  try {
    const result = await client.query<ReadModelRow>(`
      select surface, row_key, coverage_status, confidence, row_json
        from engine_v2_read_model_rows
       where chain_id = $1
         and wallet_address = $2
       order by surface, row_key
    `, [chainId, walletAddress]);

    const rows = result.rows;
    const rowsBySurface = new Map<string, ReadModelRow[]>();
    for (const row of rows) {
      const existing = rowsBySurface.get(row.surface) ?? [];
      existing.push(row);
      rowsBySurface.set(row.surface, existing);
    }

    const poolRows = rowsBySurface.get("pools") ?? [];
    const depositRows = rowsBySurface.get("deposits") ?? [];
    const rewardRows = rowsBySurface.get("rewards") ?? [];
    const activityRows = rowsBySurface.get("activity") ?? [];
    const governanceRows = rowsBySurface.get("governance") ?? [];
    const poolSummary = summarizePools(poolRows);
    const depositSummary = summarizeDeposits(depositRows);
    const rewardSummary = summarizeRewards(rewardRows);
    const activitySummary = summarizeActivity(activityRows);
    const governanceSummary = summarizeGovernance(governanceRows);
    const deterministicActivityAtRisk = Object.fromEntries([...activitySummary.deterministicRowsAtRisk.entries()].sort(([left], [right]) => left.localeCompare(right)));

    const checks: CheckResult[] = [
      {
        name: "engine_v2_read_models_exist",
        passed: rows.length > 0,
        details: { totalRows: rows.length },
      },
      {
        name: "reviewed_wallet_open_closed_pool_counts_match_expected",
        passed: walletAddress !== REVIEWED_WALLET ||
          (poolSummary.openPools === EXPECTED_OPEN_POOLS && poolSummary.closedPools === EXPECTED_CLOSED_POOLS),
        skipped: walletAddress !== REVIEWED_WALLET,
        details: {
          expected: { openPools: EXPECTED_OPEN_POOLS, closedPools: EXPECTED_CLOSED_POOLS },
          actual: { openPools: poolSummary.openPools, closedPools: poolSummary.closedPools },
          byStatus: poolSummary.byStatus,
        },
      },
      {
        name: "deterministic_activity_rows_are_present_for_mapper_regression",
        passed: Object.values(deterministicActivityAtRisk).some((count) => count > 0),
        details: deterministicActivityAtRisk,
      },
      {
        name: "zero_reward_deposits_are_reported_for_reward_reconciliation",
        passed: true,
        details: {
          totalDeposits: depositSummary.totalDeposits,
          zeroRewardDepositCount: depositSummary.zeroRewardDepositCount,
        },
      },
      {
        name: "governance_lock_rows_are_materialized",
        passed: governanceSummary.lockRows.length > 0,
        details: governanceSummary.lockRows,
      },
      {
        name: "governance_epoch_rows_are_materialized_when_votes_exist",
        passed: (governanceSummary.byKind.event ?? 0) === 0 || (governanceSummary.byKind.epoch ?? 0) > 0,
        details: governanceSummary.byKind,
      },
    ];

    const failedChecks = checks.filter((check) => !check.skipped && !check.passed);
    console.log(JSON.stringify({
      status: failedChecks.length > 0 ? "failed" : "passed",
      walletAddress,
      chainId,
      surfaceCounts: Object.fromEntries([...rowsBySurface.entries()]
        .map(([surface, surfaceRows]) => [surface, surfaceRows.length])
        .sort(([left], [right]) => String(left).localeCompare(String(right)))),
      pools: poolSummary,
      deposits: depositSummary,
      rewards: rewardSummary,
      activity: {
        ...activitySummary,
        deterministicRowsAtRisk: deterministicActivityAtRisk,
      },
      governance: governanceSummary,
      checks,
    }, null, 2));

    if (failedChecks.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
