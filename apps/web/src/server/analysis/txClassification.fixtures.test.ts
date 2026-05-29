import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  CANDIDATE_SCHEMA_VERSION,
  decomposeTxEconomics,
  detectEconomicExclusionReason,
  isHistoryRecordEconomicallyExcluded,
  parseSurfaceKind,
} from "@/server/analysis/txClassification";
import {
  isMellowRewardRecord,
  resolveMellowRewardWrapperAddress,
} from "@/server/protocols/mellow/computeShareLevelAccounting";
import { resolveRewardOwnership } from "@/server/analysis/rewardResolution";

/**
 * These fixtures were pulled directly from Moralis `/wallets/:address/history`
 * for wallet `0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954` (Base) so each test
 * runs against the exact raw provider shape the production pipeline consumes.
 *
 * Buckets validated:
 *   - spam: provider-tagged airdrops that MUST be excluded before any reward
 *     candidate is generated.
 *   - aerodrome-v2-gauge: `getReward(address)` on a v2 Gauge (per-LP-address);
 *     the candidate must surface as `gauge_reward_unknown_surface` and resolve
 *     to `unresolved` + `unknownRewardSurface` until that surface is mapped.
 *   - mellow-wrapper-getrewards: LpWrapper `getRewards()` token receive; must
 *     be detected as a strategy reward and tagged with the wrapper address.
 *   - aerodrome-pool-claimfees: `Pool.claimFees()` token receive on a CL pool
 *     position; not yet a first-class `fee_claim` here (Phase 5) but the
 *     fixture is captured for those tests.
 *   - mellow-wrapper-withdraw: LpWrapper `withdraw()` with mixed reward +
 *     principal flows; fixture captured for Phase 4 decomposition tests.
 */
const FIXTURES_DIR = join(__dirname, "..", "protocols", "__fixtures__", "tx-history");

function loadFixture(slug: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, `${slug}.json`), "utf8"));
}

test("schema version is stamped on the taxonomy module", () => {
  assert.equal(CANDIDATE_SCHEMA_VERSION, 2);
});

test("parseSurfaceKind admits the recognized taxonomy values and rejects others", () => {
  assert.equal(parseSurfaceKind("gauge_reward_unknown_surface"), "gauge_reward_unknown_surface");
  assert.equal(parseSurfaceKind("manual_deposit_gauge_claim"), "manual_deposit_gauge_claim");
  assert.equal(parseSurfaceKind("strategy_wrapper_reward_claim"), "strategy_wrapper_reward_claim");
  assert.equal(parseSurfaceKind("pool_fee_claim_v2"), "pool_fee_claim_v2");
  assert.equal(parseSurfaceKind("not_a_surface"), null);
  assert.equal(parseSurfaceKind(undefined), null);
  assert.equal(parseSurfaceKind(123), null);
});

test("airdrop spam fixture (telegram pool) is excluded before reward candidate generation", () => {
  const record = loadFixture("airdrop-spam-telegram-pool");
  assert.equal(detectEconomicExclusionReason(record), "airdrop_spam");
  assert.equal(isHistoryRecordEconomicallyExcluded(record), true);
});

test("airdrop spam fixture (usdc lookalike) is excluded before reward candidate generation", () => {
  const record = loadFixture("airdrop-spam-usdc-lookalike");
  assert.equal(detectEconomicExclusionReason(record), "airdrop_spam");
  assert.equal(isHistoryRecordEconomicallyExcluded(record), true);
});

test("aerodrome v2 gauge getReward(address) fixtures are NOT excluded as spam", () => {
  // Spec: spam exclusion uses only the provider's explicit airdrop tag; it
  // must not drop legitimate reward inflows that lack a tokenId. Surface
  // classification is the right gate for those.
  for (const slug of ["aerodrome-v2-gauge-getreward-a", "aerodrome-v2-gauge-getreward-b"]) {
    const record = loadFixture(slug);
    assert.equal(detectEconomicExclusionReason(record), null, slug);
    assert.equal(isHistoryRecordEconomicallyExcluded(record), false, slug);
  }
});

test("mellow wrapper getRewards fixtures are detected as strategy rewards when wrapper is in currentWrappers", () => {
  for (const slug of ["mellow-wrapper-getrewards-a", "mellow-wrapper-getrewards-b"]) {
    const record = loadFixture(slug);
    const wrapperAddress = (record.to_address as string).toLowerCase();
    const resolvedWrapper = resolveMellowRewardWrapperAddress({
      record,
      currentWrappers: new Set([wrapperAddress]),
    });
    assert.equal(resolvedWrapper, wrapperAddress, slug);

    const detected = isMellowRewardRecord({
      detectedProtocol: "aerodrome",
      category: (record.category as string) ?? null,
      methodLabel: (record.method_label as string) ?? null,
      summary: (record.summary as string) ?? null,
      wrapperAddress: resolvedWrapper,
    });
    assert.equal(detected, true, slug);
  }
});

