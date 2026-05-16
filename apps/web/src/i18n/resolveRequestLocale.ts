import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "@/i18n/locale";

export async function resolveRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get("i18nextLng")?.value;
  if (stored) {
    return normalizeLocale(stored);
  }

  const acceptLanguage = (await headers()).get("accept-language");
  if (acceptLanguage) {
    const first = acceptLanguage.split(",")[0]?.trim().split(";")[0];
    return normalizeLocale(first);
  }

  return DEFAULT_LOCALE;
}
