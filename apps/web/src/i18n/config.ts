import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "@/i18n/locales/en/common.json";
import enActivity from "@/i18n/locales/en/activity.json";
import enAnalysis from "@/i18n/locales/en/analysis.json";
import enCharts from "@/i18n/locales/en/charts.json";
import enCoverage from "@/i18n/locales/en/coverage.json";
import enDeposits from "@/i18n/locales/en/deposits.json";
import enErrors from "@/i18n/locales/en/errors.json";
import enGovernance from "@/i18n/locales/en/governance.json";
import enLanding from "@/i18n/locales/en/landing.json";
import enNavigation from "@/i18n/locales/en/navigation.json";
import enOverview from "@/i18n/locales/en/overview.json";
import enPools from "@/i18n/locales/en/pools.json";
import enRewards from "@/i18n/locales/en/rewards.json";
import enSettings from "@/i18n/locales/en/settings.json";
import enStrategies from "@/i18n/locales/en/strategies.json";
import enTrust from "@/i18n/locales/en/trust.json";
import enValidation from "@/i18n/locales/en/validation.json";
import enWallet from "@/i18n/locales/en/wallet.json";
import esCommon from "@/i18n/locales/es/common.json";
import esActivity from "@/i18n/locales/es/activity.json";
import esAnalysis from "@/i18n/locales/es/analysis.json";
import esCharts from "@/i18n/locales/es/charts.json";
import esCoverage from "@/i18n/locales/es/coverage.json";
import esDeposits from "@/i18n/locales/es/deposits.json";
import esErrors from "@/i18n/locales/es/errors.json";
import esGovernance from "@/i18n/locales/es/governance.json";
import esLanding from "@/i18n/locales/es/landing.json";
import esNavigation from "@/i18n/locales/es/navigation.json";
import esOverview from "@/i18n/locales/es/overview.json";
import esPools from "@/i18n/locales/es/pools.json";
import esRewards from "@/i18n/locales/es/rewards.json";
import esSettings from "@/i18n/locales/es/settings.json";
import esStrategies from "@/i18n/locales/es/strategies.json";
import esTrust from "@/i18n/locales/es/trust.json";
import esValidation from "@/i18n/locales/es/validation.json";
import esWallet from "@/i18n/locales/es/wallet.json";

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export const DEFAULT_LOCALE = "en" as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(input?: string): AppLocale {
  if (!input) return DEFAULT_LOCALE;

  const lowered = input.toLowerCase();
  if (lowered.startsWith("es")) return "es";
  if (lowered.startsWith("en")) return "en";

  return DEFAULT_LOCALE;
}

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    landing: enLanding,
    wallet: enWallet,
    overview: enOverview,
    analysis: enAnalysis,
    pools: enPools,
    deposits: enDeposits,
    strategies: enStrategies,
    trust: enTrust,
    rewards: enRewards,
    governance: enGovernance,
    activity: enActivity,
    settings: enSettings,
    errors: enErrors,
    validation: enValidation,
    coverage: enCoverage,
    charts: enCharts,
  },
  es: {
    common: esCommon,
    navigation: esNavigation,
    landing: esLanding,
    wallet: esWallet,
    overview: esOverview,
    analysis: esAnalysis,
    pools: esPools,
    deposits: esDeposits,
    strategies: esStrategies,
    trust: esTrust,
    rewards: esRewards,
    governance: esGovernance,
    activity: esActivity,
    settings: esSettings,
    errors: esErrors,
    validation: esValidation,
    coverage: esCoverage,
    charts: esCharts,
  },
};

const namespaces = [
  "common",
  "navigation",
  "landing",
  "wallet",
  "overview",
  "analysis",
  "pools",
  "deposits",
  "strategies",
  "trust",
  "rewards",
  "governance",
  "activity",
  "settings",
  "errors",
  "validation",
  "coverage",
  "charts",
] as const;

export function initI18n() {
  if (i18n.isInitialized) return i18n;

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      defaultNS: "common",
      ns: namespaces,
      interpolation: { escapeValue: false },
      nonExplicitSupportedLngs: true,
    });

  return i18n;
}
