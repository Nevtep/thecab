import { formatDateTime, formatRelativeTime } from "@/i18n/formatters";
import { formatWalletAddressLabel, getOverviewNavigationItems } from "@/features/overview/overview.mappers";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

import type { SettingsResponse, SettingsViewModel } from "@/features/settings/settings.types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ANALYSIS_ACTIONS_ENABLED = false;

export function mapSettingsResponseToViewModel(
  response: SettingsResponse,
  input: {
    locale: string;
    t: Translate;
    isRefreshingOverview: boolean;
    isStartingAnalysis: boolean;
    pendingPreferenceKey: "languagePreference" | "defaultOverviewRange" | null;
  },
): SettingsViewModel {
  const { locale, t, isRefreshingOverview, isStartingAnalysis, pendingPreferenceKey } = input;
  const languageValue = response.preferences.languagePreference;
  const rangeValue = response.preferences.defaultOverviewRange;
  const analysisStatus = response.diagnostics.analysis.status;

  return {
    walletSection: {
      address: response.walletAddress,
      addressDisplay: formatWalletAddressLabel(response.walletAddress),
      chainLabel: response.chainId === SUPPORTED_CHAIN_ID ? "Base" : String(response.chainId),
      chainId: response.chainId,
      actions: {
        refreshOverviewLabel: isRefreshingOverview
          ? t("overview:actions.refreshing")
          : t("settings:actions.refreshOverview"),
        disconnectLabel: t("wallet:actions.disconnect"),
        isRefreshing: isRefreshingOverview,
      },
    },
    analysisSection: {
      status: analysisStatus,
      statusLabel: t(`analysis:status.${analysisStatus}`),
      message: t(`analysis:messages.${analysisStatus}`),
      runId: response.diagnostics.analysis.runId,
      lastSuccessfulRunAt: response.diagnostics.analysis.lastSuccessfulRunAt
        ? formatDateTime(response.diagnostics.analysis.lastSuccessfulRunAt, locale)
        : null,
      lastUpdatedAt: response.diagnostics.analysis.lastUpdatedAt
        ? formatRelativeTime(response.diagnostics.analysis.lastUpdatedAt, locale)
        : null,
      primaryAction:
        analysisStatus === "not_analyzed"
          ? {
              kind: "start",
              mode: "full_history",
              label: isStartingAnalysis ? t("analysis:actions.starting") : t("analysis:actions.start"),
              disabled: !ANALYSIS_ACTIONS_ENABLED || isStartingAnalysis,
            }
          : analysisStatus === "failed"
            ? {
                kind: "retry",
                mode: "full_history",
                label: isStartingAnalysis ? t("analysis:actions.starting") : t("analysis:actions.retry"),
                disabled: !ANALYSIS_ACTIONS_ENABLED || isStartingAnalysis,
              }
            : analysisStatus === "ready" || analysisStatus === "stale"
              ? {
                  kind: "update",
                  mode: "incremental",
                  label: isStartingAnalysis ? t("analysis:actions.updating") : t("analysis:actions.update"),
                  disabled: !ANALYSIS_ACTIONS_ENABLED || isStartingAnalysis,
                }
              : { kind: "none", progressLabel: t(`analysis:messages.${analysisStatus}`) },
    },
    displaySection: {
      language: {
        value: languageValue,
        options: response.meta.supportedLanguages.map((supportedLanguage) => ({
          value: supportedLanguage,
          label: supportedLanguage.toUpperCase(),
        })),
        isPending: pendingPreferenceKey === "languagePreference",
      },
      defaultOverviewRange: {
        value: rangeValue,
        options: response.meta.supportedOverviewRanges.map((supportedRange) => ({
          value: supportedRange,
          label: t(`overview:ranges.${supportedRange}`),
        })),
        isPending: pendingPreferenceKey === "defaultOverviewRange",
      },
      fixed: {
        currencyLabel: t("settings:fixed.currencyValue"),
        currencyHelper: t("settings:fixed.helper"),
        themeLabel: t("settings:fixed.themeValue"),
        themeHelper: t("settings:fixed.helper"),
      },
    },
    diagnosticsSection: {
      analysisStatusLabel: t(`analysis:status.${analysisStatus}`),
      overviewFreshnessLabel: t(
        `settings:diagnostics.freshness.${response.diagnostics.overviewFreshness.label}`,
      ),
      coverageReasonLabels: response.diagnostics.coverage.reasonCodes.map((reasonCode) =>
        t(`overview:coverage.reasons.${reasonCode}`),
      ),
      coverageReasonCodes: response.diagnostics.coverage.reasonCodes,
      lastSuccessfulRunAt: response.diagnostics.analysis.lastSuccessfulRunAt
        ? formatDateTime(response.diagnostics.analysis.lastSuccessfulRunAt, locale)
        : null,
      lastUpdatedAt: response.diagnostics.analysis.lastUpdatedAt
        ? formatRelativeTime(response.diagnostics.analysis.lastUpdatedAt, locale)
        : null,
      runId: response.diagnostics.analysis.runId,
    },
    meta: {
      supportedAnalysisModes: response.meta.supportedAnalysisModes,
    },
  };
}

export { getOverviewNavigationItems };