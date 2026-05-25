import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldEnforceCompletedRunDailyGate,
  shouldReuseCompletedSameDayRun,
  shouldSupersedeCompletedSameDayRunForDevelopment,
} from "@/server/analysis/start-policy";

test("production enforces the same-day completed-run gate", () => {
  assert.equal(shouldEnforceCompletedRunDailyGate("production"), true);
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "complete", nodeEnv: "production" }),
    true,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "complete", nodeEnv: "production" }),
    false,
  );
});

test("development allows a same-day completed run to be superseded for rerun", () => {
  assert.equal(shouldEnforceCompletedRunDailyGate("development"), false);
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "complete", nodeEnv: "development" }),
    false,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "complete", nodeEnv: "development" }),
    true,
  );
});

test("non-complete same-day runs never use the completed-run policy", () => {
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "running", nodeEnv: "production" }),
    false,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "queued", nodeEnv: "development" }),
    false,
  );
});