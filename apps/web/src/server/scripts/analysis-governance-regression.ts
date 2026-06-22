import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { classifyGovernanceSurface } from "@/server/analysis/governance-classification";
import { SUPPORTED_CHAIN_ID } from "@/server/chains";

const AIRDROP_PHISHING_TX = "0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea";

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

async function repairKnownPhishingAirdrop(input: {
  client: pg.Client;
  walletAddress: string;
  chainId: number;
}) {
  const result = await input.client.query<{
    id: string;
    resolution_status: string;
    amount_usd: string | null;
  }>(
    `update reward_events
     set resolution_status = 'excluded',
         resolution_basis = 'excluded_airdrop_spam',
         resolution_reason_codes = array(
           select distinct unnest(
             coalesce(resolution_reason_codes, '{}'::text[])
             || array['excludedAirdrop','airdrop_spam']::text[]
           )
         ),
         deposit_or_strategy_id = null,
         strategy_exposure_id = null,
         resolved_pool_id = null,
         amount_usd = null,
         metadata_json = coalesce(metadata_json, '{}'::jsonb)
           || jsonb_build_object(
             'sourceSurface', 'airdrop_spam',
             'surfaceKind', 'airdrop_spam',
             'economicComponentKind', 'excluded_airdrop',
             'economicExclusionReason', 'airdrop_spam'
           )
     where wallet_address = $1
       and chain_id = $2
       and tx_hash = $3
       and resolution_status <> 'excluded'
     returning id, resolution_status, amount_usd`,
    [input.walletAddress, input.chainId, AIRDROP_PHISHING_TX],
  );

  return result.rows;
}

function assertClassifierFixture() {
  const vote = classifyGovernanceSurface({
    txHash: "0xfixture",
    surfaceKind: "governance_vote",
  });
  if (!vote.isGovernance || vote.eventType !== "vote_cast") {
    throw new Error("GOVERNANCE_CLASSIFIER_VOTE_FIXTURE_FAILED");
  }

  const routerOnly = classifyGovernanceSurface({
    txHash: "0xfixture-router",
    protocol: "1inch",
    summary: "Router swap WETH for cbBTC",
  });
  if (routerOnly.isGovernance) {
    throw new Error("GOVERNANCE_CLASSIFIER_ROUTER_FALSE_POSITIVE");
  }

  const airdrop = classifyGovernanceSurface({
    txHash: AIRDROP_PHISHING_TX,
    category: "airdrop",
    summary: "Phishing airdrop",
  });
  if (airdrop.isGovernance) {
    throw new Error("GOVERNANCE_CLASSIFIER_AIRDROP_FALSE_POSITIVE");
  }
}

