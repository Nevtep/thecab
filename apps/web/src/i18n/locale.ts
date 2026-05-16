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
