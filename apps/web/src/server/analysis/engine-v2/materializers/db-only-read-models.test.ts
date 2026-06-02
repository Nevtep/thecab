import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { engineV2ReadModelsEnabled, persistReadModelRows, toReadModelRowValues } from "./index";

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
  assert.equal(engineV2ReadModelsEnabled(), true);
});

test("persistReadModelRows replaces stale rows for the touched surfaces before upserting", async () => {
  const calls: Array<{ kind: string; payload?: unknown }> = [];
  const db = {
    delete: () => ({
      where: async (condition: unknown) => {
        calls.push({ kind: "delete", payload: condition });
      },
    }),
    insert: () => ({
      values: (values: unknown[]) => ({
        onConflictDoUpdate: async (config: unknown) => {
          calls.push({ kind: "insert", payload: { values, config } });
        },
      }),
    }),
  };

  await persistReadModelRows({
    db,
    rows: [{
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      surface: "activity",
      rowKey: "row-1",
      coverageStatus: "full",
      confidence: "high",
      rowJson: { ok: true },
      evidenceJson: { txHash: "0xabc" },
    }],
  });

  assert.deepEqual(calls.map((call) => call.kind), ["delete", "insert"]);
});

test("persistReadModelRows skips writes when there are no rows", async () => {
  const calls: string[] = [];
  const db = {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => {
          calls.push("insert");
        },
      }),
    }),
  };

  await persistReadModelRows({
    db,
    rows: [],
  });

  assert.deepEqual(calls, []);
});
