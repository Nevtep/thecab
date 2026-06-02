import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { ENGINE_V2_TRIGGER_TASK_IDS } from "@/server/trigger/tasks/engine-v2-index.task";
import { ANALYSIS_RUN_TASK_ID } from "@/server/trigger/tasks/analysis-run.task";

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

function parseArgs() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const walletArg = process.argv.find((arg) => arg.startsWith("--wallet="));
  const chainArg = process.argv.find((arg) => arg.startsWith("--chain-id="));
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--start");

  return {
    mode: modeArg?.slice("--mode=".length) ?? "fresh",
    walletAddress: walletArg?.slice("--wallet=".length) ?? process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS ?? "",
    chainId: Number(chainArg?.slice("--chain-id=".length) ?? process.env.CHAIN_ID ?? SUPPORTED_CHAIN_ID),
    dryRun,
  };
}

async function main() {
  loadLocalEnvFile();
  const args = parseArgs();

  if (!/^0x[a-fA-F0-9]{40}$/.test(args.walletAddress)) {
    throw new Error("WALLET_ADDRESS_MISSING_OR_INVALID");
  }
  if (!Number.isInteger(args.chainId) || args.chainId <= 0) {
    throw new Error("CHAIN_ID_MISSING_OR_INVALID");
  }

  const runId = process.env.ANALYSIS_RUN_ID ?? "manual-engine-v2-run";
  const taskPlan = ENGINE_V2_TRIGGER_TASK_IDS.map((taskId) => ({
    taskId,
    payload: {
      runId,
      walletAddress: args.walletAddress.toLowerCase(),
      chainId: args.chainId,
      mode: args.mode,
    },
    idempotencyKey: `${runId}:engine-v2:${taskId}`,
  }));

  console.log(JSON.stringify({
    ok: true,
    engine: "v2",
    command: "run",
    ...args,
    dryRun: args.dryRun,
    runId,
    taskPlan,
    startNote: args.dryRun
      ? "Dry-run only. Pass --start from an environment with Trigger credentials to enqueue externally."
      : `Validated Engine V2 task plan. Use ${ANALYSIS_RUN_TASK_ID} orchestration to enqueue the always-on Engine V2 pipeline.`,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