async function main() {
  loadLocalEnvFile();
  assertClassifierFixture();

  const walletAddress = getRequiredAddress();
  const chainId = Number(process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  const repair = process.argv.includes("--repair");
  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });
  await client.connect();

  try {
    const repairedPhishingAirdropRows = repair
      ? await repairKnownPhishingAirdrop({ client, walletAddress, chainId })
      : [];
    const governance = await client.query<{ count: string }>(
      `select count(*)::text as count
       from governance_events
       where wallet_address = $1 and chain_id = $2`,
      [walletAddress, chainId],
    );
    const phishingReward = await client.query<{
      resolution_status: string;
      amount_usd: string | null;
      metadata_json: Record<string, unknown>;
    }>(
      `select resolution_status, amount_usd, metadata_json
       from reward_events
       where wallet_address = $1 and chain_id = $2 and tx_hash = $3`,
      [walletAddress, chainId, AIRDROP_PHISHING_TX],
    );
    const governanceGapEvents = await client.query<{
      id: string;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `select id, event_type, metadata_json
       from governance_events
       where wallet_address = $1
         and chain_id = $2
         and (
           metadata_json->>'coverageStatus' in ('partial','unresolved','unsupported','excluded','unavailable')
           or event_type in ('unsupported_governance','excluded_governance')
         )
       order by occurred_at desc
       limit 50`,
      [walletAddress, chainId],
    );
    const governanceGapRewards = await client.query<{
      id: string;
      coverage_status: string;
      evidence_json: Record<string, unknown>;
    }>(
      `select id, coverage_status, evidence_json
       from governance_reward_rows
       where wallet_address = $1
         and chain_id = $2
         and coverage_status in ('partial','unresolved','unsupported','excluded','unavailable')
       order by claimed_at desc
       limit 50`,
      [walletAddress, chainId],
    );
    const governanceKindCounts = await client.query<{
      kind: string | null;
      count: string;
    }>(
      `select row_json->>'kind' as kind, count(*)::text as count
       from engine_v2_read_model_rows
       where wallet_address = $1
         and chain_id = $2
         and surface = 'governance'
       group by row_json->>'kind'
       order by row_json->>'kind'`,
      [walletAddress, chainId],
    );
    const activeLockRowsMissingAmounts = await client.query<{
      row_key: string;
      lock_status: string | null;
      locked_aero_amount: string | null;
      ve_aero_exposure: string | null;
      reason_codes: string[] | null;
    }>(
      `select row_key,
              row_json #>> '{lockPanel,status}' as lock_status,
              row_json #>> '{lockPanel,lockedAeroAmount}' as locked_aero_amount,
              row_json #>> '{lockPanel,veAeroExposure}' as ve_aero_exposure,
              coalesce(array(select jsonb_array_elements_text(row_json #> '{lockPanel,reasonCodes}')), '{}') as reason_codes
       from engine_v2_read_model_rows
       where wallet_address = $1
         and chain_id = $2
         and surface = 'governance'
         and row_json->>'kind' = 'lock'
         and coalesce(row_json #>> '{lockPanel,status}', '') not in ('withdrawn', 'closed')
         and (
           nullif(row_json #>> '{lockPanel,lockedAeroAmount}', '') is null
           or nullif(row_json #>> '{lockPanel,veAeroExposure}', '') is null
         )
       order by row_key
       limit 25`,
      [walletAddress, chainId],
    );

    for (const row of phishingReward.rows) {
      if (row.resolution_status !== "excluded") {
        throw new Error("AIRDROP_PHISHING_TX_NOT_EXCLUDED");
      }
      if (row.amount_usd !== null) {
        throw new Error("AIRDROP_PHISHING_TX_STILL_COUNTS_USD");
      }
      if (row.metadata_json?.economicExclusionReason !== "airdrop_spam") {
        throw new Error("AIRDROP_PHISHING_TX_MISSING_EXCLUSION_REASON");
      }
    }
    for (const row of governanceGapEvents.rows) {
      if (!row.metadata_json?.selectedDetail) {
        throw new Error(`GOVERNANCE_GAP_EVENT_MISSING_SELECTED_DETAIL:${row.id}:${row.event_type}`);
      }
    }
    for (const row of governanceGapRewards.rows) {
      if (!row.evidence_json?.selectedDetail) {
        throw new Error(`GOVERNANCE_GAP_REWARD_MISSING_SELECTED_DETAIL:${row.id}:${row.coverage_status}`);
      }
    }

    const readModelKindCounts = Object.fromEntries(
      governanceKindCounts.rows.map((row) => [row.kind ?? "unknown", Number(row.count)]),
    );
    const undocumentedActiveLockRowsMissingAmounts = activeLockRowsMissingAmounts.rows.filter((row) => (
      !Array.isArray(row.reason_codes) || !row.reason_codes.includes("missingGovernanceCurrentState")
    ));
    const baselineChecks: CheckResult[] = [
      {
        name: "engine_v2_governance_lock_rows_document_missing_current_amounts",
        passed: undocumentedActiveLockRowsMissingAmounts.length === 0,
        details: activeLockRowsMissingAmounts.rows,
      },
      {
        name: "engine_v2_governance_epoch_rows_exist_when_events_exist",
        passed: (readModelKindCounts.event ?? 0) === 0 || (readModelKindCounts.epoch ?? 0) > 0,
        details: readModelKindCounts,
      },
    ];
    const failedBaselineChecks = baselineChecks.filter((check) => !check.passed);

    console.log(JSON.stringify({
      ok: failedBaselineChecks.length === 0,
      walletAddress,
      chainId,
      repairedPhishingAirdropRows: repairedPhishingAirdropRows.length,
      governanceEventCount: Number(governance.rows[0]?.count ?? 0),
      phishingAirdropRowsChecked: phishingReward.rows.length,
      governanceGapEventDetailsChecked: governanceGapEvents.rows.length,
      governanceGapRewardDetailsChecked: governanceGapRewards.rows.length,
      readModelKindCounts,
      baselineChecks,
    }, null, 2));

    if (failedBaselineChecks.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
