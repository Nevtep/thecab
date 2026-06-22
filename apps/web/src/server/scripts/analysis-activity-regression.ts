import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, ne, sql } from "drizzle-orm";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { closeDb, getDb } from "@/server/db/client";
import { engineV2ReadModelRows, ledgerEvents, rewardEvents } from "@/server/db/schema";
import { mapActivityLedgerRow, normalizeEngineV2ActivityRow } from "@/server/activity/activity.repository";

const PHISHING_AIRDROP_TX_HASH = "0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea";

type CheckResult = {
  name: string;
  passed: boolean;
  skipped?: boolean;
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

function normalizeWalletAddress() {
  const value = (process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS ?? process.argv[2] ?? "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function hasAirdropSpamEvidence(metadata: Record<string, unknown> | null) {
  return metadata?.economicExclusionReason === "airdrop_spam" ||
    metadata?.classificationReason === "airdrop_spam" ||
    (Array.isArray(metadata?.reasonCodes) && metadata.reasonCodes.includes("airdrop_spam"));
}

async function repairKnownPhishingAirdrop(input: {
  chainId: number;
  walletAddress: string | null;
}) {
  const db = getDb();
  const clauses = [
    eq(rewardEvents.chainId, input.chainId),
    eq(rewardEvents.txHash, PHISHING_AIRDROP_TX_HASH),
    ne(rewardEvents.resolutionStatus, "excluded"),
  ];
  if (input.walletAddress) clauses.push(eq(rewardEvents.walletAddress, input.walletAddress));

  return db
    .update(rewardEvents)
    .set({
      resolutionStatus: "excluded",
      resolutionBasis: "excluded_airdrop_spam",
      resolutionReasonCodes: sql`array(select distinct unnest(coalesce(${rewardEvents.resolutionReasonCodes}, '{}'::text[]) || array['excludedAirdrop','airdrop_spam']::text[]))`,
      depositOrStrategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      metadataJson: sql`coalesce(${rewardEvents.metadataJson}, '{}'::jsonb) || jsonb_build_object('sourceSurface', 'airdrop_spam', 'surfaceKind', 'airdrop_spam', 'economicComponentKind', 'excluded_airdrop')`,
    })
    .where(and(...clauses))
    .returning({
      id: rewardEvents.id,
      walletAddress: rewardEvents.walletAddress,
      rewardType: rewardEvents.rewardType,
      resolutionStatus: rewardEvents.resolutionStatus,
      resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
    });
}

async function main() {
  loadLocalEnvFile();

  const chainId = Number(process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  const walletAddress = normalizeWalletAddress();
  const repair = process.argv.includes("--repair");

  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      status: "skipped",
      reason: "DATABASE_URL_MISSING",
      chainId,
      walletAddress,
      checks: [],
    }, null, 2));
    return;
  }

  const db = getDb();

  try {
    const repairedRows = repair
      ? await repairKnownPhishingAirdrop({ chainId, walletAddress })
      : [];

    const ledgerWhere = walletAddress
      ? and(
        eq(ledgerEvents.chainId, chainId),
        eq(ledgerEvents.walletAddress, walletAddress),
        eq(ledgerEvents.txHash, PHISHING_AIRDROP_TX_HASH),
      )
      : and(
        eq(ledgerEvents.chainId, chainId),
        eq(ledgerEvents.txHash, PHISHING_AIRDROP_TX_HASH),
      );
    const rewardWhere = walletAddress
      ? and(
        eq(rewardEvents.chainId, chainId),
        eq(rewardEvents.walletAddress, walletAddress),
        eq(rewardEvents.txHash, PHISHING_AIRDROP_TX_HASH),
      )
      : and(
        eq(rewardEvents.chainId, chainId),
        eq(rewardEvents.txHash, PHISHING_AIRDROP_TX_HASH),
      );

    const [ledgerRows, rewardRows] = await Promise.all([
      db
        .select({
          activityId: ledgerEvents.id,
          chainId: ledgerEvents.chainId,
          walletAddress: ledgerEvents.walletAddress,
          txHash: ledgerEvents.txHash,
          logIndex: ledgerEvents.logIndex,
          eventType: ledgerEvents.eventType,
          occurredAt: ledgerEvents.occurredAt,
          classification: ledgerEvents.classification,
          confidence: ledgerEvents.confidence,
          metadataJson: ledgerEvents.metadataJson,
        })
        .from(ledgerEvents)
        .where(ledgerWhere)
        .limit(20),
      db
        .select({
          id: rewardEvents.id,
          walletAddress: rewardEvents.walletAddress,
          rewardType: rewardEvents.rewardType,
          resolutionStatus: rewardEvents.resolutionStatus,
          resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
          resolvedPoolId: rewardEvents.resolvedPoolId,
          amountUsd: rewardEvents.amountUsd,
          metadataJson: rewardEvents.metadataJson,
        })
        .from(rewardEvents)
        .where(rewardWhere)
        .limit(20),
    ]);
    const engineV2ActivityRows = walletAddress
      ? await db
        .select({
          rowKey: engineV2ReadModelRows.rowKey,
          rowJson: engineV2ReadModelRows.rowJson,
        })
        .from(engineV2ReadModelRows)
        .where(and(
          eq(engineV2ReadModelRows.chainId, chainId),
          eq(engineV2ReadModelRows.walletAddress, walletAddress),
          eq(engineV2ReadModelRows.surface, "activity"),
        ))
      : [];

    const mappedLedgerRows = ledgerRows.map((row) => mapActivityLedgerRow(row, []));
    const deterministicEngineV2Rows = engineV2ActivityRows
      .map((row) => ({
        rowKey: row.rowKey,
        rawAction: typeof row.rowJson.action === "string" ? row.rowJson.action : null,
        mapped: normalizeEngineV2ActivityRow(row.rowJson),
      }))
      .filter((row) => row.rawAction?.startsWith("approval_") ||
        row.rawAction === "failed_transaction" ||
        row.rawAction === "manual_position_created");
    const deterministicEngineV2AmbiguousRows = deterministicEngineV2Rows
      .filter((row) => row.mapped.action === "ambiguous");
    const checks: CheckResult[] = [
      {
        name: "phishing_airdrop_fixture_present",
        passed: mappedLedgerRows.length > 0 || rewardRows.length > 0,
        skipped: mappedLedgerRows.length === 0 && rewardRows.length === 0,
        details: {
          txHash: PHISHING_AIRDROP_TX_HASH,
          ledgerRows: mappedLedgerRows.length,
          rewardRows: rewardRows.length,
        },
      },
      {
        name: "phishing_airdrop_activity_is_excluded",
        passed: mappedLedgerRows.length === 0 ||
          mappedLedgerRows.every((row) => row.action === "airdrop" && row.coverage === "excluded"),
        skipped: mappedLedgerRows.length === 0,
        details: mappedLedgerRows.map((row) => ({
          activityId: row.activityId,
          walletAddress: row.walletAddress,
          action: row.action,
          coverage: row.coverage,
          confidence: row.confidence,
          reasonCodes: row.reasonCodes,
        })),
      },
      {
        name: "phishing_airdrop_has_explicit_spam_evidence",
        passed: ledgerRows.length === 0 || ledgerRows.every((row) => hasAirdropSpamEvidence(row.metadataJson)),
        skipped: ledgerRows.length === 0,
        details: ledgerRows.map((row) => ({
          activityId: row.activityId,
          metadataJson: row.metadataJson,
        })),
      },
      {
        name: "phishing_airdrop_is_not_resolved_reward",
        passed: rewardRows.every((row) => row.resolutionStatus === "excluded"),
        skipped: rewardRows.length === 0,
        details: rewardRows.map((row) => ({
          id: row.id,
          walletAddress: row.walletAddress,
          rewardType: row.rewardType,
          resolutionStatus: row.resolutionStatus,
          resolutionReasonCodes: row.resolutionReasonCodes,
          resolvedPoolId: row.resolvedPoolId,
          amountUsd: row.amountUsd,
          metadataJson: row.metadataJson,
        })),
      },
      {
        name: "excluded_phishing_reward_does_not_contribute_to_pool_totals",
        passed: rewardRows.every((row) => row.resolutionStatus !== "excluded" || row.resolvedPoolId === null),
        skipped: rewardRows.length === 0,
        details: rewardRows.map((row) => ({
          id: row.id,
          resolutionStatus: row.resolutionStatus,
          resolvedPoolId: row.resolvedPoolId,
          amountUsd: row.amountUsd,
        })),
      },
      {
        name: "engine_v2_deterministic_activity_actions_do_not_map_to_ambiguous",
        passed: deterministicEngineV2AmbiguousRows.length === 0,
        skipped: deterministicEngineV2Rows.length === 0,
        details: deterministicEngineV2AmbiguousRows.slice(0, 50).map((row) => ({
          rowKey: row.rowKey,
          rawAction: row.rawAction,
          mappedAction: row.mapped.action,
          summary: row.mapped.summary,
          surface: row.mapped.surface,
          coverage: row.mapped.coverage,
        })),
      },
    ];

    const failedChecks = checks.filter((check) => !check.skipped && !check.passed);
    const fixtureSkipped = checks[0]?.skipped === true;
    const status = failedChecks.length > 0 ? "failed" : fixtureSkipped ? "skipped" : "passed";

    console.log(JSON.stringify({
      status,
      chainId,
      walletAddress,
      txHash: PHISHING_AIRDROP_TX_HASH,
      repairedRows,
      checks,
    }, null, 2));

    if (failedChecks.length > 0) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ECONNREFUSED") || message.includes("DATABASE_URL")) {
      console.log(JSON.stringify({
        status: "skipped",
        reason: message,
        chainId,
        walletAddress,
        checks: [],
      }, null, 2));
      return;
    }
    throw error;
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
