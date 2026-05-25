import { z } from "zod";

import { ANALYSIS_MODES } from "@/analysis/analysisStatus";
import { SUPPORTED_LOCALES } from "@/i18n/locale";
import { DEFAULT_OVERVIEW_RANGE, getRecentOverviewShell } from "@/server/overview/getRecentOverview";
import { getLatestOverviewPortfolioSnapshot } from "@/server/overview/overview.repository";
import { OVERVIEW_RANGES, type OverviewCoverageReasonCode } from "@/server/overview/overview.types";
import {
  readPreferences,
  upsertPreferences,
  type StoredUserPreference,
} from "@/server/settings/settings.repository";
import type {
  SettingsLanguage,
  SettingsPersistedPreferencePatch,
  SettingsPersistedPreferences,
  SettingsResponse,
  SettingsUpdateRequest,
} from "@/server/settings/settings.types";

const storedLanguagePreferenceSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
}).strict();

const storedOverviewRangeSchema = z.object({
  range: z.enum(OVERVIEW_RANGES),
}).strict();

const settingsPreferencePatchSchema = z.object({
  languagePreference: z.enum(SUPPORTED_LOCALES).optional(),
  defaultOverviewRange: z.enum(OVERVIEW_RANGES).optional(),
}).strict();

function resolvePersistedPreferences(
  storedPreferences: StoredUserPreference[],
  requestLocale: SettingsLanguage,
): SettingsPersistedPreferences {
  const preferences: SettingsPersistedPreferences = {
    languagePreference: requestLocale,
    defaultOverviewRange: DEFAULT_OVERVIEW_RANGE,
  };

  for (const preference of storedPreferences) {
    if (preference.key === "languagePreference") {
      const parsed = storedLanguagePreferenceSchema.safeParse(preference.valueJson);
      if (parsed.success) {
        preferences.languagePreference = parsed.data.locale;
      }
      continue;
    }

    if (preference.key === "defaultOverviewRange") {
      const parsed = storedOverviewRangeSchema.safeParse(preference.valueJson);
      if (parsed.success) {
        preferences.defaultOverviewRange = parsed.data.range;
      }
    }
  }

  return preferences;
}

function sanitizeAnalysisError(lastError: string | null): string | null {
  if (!lastError) {
    return null;
  }

  const matchedCode = lastError.match(/^([A-Z0-9_]+)/)?.[1];
  return matchedCode ?? "ANALYSIS_FAILED";
}

function readCoverageReasonCodes(snapshot: Awaited<ReturnType<typeof getLatestOverviewPortfolioSnapshot>>): OverviewCoverageReasonCode[] | null {
  const metadataJson = snapshot?.metadataJson as Record<string, unknown> | null | undefined;
  const reasonCodes = metadataJson?.reasonCodes;

  if (!Array.isArray(reasonCodes)) {
    return null;
  }

  return reasonCodes.filter((value): value is OverviewCoverageReasonCode => typeof value === "string");
}

export async function getSettings(input: {
  walletAddress: string;
  chainId: number;
  requestLocale: SettingsLanguage;
}): Promise<SettingsResponse> {
  const walletAddress = input.walletAddress.toLowerCase();
  const storedPreferences = await readPreferences({
    walletAddress,
    chainId: input.chainId,
  });
  const preferences = resolvePersistedPreferences(storedPreferences, input.requestLocale);
  const [overviewShell, latestSnapshot] = await Promise.all([
    getRecentOverviewShell({
      walletAddress,
      chainId: input.chainId,
      range: preferences.defaultOverviewRange,
    }),
    getLatestOverviewPortfolioSnapshot({
      walletAddress,
      chainId: input.chainId,
    }),
  ]);
  const coverageReasonCodes = readCoverageReasonCodes(latestSnapshot) ?? overviewShell.coverage.reasonCodes;

  return {
    walletAddress,
    chainId: input.chainId,
    preferences,
    diagnostics: {
      analysis: {
        status: overviewShell.analysis.status,
        runId: overviewShell.analysis.runId,
        lastSuccessfulRunAt: overviewShell.analysis.lastSuccessfulRunAt,
        lastUpdatedAt: overviewShell.analysis.lastUpdatedAt,
        lastError: sanitizeAnalysisError(overviewShell.analysis.lastError),
      },
      overviewFreshness: {
        label:
          overviewShell.analysis.status === "ready" || overviewShell.analysis.status === "stale"
            ? "analyzed_view"
            : "recent_view",
        lastAnalyzedAt: overviewShell.analysis.lastSuccessfulRunAt,
      },
      coverage: {
        reasonCodes: coverageReasonCodes,
      },
    },
    meta: {
      fixedForMvp: {
        currency: "USD",
        theme: "cab-dark",
      },
      supportedLanguages: SUPPORTED_LOCALES,
      supportedOverviewRanges: OVERVIEW_RANGES,
      supportedAnalysisModes: ANALYSIS_MODES,
    },
  };
}

export async function updateSettings(
  input: SettingsUpdateRequest & { requestLocale: SettingsLanguage },
): Promise<SettingsResponse> {
  const preferences = settingsPreferencePatchSchema.parse(input.preferences) satisfies SettingsPersistedPreferencePatch;

  if (Object.keys(preferences).length > 0) {
    await upsertPreferences({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      preferences,
    });
  }

  return getSettings({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    requestLocale: input.requestLocale,
  });
}