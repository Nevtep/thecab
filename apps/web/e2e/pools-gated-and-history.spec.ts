import { expect, test, type Page } from "@playwright/test";

const walletAddress = "0x1111111111111111111111111111111111111111";
const poolId = "pool-weth-cbbtc";

const readyAnalysisStatus = {
  walletAddress,
  chainId: 8453,
  status: "ready",
  runId: "run-pools-ready",
  mode: "full_history",
  stage: "complete",
  progressPct: 100,
  lastSuccessfulRunAt: "2026-05-22T00:00:00.000Z",
  lastUpdatedAt: "2026-05-22T00:00:00.000Z",
  lastError: null,
  triggeredAtUtc: "2026-05-22T00:00:00.000Z",
  completedAtUtc: "2026-05-22T00:05:00.000Z",
  coverage: "full",
  coverageReasons: [],
  phases: {
    deposits: { status: "complete" },
    rewards: { status: "complete" },
    activity: { status: "complete" },
    pools: { status: "complete" },
    finalize: { status: "complete" },
  },
  slices: [],
} as const;

const queuedAnalysisStatus = {
  ...readyAnalysisStatus,
  status: "queued",
  stage: "pools",
  progressPct: 62,
  completedAtUtc: null,
} as const;

const poolsListResponse = {
  walletAddress,
  chainId: 8453,
  analysisStatus: "ready",
  coveredRange: {
    startDayUtc: "2026-02-22",
    endDayUtc: "2026-05-22",
  },
  summary: {
    poolCount: 2,
    activePoolCount: 2,
    activeInRangePoolCount: 1,
    currentAttributedValueUsd: 18450.22,
    totalRewardsUsd: 942.17,
    weightedAnnualizedReturnPct: 17.6,
    series: {
      activePoolCount: [2, 2, 2, 2],
      currentAttributedValueUsd: [16320.12, 17014.28, 17780.41, 18450.22],
      totalRewardsUsd: [712.15, 801.44, 873.19, 942.17],
      estimatedAnnualizedReturnPct: [14.8, 15.9, 16.7, 17.6],
    },
    coverageStatus: "share_level",
    coverageReasonCodes: ["strategyShareLevelOnly"],
  },
  items: [
    {
      poolId,
      label: "WETH / cbBTC",
      poolAddress: "0xpool000000000000000000000000000000000001",
      tokenSymbols: ["WETH", "cbBTC"],
      feeTierLabel: "0.05%",
      protocolFamily: "aerodrome",
      status: "active",
      exposureMix: "mixed",
      currentAttributedValueUsd: 12450.22,
      capitalEnteredUsd: 9400,
      capitalWithdrawnUsd: 2100,
      realizedPnlUsd: 510.44,
      unrealizedPnlUsd: 742.11,
      totalRewardsUsd: 642.17,
      annualizedReturnPct: 19.3,
      isInRange: true,
      coverageStatus: "share_level",
      coverageReasonCodes: ["strategyShareLevelOnly"],
      latestActivityAt: "2026-05-22T10:30:00.000Z",
      strategyLabels: ["Mellow WETH/cbBTC"],
      metricsEstimated: true,
    },
    {
      poolId: "pool-aero-usdc",
      label: "AERO / USDC",
      poolAddress: "0xpool000000000000000000000000000000000002",
      tokenSymbols: ["AERO", "USDC"],
      feeTierLabel: "0.3%",
      protocolFamily: "aerodrome",
      status: "active",
      exposureMix: "manual",
      currentAttributedValueUsd: 6000,
      capitalEnteredUsd: 5200,
      capitalWithdrawnUsd: 400,
      realizedPnlUsd: 114.33,
      unrealizedPnlUsd: 230.72,
      totalRewardsUsd: 300,
      annualizedReturnPct: 14.1,
      isInRange: false,
      coverageStatus: "full",
      coverageReasonCodes: [],
      latestActivityAt: "2026-05-21T14:10:00.000Z",
      strategyLabels: [],
      metricsEstimated: false,
    },
  ],
  page: {
    nextCursor: null,
    hasMore: false,
  },
} as const;

