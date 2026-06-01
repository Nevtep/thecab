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
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "complete", requestedMode: "full_history", nodeEnv: "production" }),
    true,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "complete", requestedMode: "full_history", nodeEnv: "production" }),
    false,
  );
});

test("development allows a same-day completed run to be superseded for rerun", () => {
  assert.equal(shouldEnforceCompletedRunDailyGate("development"), false);
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "complete", requestedMode: "full_history", nodeEnv: "development" }),
    false,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "complete", requestedMode: "full_history", nodeEnv: "development" }),
    true,
  );
});

test("non-complete same-day runs never use the completed-run policy", () => {
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "running", requestedMode: "full_history", nodeEnv: "production" }),
    false,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "queued", requestedMode: "full_history", nodeEnv: "development" }),
    false,
  );
});

test("incremental mode bypasses same-day completed-run reuse and supersede policies", () => {
  assert.equal(
    shouldReuseCompletedSameDayRun({ sameDayRunStatus: "complete", requestedMode: "incremental", nodeEnv: "production" }),
    false,
  );
  assert.equal(
    shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: "complete", requestedMode: "incremental", nodeEnv: "development" }),
    false,
  );
});