import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { engineV2ReadModelsEnabled, toReadModelRowValues } from "./index";

test("Engine V2 read-model adapter uses DB schema and does not import provider clients", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/analysis/engine-v2/materializers/read-model-adapters.ts"), "utf8");
  assert.match(source, /engineV2ReadModelRows/);
  assert.doesNotMatch(source, /moralis|alchemy|basescan|sourcify|lpsugar/i);
});

test("read model values carry chain, wallet, coverage, confidence, and evidence", () => {
  const value = toReadModelRowValues({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    surface: "activity",
    rowKey: "row-1",
    coverageStatus: "partial",
    confidence: "medium",
    rowJson: { ok: true },
    evidenceJson: { txHash: "0xabc" },
  });
  assert.equal(value.chainId, 8453);
  assert.equal(value.coverageStatus, "partial");
  assert.deepEqual(value.evidenceJson, { txHash: "0xabc" });
});

test("engineV2ReadModelsEnabled is explicitly gated", () => {
  assert.equal(engineV2ReadModelsEnabled({ ANALYSIS_ENGINE_V2_READ_MODELS: "0" }), false);
  assert.equal(engineV2ReadModelsEnabled({ ANALYSIS_ENGINE_V2_READ_MODELS: "1" }), true);
  assert.equal(engineV2ReadModelsEnabled({ ANALYSIS_ENGINE_VERSION: "v2" }), true);
});
