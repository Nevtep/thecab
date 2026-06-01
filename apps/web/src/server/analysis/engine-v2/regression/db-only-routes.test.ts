import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const requestTimeFiles = [
  "src/server/activity/activity.repository.ts",
  "src/server/deposits/deposits.repository.ts",
  "src/server/strategies/strategies.repository.ts",
  "src/server/pools/pools.repository.ts",
  "src/server/rewards/rewards.repository.ts",
  "src/server/governance/governance.repository.ts",
];

test("request-time DataView repositories do not import Engine V2 provider boundaries", () => {
  for (const file of requestTimeFiles) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const imports = source.split(/\r?\n/).filter((line) => line.trim().startsWith("import")).join("\n");
    assert.doesNotMatch(imports, /engine-v2\/providers|moralis-history|alchemy|basescan|sourcify|lpsugar/i, file);
    assert.match(source, /readEngineV2SurfaceRows|getDb|readAnalysisStatusContext/, file);
  }
});

test("request-time DataView repositories do not fall back to legacy tables when Engine V2 read models are enabled", () => {
  for (const file of requestTimeFiles) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /engineV2ReadModelsEnabled\(/, file);
  }
});
