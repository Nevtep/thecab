"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import {
  CabAnalysisCta,
  CabAnalysisStatusBadge,
  CabButton,
  CabCard,
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabRangeSelector,
  CabSectionHeader,
  CabSidebar,
  CabSidebarNavItem,
  CabStack,
  CabText,
  CabTopNav,
  ConnectedShell,
} from "@/design-system";
import { getOverviewNavigationItems } from "@/features/settings/settings.mappers";
import { buildSettingsDiagnosticsRows, resolveSettingsScreenState } from "@/features/settings/settings.view";
import { mapOverviewAnalysisStatusToBadgeStatus } from "@/features/overview/overview.mappers";

import type { SettingsViewModel } from "@/features/settings/settings.types";

type SettingsComponentProps = {
  walletStatus: "connected" | "connecting" | "reconnecting" | "disconnected";
  isConnected: boolean;
  isSupportedChain: boolean;
  viewModel: SettingsViewModel | null;
  isLoading: boolean;
  errorCode: string | null;
  isRefreshingOverview: boolean;
  isStartingAnalysis: boolean;
  onRetry: () => void;
  onLanguageChange: (language: "en" | "es") => void;
  onDefaultOverviewRangeChange: (range: "24h" | "7d" | "30d") => void;
  onRefreshOverview: () => void;
  onDisconnect: () => void;
  onStartAnalysis: (mode: "full_history" | "incremental") => void;
  onSwitchChain: () => void;
};

function renderValue(value: string | null, fallback: string) {
  return value ?? fallback;
}

