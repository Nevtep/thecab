import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { listRunSlices, resolveRunSliceDayWindow } from "@/server/analysis/analysis-slice.repository";
import { materializePoolReadModels } from "@/server/analysis/pool-read-models";
import { closeDb } from "@/server/db/client";

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

async function main() {
  const runId = process.env.RUN_ID ?? process.argv[2];
  if (!runId) {
    throw new Error("usage: RUN_ID=<runId> tsx src/server/scripts/rebuild-pool-read-models.ts");
  }

  const run = await getAnalysisRunById(runId);
  if (!run) {
    throw new Error(`run not found: ${runId}`);
  }

  const slices = await listRunSlices(runId);
  const { startDayUtc, endDayUtc } = resolveRunSliceDayWindow(slices, run.utcDayBucket);
  const result = await materializePoolReadModels({
    runId,
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    startDayUtc,
    endDayUtc,
    capturedAt: new Date(),
  });

  console.log(
    JSON.stringify(
      {
        runId,
        walletAddress: run.walletAddress,
        chainId: run.chainId,
        startDayUtc,
        endDayUtc,
        ...result,
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