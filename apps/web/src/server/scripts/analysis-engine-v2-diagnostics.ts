import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { buildEngineV2DiagnosticsArtifact } from "@/server/analysis/engine-v2/regression/diagnostics";
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
    throw new Error("WALLET_ADDRESS_OR_TEST_ADDRESS_MISSING_OR_INVALID");
  }
  return value.toLowerCase();
}

function getRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value) throw new Error("DATABASE_URL_MISSING");
  return value;
}

function parseArgs() {
  const chainArg = process.argv.find((arg) => arg.startsWith("--chain-id="));
  const selectorLimitArg = process.argv.find((arg) => arg.startsWith("--selector-limit="));
  const exampleLimitArg = process.argv.find((arg) => arg.startsWith("--example-limit="));

  return {
    walletAddress: getRequiredAddress(),
    chainId: Number(chainArg?.slice("--chain-id=".length) ?? process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID),
    selectorLimit: Number(selectorLimitArg?.slice("--selector-limit=".length) ?? 20),
    exampleLimit: Number(exampleLimitArg?.slice("--example-limit=".length) ?? 20),
  };
}

async function main() {
  loadLocalEnvFile();
  const args = parseArgs();

  if (!Number.isInteger(args.chainId) || args.chainId <= 0) {
    throw new Error("CHAIN_ID_MISSING_OR_INVALID");
  }

  const client = new pg.Client({ connectionString: getRequiredDatabaseUrl() });
  await client.connect();

  try {
    const rows = await client.query<{
      id: string;
      canonical_transaction_id: string;
      chain_id: number;
      wallet_address: string;
      tx_hash: string;
      occurred_at: Date | null;
      block_number: string | null;
      transaction_index: number | null;
      sequence_index: number;
      from_address: string | null;
      to_address: string | null;
      selector: string;
      contract_label: string | null;
      contract_name: string | null;
      decoded_function: string | null;
      decoded_args_json: unknown[];
      transfer_count: number;
      inbound_transfer_count: number;
      outbound_transfer_count: number;
      approval_count: number;
      classification: string;
      classifier_version: string;
      confidence: string;
      reason: string;
      needs_resolution: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `select
         id,
         canonical_transaction_id,
         chain_id,
         wallet_address,
         tx_hash,
         occurred_at,
         block_number,
         transaction_index,
         sequence_index,
         from_address,
         to_address,
         selector,
         contract_label,
         contract_name,
         decoded_function,
         decoded_args_json,
         transfer_count,
         inbound_transfer_count,
         outbound_transfer_count,
         approval_count,
         classification,
         classifier_version,
         confidence,
         reason,
         needs_resolution,
         created_at,
         updated_at
       from engine_v2_classified_transactions
       where chain_id = $1
         and wallet_address = $2
       order by occurred_at desc nulls last, sequence_index desc, tx_hash desc`,
      [args.chainId, args.walletAddress],
    );

    const artifact = buildEngineV2DiagnosticsArtifact({
      rows: rows.rows.map((row) => ({
        id: row.id,
        canonicalTransactionId: row.canonical_transaction_id,
        chainId: row.chain_id,
        walletAddress: row.wallet_address,
        txHash: row.tx_hash,
        occurredAt: row.occurred_at,
        blockNumber: row.block_number,
        transactionIndex: row.transaction_index,
        sequenceIndex: row.sequence_index,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        selector: row.selector,
        contractLabel: row.contract_label,
        contractName: row.contract_name,
        decodedFunction: row.decoded_function,
        decodedArgsJson: row.decoded_args_json,
        transferCount: row.transfer_count,
        inboundTransferCount: row.inbound_transfer_count,
        outboundTransferCount: row.outbound_transfer_count,
        approvalCount: row.approval_count,
        classification: row.classification,
        classifierVersion: row.classifier_version,
        confidence: row.confidence,
        reason: row.reason,
        needsResolution: row.needs_resolution,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      selectorLimit: args.selectorLimit,
      exampleLimit: args.exampleLimit,
    });

    console.log(JSON.stringify({
      ok: true,
      engine: "v2",
      command: "diagnostics",
      walletAddress: args.walletAddress,
      chainId: args.chainId,
      ...artifact,
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