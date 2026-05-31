import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("governance repository stays inside DB-only request-time boundaries", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/governance/governance.repository.ts"), "utf8");

  assert.match(source, /from "@\/server\/db\/client"/);
  assert.match(source, /from "@\/server\/db\/schema"/);
  assert.doesNotMatch(source, /server\/providers/);
  assert.doesNotMatch(source, /moralis/i);
  assert.doesNotMatch(source, /alchemy/i);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /http/);
});

test("governance route stays provider-free and delegates to service", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/governance/governance.route.ts"), "utf8");

  assert.match(source, /getGovernanceDataView/);
  assert.doesNotMatch(source, /server\/providers/);
  assert.doesNotMatch(source, /moralis/i);
  assert.doesNotMatch(source, /alchemy/i);
  assert.doesNotMatch(source, /fetch\(/);
});
