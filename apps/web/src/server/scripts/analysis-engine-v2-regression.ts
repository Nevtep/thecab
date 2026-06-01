import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { runEngineV2Regression } from "@/server/analysis/engine-v2/regression/engine-v2-regression";
import { runKnownBugsRegression } from "@/server/analysis/engine-v2/regression/known-bugs-regression";

const DEFAULT_FIXTURE_DIR = "docs/api-research/moralis";

function resolveFixtureDir(input: string) {
  const fromCwd = resolve(process.cwd(), input);
  if (existsSync(fromCwd)) return fromCwd;
  return resolve(process.cwd(), "../..", input);
}

function parseArgs() {
  const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixtures="));
  const walletArg = process.argv.find((arg) => arg.startsWith("--wallet="));
  return {
    fixtureDir: resolveFixtureDir(fixtureArg?.slice("--fixtures=".length) ?? DEFAULT_FIXTURE_DIR),
    walletAddress: walletArg?.slice("--wallet=".length) ?? process.env.WALLET_ADDRESS ?? process.env.TEST_ADDRESS,
  };
}

async function main() {
  const args = parseArgs();
  if (!existsSync(args.fixtureDir)) {
    throw new Error(`FIXTURE_DIR_NOT_FOUND:${args.fixtureDir}`);
  }

  const regression = runEngineV2Regression({
    fixtureDirectory: args.fixtureDir,
    walletAddress: args.walletAddress,
  });
  const knownBugs = runKnownBugsRegression();
  console.log(JSON.stringify({ engine: "v2", command: "regression", ...args, ...regression, knownBugs }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
