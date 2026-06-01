import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("Engine V2 CLI commands expose run/regression and guarded purge entry points", () => {
  const runSource = readFileSync(resolve(process.cwd(), "src/server/scripts/analysis-engine-v2-run.ts"), "utf8");
  const regressionSource = readFileSync(resolve(process.cwd(), "src/server/scripts/analysis-engine-v2-regression.ts"), "utf8");
  const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const purgeSource = readFileSync(resolve(process.cwd(), "src/server/scripts/db-purge.ts"), "utf8");

  assert.match(packageJson, /analysis:v2:run/);
  assert.match(packageJson, /analysis:v2:regression/);
  assert.match(runSource, /fresh|incremental|reanalysis|fixture/);
  assert.match(regressionSource, /runEngineV2Regression/);
  assert.match(purgeSource, /confirm-engine-v2-purge/);
});
