import type { AnalysisMode, AnalysisStatus } from "@/analysis/analysisStatus";
import type { OverviewCoverageReasonCode, OverviewRange } from "@/server/overview/overview.types";
import type {
  SettingsPersistedPreferencePatch,
  SettingsPersistedPreferences,
  SettingsResponse,
  SettingsUpdateRequest,
} from "@/server/settings/settings.types";

export type {
  SettingsPersistedPreferencePatch,
  SettingsPersistedPreferences,
  SettingsResponse,
  SettingsUpdateRequest,
};

export type SettingsLanguage = "en" | "es";

export type SettingsQueryInput = {
  walletAddress: string;
  chainId: number;
};

export type SettingsViewModel = {
  walletSection: {
    address: string;
    addressDisplay: string;
    chainLabel: string;
    chainId: number;
    actions: {
      refreshOverviewLabel: string;
      disconnectLabel: string;
      isRefreshing: boolean;
    };
  };
  analysisSection: {
    status: AnalysisStatus;
    statusLabel: string;
    message: string;
    runId: string | null;
    lastSuccessfulRunAt: string | null;
    lastUpdatedAt: string | null;
    primaryAction:
      | { kind: "start"; mode: "full_history"; label: string; disabled: boolean }
      | { kind: "retry"; mode: "full_history"; label: string; disabled: boolean }
      | { kind: "update"; mode: "incremental"; label: string; disabled: boolean }
      | { kind: "none"; progressLabel: string };
  };
  displaySection: {
    language: {
      value: SettingsLanguage;
      options: ReadonlyArray<{ value: SettingsLanguage; label: string }>;
      isPending: boolean;
    };
    defaultOverviewRange: {
      value: OverviewRange;
      options: ReadonlyArray<{ value: OverviewRange; label: string }>;
      isPending: boolean;
    };
    fixed: {
      currencyLabel: string;
      currencyHelper: string;
      themeLabel: string;
      themeHelper: string;
    };
  };
  diagnosticsSection: {
    analysisStatusLabel: string;
    overviewFreshnessLabel: string;
    coverageReasonLabels: ReadonlyArray<string>;
    coverageReasonCodes: ReadonlyArray<OverviewCoverageReasonCode>;
    lastSuccessfulRunAt: string | null;
    lastUpdatedAt: string | null;
    runId: string | null;
  };
  meta: {
    supportedAnalysisModes: ReadonlyArray<AnalysisMode>;
  };
};