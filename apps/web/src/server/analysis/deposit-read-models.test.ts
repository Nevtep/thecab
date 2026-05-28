import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategyIdByPoolId,
  deriveCoverageReasonCodes,
  deriveTimelineCoverageReasonCodes,
  mapTimelineEventToLifecycleType,
  resolveUsdValuation,
} from "@/server/analysis/deposit-read-models";

test("mapTimelineEventToLifecycleType excludes strategy lifecycle events from manual deposit timelines", () => {
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_deposit", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_withdraw", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
  assert.equal(
    mapTimelineEventToLifecycleType({ rawEventType: "strategy_claim", isOpeningEvent: false, openedByTransferIn: false }),
    null,
  );
});

test("buildStrategyIdByPoolId keeps the first strategy cross-link for each primary pool", () => {
  const strategyIdByPoolId = buildStrategyIdByPoolId([
    { strategyId: "strategy-1", primaryPoolId: "pool-1" },
    { strategyId: "strategy-2", primaryPoolId: "pool-1" },
    { strategyId: "strategy-3", primaryPoolId: "pool-2" },
    { strategyId: "strategy-4", primaryPoolId: null },
  ]);

  assert.equal(strategyIdByPoolId.get("pool-1"), "strategy-1");
  assert.equal(strategyIdByPoolId.get("pool-2"), "strategy-3");
  assert.equal(strategyIdByPoolId.has(""), false);
});

test("resolveUsdValuation marks missing historical prices as unavailable", () => {
  const resolved = resolveUsdValuation({
    occurredAt: new Date("2026-05-28T00:00:00.000Z"),
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    symbol: "AERO",
    amountRaw: "1000000000000000000",
    directAmountUsd: null,
    priceByTokenDay: new Map(),
  });

  assert.deepEqual(resolved, {
    usdValue: null,
    priceSource: "unavailable",
    reasonCodes: ["priceUnavailable"],
  });
});

test("timeline coverage reasons surface coverage gaps and degraded classification", () => {
  assert.deepEqual(
    deriveTimelineCoverageReasonCodes({
      valuationReasonCodes: ["priceUnavailable"],
      coverageStatus: "partial",
      confidence: "degraded",
    }),
    ["priceUnavailable", "coverageGap", "lowConfidenceClassification"],
  );
});

test("summary coverage reasons keep transfer-in and unattributed residual signals visible", () => {
  assert.deepEqual(
    deriveCoverageReasonCodes({ openedByTransferIn: true, coverageStatus: "partial" }),
    ["transferInOrigin", "unattributedResidual"],
  );
});