import assert from "node:assert/strict";
import test from "node:test";

import { mapSettingsResponseToViewModel } from "@/features/settings/settings.mappers";
import { buildSettingsDiagnosticsRows, resolveSettingsScreenState } from "@/features/settings/settings.view";
import type { SettingsResponse } from "@/features/settings/settings.types";

function translate(key: string) {
  return key;
}

function createSettingsResponse(overrides?: Partial<SettingsResponse>): SettingsResponse {
  return {
    walletAddress: "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954",
    chainId: 8453,
    preferences: {
      languagePreference: "en",
      defaultOverviewRange: "30d",
    },
    diagnostics: {
      analysis: {
        status: "ready",
        runId: null,
        lastSuccessfulRunAt: null,
        lastUpdatedAt: null,
        lastError: null,
      },
      overviewFreshness: {
        label: "analyzed_view",
        lastAnalyzedAt: null,
      },
      coverage: {
        reasonCodes: ["providerPartial", "missingPrices"],
      },
    },
    meta: {
      fixedForMvp: {
        currency: "USD",
        theme: "cab-dark",
      },
      supportedLanguages: ["en", "es"],
      supportedOverviewRanges: ["30d", "90d", "full_history"],
      supportedAnalysisModes: ["full_history", "incremental"],
    },
    ...overrides,
  };
}

test("resolveSettingsScreenState covers direct disconnected and unsupported visits", () => {
  assert.equal(
    resolveSettingsScreenState({
      walletStatus: "disconnected",
      isConnected: false,
      isSupportedChain: true,
      viewModel: null,
      isLoading: false,
      errorCode: null,
    }),
    "disconnected",
  );

  assert.equal(
    resolveSettingsScreenState({
      walletStatus: "connected",
      isConnected: true,
      isSupportedChain: false,
      viewModel: null,
      isLoading: false,
      errorCode: null,
    }),
    "unsupportedChain",
  );
});

test("mapSettingsResponseToViewModel preserves truthful coverage labels and disabled analysis CTA", () => {
  const viewModel = mapSettingsResponseToViewModel(createSettingsResponse(), {
    locale: "en",
    t: translate,
    isRefreshingOverview: false,
    isStartingAnalysis: false,
    pendingPreferenceKey: null,
  });

  assert.deepEqual(viewModel.diagnosticsSection.coverageReasonCodes, ["providerPartial", "missingPrices"]);
  assert.deepEqual(viewModel.diagnosticsSection.coverageReasonLabels, [
    "overview:coverage.reasons.providerPartial",
    "overview:coverage.reasons.missingPrices",
  ]);
  assert.equal(viewModel.analysisSection.primaryAction.kind, "update");
  assert.equal(viewModel.analysisSection.primaryAction.disabled, false);
});

test("buildSettingsDiagnosticsRows omits unsupported diagnostics fields while preserving visible coverage rows", () => {
  const viewModel = mapSettingsResponseToViewModel(createSettingsResponse(), {
    locale: "en",
    t: translate,
    isRefreshingOverview: false,
    isStartingAnalysis: false,
    pendingPreferenceKey: null,
  });

  const rows = buildSettingsDiagnosticsRows(viewModel.diagnosticsSection, translate);

  assert.deepEqual(
    rows.map((row) => row.key),
    ["analysisStatus", "overviewFreshness", "coverage"],
  );
  assert.equal(rows[2]?.value, "overview:coverage.reasons.providerPartial, overview:coverage.reasons.missingPrices");
});

test("buildSettingsDiagnosticsRows includes run metadata only when the system can derive it", () => {
  const viewModel = mapSettingsResponseToViewModel(
    createSettingsResponse({
      diagnostics: {
        analysis: {
          status: "failed",
          runId: "run_123",
          lastSuccessfulRunAt: "2026-05-24T12:00:00.000Z",
          lastUpdatedAt: "2026-05-24T12:30:00.000Z",
          lastError: "ANALYSIS_FAILED",
        },
        overviewFreshness: {
          label: "recent_view",
          lastAnalyzedAt: null,
        },
        coverage: {
          reasonCodes: [],
        },
      },
    }),
    {
      locale: "en",
      t: translate,
      isRefreshingOverview: false,
      isStartingAnalysis: false,
      pendingPreferenceKey: null,
    },
  );

  const rows = buildSettingsDiagnosticsRows(viewModel.diagnosticsSection, translate);

  assert.deepEqual(
    rows.map((row) => row.key),
    ["analysisStatus", "overviewFreshness", "lastSuccessfulRun", "lastUpdated", "runId"],
  );
});

test("mapSettingsResponseToViewModel keeps full, partial, and unknown analysis outcomes renderable", () => {
  const cases = [
    {
      status: "ready" as const,
      reasonCodes: [] as SettingsResponse["diagnostics"]["coverage"]["reasonCodes"],
      expectedAction: "update",
    },
    {
      status: "failed" as const,
      reasonCodes: ["providerPartial"] as SettingsResponse["diagnostics"]["coverage"]["reasonCodes"],
      expectedAction: "retry",
    },
    {
      status: "not_analyzed" as const,
      reasonCodes: [] as SettingsResponse["diagnostics"]["coverage"]["reasonCodes"],
      expectedAction: "start",
    },
  ];

  for (const testCase of cases) {
    const viewModel = mapSettingsResponseToViewModel(
      createSettingsResponse({
        diagnostics: {
          analysis: {
            status: testCase.status,
            runId: null,
            lastSuccessfulRunAt: null,
            lastUpdatedAt: null,
            lastError: null,
          },
          overviewFreshness: {
            label: "analyzed_view",
            lastAnalyzedAt: null,
          },
          coverage: {
            reasonCodes: testCase.reasonCodes,
          },
        },
      }),
      {
        locale: "en",
        t: translate,
        isRefreshingOverview: false,
        isStartingAnalysis: false,
        pendingPreferenceKey: null,
      },
    );

    assert.equal(viewModel.analysisSection.status, testCase.status);
    assert.equal(viewModel.analysisSection.primaryAction.kind, testCase.expectedAction);
    assert.deepEqual(viewModel.diagnosticsSection.coverageReasonCodes, testCase.reasonCodes);
  }
});