export function SettingsComponent({
  walletStatus,
  isConnected,
  isSupportedChain,
  viewModel,
  isLoading,
  errorCode,
  isRefreshingOverview,
  isStartingAnalysis,
  onRetry,
  onLanguageChange,
  onDefaultOverviewRangeChange,
  onRefreshOverview,
  onDisconnect,
  onStartAnalysis,
  onSwitchChain,
}: SettingsComponentProps) {
  const router = useRouter();
  const { t } = useTranslation(["settings", "navigation", "overview", "wallet", "analysis"]);
  const screenState = resolveSettingsScreenState({
    walletStatus,
    isConnected,
    isSupportedChain,
    viewModel,
    isLoading,
    errorCode,
  });

  if (screenState === "disconnected") {
    return (
      <section data-settings-root>
        <CabEmptyState
          title={t("overview:states.disconnectedTitle")}
          description={t("overview:states.disconnectedDescription")}
        />
      </section>
    );
  }

  if (screenState === "unsupportedChain") {
    return (
      <section data-settings-root>
        <CabEmptyState
          title={t("overview:states.unsupportedChainTitle")}
          description={t("overview:states.unsupportedChainDescription")}
          actionLabel={t("overview:actions.switchNetwork")}
          onAction={onSwitchChain}
        />
      </section>
    );
  }

  if (screenState === "loading") {
    return (
      <section data-settings-root>
        <CabLoadingPanel label={t("settings:states.loading")} />
      </section>
    );
  }

  if (screenState === "error") {
    return (
      <section data-settings-root>
        <CabErrorPanel
          title={t("settings:states.errorTitle")}
          description={t(`settings:states.errors.${errorCode}`, {
            defaultValue: t("settings:states.errorDescription"),
          })}
          retryLabel={t("overview:actions.refresh")}
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (screenState === "empty") {
    return (
      <section data-settings-root>
        <CabEmptyState
          title={t("settings:states.emptyTitle")}
          description={t("settings:states.emptyDescription")}
        />
      </section>
    );
  }

  if (!viewModel) {
    return null;
  }

  const navigationItems = getOverviewNavigationItems(viewModel.analysisSection.status);
  const unavailableValue = t("settings:states.unavailable");
  const analysisPrimaryAction = viewModel.analysisSection.primaryAction;
  const diagnosticsRows = buildSettingsDiagnosticsRows(viewModel.diagnosticsSection, t);

  return (
    <section data-settings-root>
      <ConnectedShell
        sidebar={
          <CabSidebar
            header={
              <CabText variant="heading" fontSize={18}>
                {t("settings:title")}
              </CabText>
            }
          >
            <CabStack gap="$2">
              {navigationItems.map((item) => (
                <CabSidebarNavItem
                  key={item.key}
                  iconName={item.iconName}
                  label={t(item.labelKey)}
                  state={item.stateKey}
                  stateLabel={item.stateKey === "active" ? undefined : t(`navigation:states.${item.stateKey}`)}
                  disabled={item.disabled}
                  onPress={item.href ? () => router.push(item.href!) : undefined}
                />
              ))}
            </CabStack>
          </CabSidebar>
        }
        topBar={<CabTopNav title={t("settings:title")} />}
      >
        <CabStack gap="$4">
          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader title={t("settings:sections.wallet.title")} />
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.address")}</CabText>
                <CabText variant="label">{viewModel.walletSection.addressDisplay}</CabText>
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.chain")}</CabText>
                <CabText variant="label">
                  {viewModel.walletSection.chainLabel} ({viewModel.walletSection.chainId})
                </CabText>
              </CabStack>
              <CabStack row gap="$2" flexWrap="wrap">
                <CabButton
                  tone="secondary"
                  onPress={onRefreshOverview}
                  disabled={isRefreshingOverview || isStartingAnalysis}
                >
                  {viewModel.walletSection.actions.refreshOverviewLabel}
                </CabButton>
                <CabButton tone="secondary" onPress={onDisconnect}>
                  {viewModel.walletSection.actions.disconnectLabel}
                </CabButton>
              </CabStack>
            </CabStack>
          </CabCard>

          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader title={t("settings:sections.analysis.title")} />
              <CabStack row alignItems="center" gap="$3" flexWrap="wrap">
                <CabAnalysisStatusBadge
                  status={mapOverviewAnalysisStatusToBadgeStatus(viewModel.analysisSection.status)}
                  label={viewModel.analysisSection.statusLabel}
                />
                <CabText variant="caption">{viewModel.analysisSection.statusLabel}</CabText>
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.lastSuccessfulRun")}</CabText>
                <CabText variant="label">
                  {renderValue(viewModel.analysisSection.lastSuccessfulRunAt, unavailableValue)}
                </CabText>
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.lastUpdated")}</CabText>
                <CabText variant="label">
                  {renderValue(viewModel.analysisSection.lastUpdatedAt, unavailableValue)}
                </CabText>
              </CabStack>
              <CabText variant="caption">{viewModel.analysisSection.message}</CabText>
              {analysisPrimaryAction.kind === "none" ? (
                <CabText variant="caption">{analysisPrimaryAction.progressLabel}</CabText>
              ) : (
                <CabAnalysisCta
                  label={analysisPrimaryAction.label}
                  disabled={analysisPrimaryAction.disabled || isRefreshingOverview}
                  onPress={() => onStartAnalysis(analysisPrimaryAction.mode)}
                />
              )}
            </CabStack>
          </CabCard>

          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader title={t("settings:sections.display.title")} />
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.language")}</CabText>
                <CabRangeSelector
                  options={viewModel.displaySection.language.options.map((option) => ({
                    key: option.value,
                    label: option.label,
                  }))}
                  selectedKey={viewModel.displaySection.language.value}
                  onSelect={(value) => onLanguageChange(value as "en" | "es")}
                  disabled={viewModel.displaySection.language.isPending}
                />
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.defaultOverviewRange")}</CabText>
                <CabRangeSelector
                  options={viewModel.displaySection.defaultOverviewRange.options.map((option) => ({
                    key: option.value,
                    label: option.label,
                  }))}
                  selectedKey={viewModel.displaySection.defaultOverviewRange.value}
                  onSelect={(value) => onDefaultOverviewRangeChange(value as "24h" | "7d" | "30d")}
                  disabled={viewModel.displaySection.defaultOverviewRange.isPending}
                />
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.currency")}</CabText>
                <CabText variant="label">{viewModel.displaySection.fixed.currencyLabel}</CabText>
                <CabText variant="caption">{viewModel.displaySection.fixed.currencyHelper}</CabText>
              </CabStack>
              <CabStack gap="$2">
                <CabText variant="caption">{t("settings:labels.theme")}</CabText>
                <CabText variant="label">{viewModel.displaySection.fixed.themeLabel}</CabText>
                <CabText variant="caption">{viewModel.displaySection.fixed.themeHelper}</CabText>
              </CabStack>
            </CabStack>
          </CabCard>

          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader title={t("settings:sections.diagnostics.title")} />
              {diagnosticsRows.map((row) => (
                <CabStack key={row.key} gap="$2">
                  <CabText variant="caption">{row.label}</CabText>
                  <CabText variant="label">{row.value}</CabText>
                </CabStack>
              ))}
            </CabStack>
          </CabCard>
        </CabStack>
      </ConnectedShell>
    </section>
  );
}