const poolDetailResponse = {
  walletAddress,
  chainId: 8453,
  analysisStatus: "ready",
  coveredRange: {
    startDayUtc: "2026-02-22",
    endDayUtc: "2026-05-22",
  },
  selectedRange: "90d",
  header: {
    poolId,
    label: "WETH / cbBTC",
    poolAddress: "0xpool000000000000000000000000000000000001",
    tokenSymbols: ["WETH", "cbBTC"],
    feeTierLabel: "0.05%",
    status: "active",
    currentAttributedValueUsd: 12450.22,
    capitalEnteredUsd: 9400,
    capitalWithdrawnUsd: 2100,
    totalRewardsUsd: 642.17,
    realizedPnlUsd: 510.44,
    unrealizedPnlUsd: 742.11,
    annualizedReturnPct: 19.3,
    coverageStatus: "share_level",
    coverageReasonCodes: ["strategyShareLevelOnly"],
    strategyLabels: ["Mellow WETH/cbBTC"],
    metricsEstimated: true,
  },
  segments: {
    manual: { currentValueUsd: 5300.12, coverageStatus: "full" },
    strategy: { currentValueUsd: 6840.44, coverageStatus: "share_level" },
    residual: { currentValueUsd: 309.66, coverageStatus: "partial" },
  },
  currentComposition: [
    { tokenSymbol: "WETH", amount: 1.42, valueUsd: 5140.11, segment: "manual" },
    { tokenSymbol: "cbBTC", amount: 0.11, valueUsd: 6999.22, segment: "strategy" },
  ],
  history: {
    points: [
      {
        dayUtc: "2026-05-20",
        totalValueUsd: 11820.1,
        deployedValueUsd: 10880.22,
        residualValueUsd: 240.15,
        manualValueUsd: 5220.11,
        strategyValueUsd: 5660.11,
        rewardValueUsd: 521.18,
        cumulativeRewardsUsd: 521.18,
        capitalInUsd: 0,
        capitalOutUsd: 0,
        metadata: {},
      },
      {
        dayUtc: "2026-05-22",
        totalValueUsd: 12450.22,
        deployedValueUsd: 11590.56,
        residualValueUsd: 309.66,
        manualValueUsd: 5300.12,
        strategyValueUsd: 6840.44,
        rewardValueUsd: 642.17,
        cumulativeRewardsUsd: 642.17,
        capitalInUsd: 0,
        capitalOutUsd: 0,
        metadata: {},
      },
    ],
    coverageStatus: "share_level",
    coverageReasonCodes: ["strategyShareLevelOnly"],
  },
  timeline: {
    items: [
      {
        eventKey: "rebalance-1",
        eventType: "rebalance",
        occurredAt: "2026-05-22T10:30:00.000Z",
        confidence: "high",
        coverageStatus: "full",
        attributedValueUsd: 480.22,
        relatedDepositId: "deposit-1",
        relatedStrategyId: null,
        metadata: {},
      },
    ],
    nextCursor: null,
    hasMore: false,
  },
  related: {
    deposits: [{ id: "deposit-1", label: "Aerodrome NFT #1" }],
    strategies: [{ id: "strategy-1", label: "Mellow WETH/cbBTC" }],
  },
} as const;

async function authenticate(page: Page) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  await page.context().addCookies([
    {
      name: "cab_authenticated_address",
      value: walletAddress,
      url: baseUrl,
    },
  ]);
}

async function mockReadyPoolsRoutes(page: Page) {
  await page.route(/\/api\/analysis\/status\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(readyAnalysisStatus),
    });
  });

  await page.route(new RegExp(`/api/pools/${poolId}\\?`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(poolDetailResponse),
    });
  });

  await page.route(/\/api\/pools\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(poolsListResponse),
    });
  });
}

test("pools stays locked before analysis is ready", async ({ page }) => {
  await authenticate(page);
  await page.route(/\/api\/analysis\/status\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(queuedAnalysisStatus),
    });
  });
  await page.route(/\/api\/pools\?/, async (route) => {
    await route.fulfill({
      status: 423,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "analysis_required" } }),
    });
  });

  await page.goto("/pools", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.getByText("Pools unlocks after analysis")).toBeVisible();
});

test("pools opens the side detail panel from the list", async ({ page }) => {
  await authenticate(page);
  await mockReadyPoolsRoutes(page);

  await page.goto("/pools", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.getByText("WETH / cbBTC").first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();

  await expect(page).toHaveURL(new RegExp(`/pools/${poolId}$`));
  await expect(page.getByText("Pool detail")).toBeVisible();
  await expect(page.getByText("Pool value evolution")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close detail" })).toBeVisible();

  await page.getByRole("button", { name: "Close detail" }).click();
  await expect(page).toHaveURL(/\/pools$/);
});

test("direct pool detail routes render the integrated pools workspace", async ({ page }) => {
  await authenticate(page);
  await mockReadyPoolsRoutes(page);

  await page.goto(`/pools/${poolId}`, { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.getByText("Pool detail")).toBeVisible();
  await expect(page.getByText("WETH / cbBTC").first()).toBeVisible();
  await expect(page.getByText("Timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close detail" })).toBeVisible();
});