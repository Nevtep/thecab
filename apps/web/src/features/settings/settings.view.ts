import type { SettingsViewModel } from "@/features/settings/settings.types";

export type SettingsScreenState =
  | "disconnected"
  | "unsupportedChain"
  | "loading"
  | "error"
  | "empty"
  | "ready";

export type SettingsDiagnosticsRow = {
  key: "analysisStatus" | "overviewFreshness" | "coverage" | "lastSuccessfulRun" | "lastUpdated" | "runId";
  label: string;
  value: string;
};

export function resolveSettingsScreenState(input: {
  walletStatus: "connected" | "connecting" | "reconnecting" | "disconnected";
  isConnected: boolean;
  isSupportedChain: boolean;
  viewModel: SettingsViewModel | null;
  isLoading: boolean;
  errorCode: string | null;
}): SettingsScreenState {
  const isWalletPending = input.walletStatus === "connecting" || input.walletStatus === "reconnecting";

  if (!input.isConnected && !isWalletPending) {
    return "disconnected";
  }

  if (!input.isSupportedChain) {
    return "unsupportedChain";
  }

  if (input.isLoading && !input.viewModel) {
    return "loading";
  }

  if (!input.viewModel && input.errorCode) {
    return "error";
  }

  if (!input.viewModel) {
    return "empty";
  }

  return "ready";
}

export function buildSettingsDiagnosticsRows(
  diagnostics: SettingsViewModel["diagnosticsSection"],
  t: (key: string) => string,
): SettingsDiagnosticsRow[] {
  const rows: SettingsDiagnosticsRow[] = [
    {
      key: "analysisStatus",
      label: t("settings:labels.analysisStatus"),
      value: diagnostics.analysisStatusLabel,
    },
    {
      key: "overviewFreshness",
      label: t("settings:labels.overviewFreshness"),
      value: diagnostics.overviewFreshnessLabel,
    },
  ];

  if (diagnostics.coverageReasonLabels.length > 0) {
    rows.push({
      key: "coverage",
      label: t("settings:labels.coverage"),
      value: diagnostics.coverageReasonLabels.join(", "),
    });
  }

  if (diagnostics.lastSuccessfulRunAt) {
    rows.push({
      key: "lastSuccessfulRun",
      label: t("settings:labels.lastSuccessfulRun"),
      value: diagnostics.lastSuccessfulRunAt,
    });
  }

  if (diagnostics.lastUpdatedAt) {
    rows.push({
      key: "lastUpdated",
      label: t("settings:labels.lastUpdated"),
      value: diagnostics.lastUpdatedAt,
    });
  }

  if (diagnostics.runId) {
    rows.push({
      key: "runId",
      label: t("settings:labels.runId"),
      value: diagnostics.runId,
    });
  }

  return rows;
}