test("aerodrome pool claimFees fixture is NOT excluded and is admissible to the fee-claim pipeline", () => {
  const record = loadFixture("aerodrome-pool-claimfees");
  assert.equal(isHistoryRecordEconomicallyExcluded(record), false);
  assert.equal(record.method_label, "claimFees");
  // Two token inflows (e.g. USDC + WETH) confirm this is a paired-asset fee claim.
  assert.equal((record.erc20_transfers as unknown[])?.length, 2);
});

test("mellow wrapper withdraw fixture carries mixed reward + principal flows (Phase 4 decomposition input)", () => {
  const record = loadFixture("mellow-wrapper-withdraw");
  assert.equal(isHistoryRecordEconomicallyExcluded(record), false);
  assert.equal(record.method_label, "withdraw");
  const transfers = record.erc20_transfers as Array<Record<string, unknown>>;
  // AERO inflow (reward) + 2 underlying inflows (principal) + 1 share burn outflow.
  assert.equal(transfers.length, 4);
  const symbols = transfers.map((t) => t.token_symbol);
  assert.ok(symbols.includes("AERO"), `expected AERO inflow, got ${JSON.stringify(symbols)}`);

  const components = decomposeTxEconomics({
    txHash: String(record.hash),
    record,
    surfaceKind: "strategy_wrapper_withdraw",
    wrapperAddress: "0xb9db6804e84d960e139a2bdc33bfc30f8fb689fe",
  });
  assert.equal(components.length, 2);
  assert.equal(
    components.find((component) => component.kind === "reward_claim")?.tokenAddresses[0],
    "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
  );
  assert.deepEqual(
    components.find((component) => component.kind === "reward_claim")?.movementLogIndexes,
    [846],
  );
  assert.deepEqual(
    components.find((component) => component.kind === "strategy_close")?.movementLogIndexes,
    [833, 834],
  );
});

test("resolveRewardOwnership short-circuits gauge_reward_unknown_surface to unresolved + unknownRewardSurface", () => {
  const resolution = resolveRewardOwnership({
    candidate: {
      txHash: "0xbf1129574cc93a84c213991aada4dacf7672e9b08cfe1fbfc51d9cf7fc7b9a3a",
      occurredAt: new Date(),
      category: "token receive",
      summary: "Received 0.00557 AERO from 0x51...c025",
      protocol: "aerodrome",
      targetType: "deposit",
      targetTokenId: null,
      targetWrapperAddress: null,
      surfaceKind: "gauge_reward_unknown_surface",
    },
    depositTargets: [],
    strategyTargets: [],
  });

  assert.equal(resolution.resolutionStatus, "unresolved");
  assert.equal(resolution.resolutionBasis, "unresolved");
  assert.deepEqual(resolution.resolutionReasonCodes, ["unknownRewardSurface"]);
  assert.equal(resolution.depositId, null);
  assert.equal(resolution.strategyId, null);
});

test("resolveRewardOwnership short-circuits airdrop_spam surfaceKind to unresolved + excludedAirdrop", () => {
  const resolution = resolveRewardOwnership({
    candidate: {
      txHash: "0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea",
      occurredAt: new Date(),
      category: "airdrop",
      summary: "spam",
      protocol: null,
      targetType: null,
      targetTokenId: null,
      targetWrapperAddress: null,
      surfaceKind: "airdrop_spam",
    },
    depositTargets: [],
    strategyTargets: [],
  });

  assert.equal(resolution.resolutionStatus, "unresolved");
  assert.deepEqual(resolution.resolutionReasonCodes, ["excludedAirdrop"]);
});

test("resolveRewardOwnership without surfaceKind preserves legacy resolution path for manual deposit token id", () => {
  // Regression guard for Phase 3: surface-driven branches are additive; legacy
  // deposit-by-tokenId resolution must still match when surfaceKind is absent.
  const resolution = resolveRewardOwnership({
    candidate: {
      txHash: "0xfeed",
      occurredAt: new Date(),
      category: "collect",
      summary: "Collect",
      protocol: "aerodrome",
      targetType: "deposit",
      targetTokenId: "12345",
      targetWrapperAddress: null,
    },
    depositTargets: [
      {
        depositId: "00000000-0000-0000-0000-000000000001",
        poolId: "00000000-0000-0000-0000-000000000002",
        tokenId: "12345",
        protocol: "aerodrome",
      },
    ],
    strategyTargets: [],
  });

  assert.equal(resolution.resolutionStatus, "resolved");
  assert.equal(resolution.ownerType, "deposit");
  assert.equal(resolution.resolutionBasis, "explicit_token_id");
});
