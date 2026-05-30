import { expect, test, type Page } from "@playwright/test";

const walletAddress = "0x1111111111111111111111111111111111111111";

const readyAnalysisStatus = {
  walletAddress,
  chainId: 8453,
  status: "ready",
  runId: "run-strategies-ready",
  mode: "full_history",
  stage: "complete",
  progressPct: 100,
  lastSuccessfulRunAt: "2026-05-22T00:00:00.000Z",
  lastUpdatedAt: "2026-05-22T00:00:00.000Z",
  lastError: null,
  triggeredAtUtc: "2026-05-22T00:00:00.000Z",
  completedAtUtc: "2026-05-22T00:05:00.000Z",
  coverage: "share_level",
  coverageReasons: ["strategyShareLevelOnly"],
  phases: {},
  slices: [],
} as const;

const queuedAnalysisStatus = {
  ...readyAnalysisStatus,
  status: "queued",
  stage: "strategies",
  progressPct: 62,
  completedAtUtc: null,
} as const;

const strategiesListResponse = {
  walletAddress,
  chainId: 8453,
  analysisStatus: "ready",
  coveredRange: { startDayUtc: "2026-05-20", endDayUtc: "2026-05-28" },
  kpis: {
    currentStrategyValueUsd: 298889.15,
    activeStrategyCount: 1,
    totalClaimedRewardsUsd: 340.21,
    totalReturnUsd: 18930.46,
    protocolCoveragePct: 1,
    coverageStatus: "share_level",
    coverageReasonCodes: ["shareLevelAccounting"],
    trends: {},
  },
  filters: {
    applied: {},
    availablePools: [{ poolId: "pool-1", label: "WETH / cbBTC CL 100" }],
  },
  page: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
  strategies: [{
    id: "summary-1",
    strategyId: "strategy-1",
    strategyExposureId: "exposure-1",
    strategyLabel: "WETH / cbBTC-100",
    protocol: "mellow",
    primaryPoolId: "pool-1",
    poolLabel: "WETH / cbBTC CL 100",
    poolMappingStatus: "confirmed",
    status: "active",
    currentEstimatedValueUsd: 298889.15,
    depositedValueUsd: 279958.69,
    withdrawnValueUsd: 0,
    currentSharesRaw: "1842371",
    shareSymbol: "mlWETHcbBTC",
    totalRewardsUsd: 340.21,
    realizedPnlUsd: null,
    unrealizedPnlUsd: null,
    totalReturnUsd: 18930.46,
    totalReturnPct: 0.0676,
    estimatedAnnualizedReturnPct: 0.1766,
    coverageStatus: "share_level",
    confidence: "high",
    coverageReasonCodes: ["shareLevelAccounting"],
  }],
  selectedStrategy: {
    id: "summary-1",
    strategyId: "strategy-1",
    strategyExposureId: "exposure-1",
    strategyLabel: "WETH / cbBTC-100",
    protocol: "mellow",
    primaryPoolId: "pool-1",
    poolLabel: "WETH / cbBTC CL 100",
    poolMappingStatus: "confirmed",
    status: "active",
    currentEstimatedValueUsd: 298889.15,
    depositedValueUsd: 279958.69,
    withdrawnValueUsd: 0,
    currentSharesRaw: "1842371",
    sharesReceivedRaw: "1842371",
    sharesRedeemedRaw: "0",
    shareSymbol: "mlWETHcbBTC",
    totalRewardsUsd: 340.21,
    realizedPnlUsd: null,
    unrealizedPnlUsd: null,
    totalReturnUsd: 18930.46,
    totalReturnPct: 0.0676,
    estimatedAnnualizedReturnPct: 0.1766,
    coverageStatus: "share_level",
    confidence: "high",
    coverageReasonCodes: ["shareLevelAccounting"],
    wrapperAddress: null,
    stakingRewardsAddress: null,
    externalStrategyPositionReference: null,
    externalStrategyPositionReferenceStatus: "unresolved",
    resolvedRewardCount: 0,
    unresolvedRewardCount: 0,
    history: [],
    rewards: [],
    lifecycle: [],
    coverageNote: {
      status: "share_level",
      titleKey: "strategies:coverageNote.share_level.title",
      bodyKey: "strategies:coverageNote.share_level.body",
      reasonCodes: ["shareLevelAccounting"],
    },
  },
} as const;

async function authenticate(page: Page) {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.context().addCookies([
    { name: "cab_authenticated_address", value: walletAddress, url: baseUrl },
  ]);
}

test("strategies stays locked before analysis is ready", async ({ page }) => {
  await authenticate(page);
  await page.route(/\/api\/analysis\/status\?/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(queuedAnalysisStatus) });
  });
  await page.route(/\/api\/strategies\?/, async (route) => {
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "analysis_not_ready" } }) });
  });

  await page.goto("/strategies", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.getByText("Analysis required")).toBeVisible();
});

test("strategies renders the first-screen DataView shell", async ({ page }) => {
  await authenticate(page);
  await page.route(/\/api\/analysis\/status\?/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(readyAnalysisStatus) });
  });
  await page.route(/\/api\/strategies\?/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(strategiesListResponse) });
  });

  await page.goto("/strategies", { waitUntil: "networkidle", timeout: 120_000 });

  await expect(page.getByRole("heading", { name: "Strategies" })).toBeVisible();
  await expect(page.getByText("Current strategy value")).toBeVisible();
  await expect(page.getByPlaceholder("Search strategies")).toBeVisible();
  await expect(page.getByText("WETH / cbBTC-100").first()).toBeVisible();
  await expect(page.getByText("Share-level strategy coverage")).toBeVisible();
});
