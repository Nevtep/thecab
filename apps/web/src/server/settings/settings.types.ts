import type { AnalysisMode, AnalysisStatus } from "@/analysis/analysisStatus";
import type { AppLocale } from "@/i18n/locale";
import type { OverviewCoverageReasonCode, OverviewRange } from "@/server/overview/overview.types";

export type SettingsLanguage = AppLocale;

export const SETTINGS_PREFERENCE_KEYS = ["languagePreference", "defaultOverviewRange"] as const;

export type SettingsPreferenceKey = (typeof SETTINGS_PREFERENCE_KEYS)[number];

export type SettingsPersistedPreferences = {
  languagePreference: SettingsLanguage;
  defaultOverviewRange: OverviewRange;
};

export type SettingsPersistedPreferencePatch = Partial<SettingsPersistedPreferences>;

export type SettingsDerivedDiagnostics = {
  analysis: {
    status: AnalysisStatus;
    runId: string | null;
    lastSuccessfulRunAt: string | null;
    lastUpdatedAt: string | null;
    lastError: string | null;
  };
  overviewFreshness: {
    label: "recent_view" | "analyzed_view";
    lastAnalyzedAt: string | null;
  };
  coverage: {
    reasonCodes: OverviewCoverageReasonCode[];
  };
};

export type SettingsMeta = {
  fixedForMvp: {
    currency: "USD";
    theme: "cab-dark";
  };
  supportedLanguages: ReadonlyArray<SettingsLanguage>;
  supportedOverviewRanges: ReadonlyArray<OverviewRange>;
  supportedAnalysisModes: ReadonlyArray<AnalysisMode>;
};

export type SettingsResponse = {
  walletAddress: string;
  chainId: number;
  preferences: SettingsPersistedPreferences;
  diagnostics: SettingsDerivedDiagnostics;
  meta: SettingsMeta;
};

export type SettingsUpdateRequest = {
  walletAddress: string;
  chainId: number;
  preferences: SettingsPersistedPreferencePatch;
};