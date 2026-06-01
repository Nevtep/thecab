import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { runChronologicalAccounting } from "@/server/analysis/engine-v2/accounting";
import { materializeAllDataViewRows, persistReadModelRows } from "@/server/analysis/engine-v2/materializers";
import { closeDb, getDb } from "@/server/db/client";
import { engineV2DomainEventLinks, engineV2DomainEvents } from "@/server/db/schema";

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

loadLocalEnvFile();

async function loadAccountingInput(input: { chainId: number; walletAddress: string }) {
  const db = getDb();
  const events = await db.select().from(engineV2DomainEvents).where(and(
    eq(engineV2DomainEvents.chainId, input.chainId),
    eq(engineV2DomainEvents.walletAddress, input.walletAddress.toLowerCase()),
  )).orderBy(asc(engineV2DomainEvents.occurredAt), asc(engineV2DomainEvents.sequenceIndex));
  const eventIds = events.map((event) => event.id);
  const links = eventIds.length > 0
    ? await db.select().from(engineV2DomainEventLinks).where(and(
      eq(engineV2DomainEventLinks.chainId, input.chainId),
      inArray(engineV2DomainEventLinks.domainEventId, eventIds),
    ))
    : [];

  return {
    events: events.map((event) => ({
      id: event.id,
      chainId: event.chainId,
      walletAddress: event.walletAddress,
      canonicalTransactionId: event.canonicalTransactionId,
      eventType: event.eventType,
      eventFamily: event.eventFamily,
      occurredAt: event.occurredAt,
      txHash: event.txHash,
      sequenceIndex: event.sequenceIndex,
      coverageStatus: event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: event.reasonCodes,
      valueEffectJson: event.valueEffectJson,
      evidenceJson: event.evidenceJson,
      metadataJson: event.metadataJson,
    })),
    links: links.map((link) => ({
      domainEventId: link.domainEventId,
      entityType: link.entityType,
      entityId: link.entityId,
      linkKind: link.linkKind,
      confidence: link.confidence,
      evidenceJson: link.evidenceJson,
    })),
  };
}

async function main() {
  const runId = process.env.RUN_ID ?? process.argv[2];
  if (!runId) {
    throw new Error("usage: RUN_ID=<runId> tsx src/server/scripts/rebuild-pool-read-models.ts");
  }

  const run = await getAnalysisRunById(runId);
  if (!run) {
    throw new Error(`run not found: ${runId}`);
  }

  const accounting = runChronologicalAccounting(await loadAccountingInput({
    chainId: run.chainId,
    walletAddress: run.walletAddress,
  }));
  const rows = materializeAllDataViewRows(accounting).filter((row) => row.surface === "pools");
  await persistReadModelRows({ db: getDb(), rows });

  console.log(
    JSON.stringify(
      {
        runId,
        walletAddress: run.walletAddress,
        chainId: run.chainId,
        surface: "pools",
        rowCount: rows.length,
        rowKeys: rows.map((row) => row.rowKey),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });