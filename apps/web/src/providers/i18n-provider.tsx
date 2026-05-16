"use client";

import { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";

import { initI18n } from "@/i18n/config";
import { normalizeLocale, type AppLocale } from "@/i18n/locale";

function syncDocumentLanguage(locale: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
}

function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("i18nextLng", locale);
}

type I18nProviderProps = PropsWithChildren<{
  initialLocale: AppLocale;
}>;

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [i18n] = useState(() => initI18n(initialLocale));

  useLayoutEffect(() => {
    const stored = window.localStorage.getItem("i18nextLng");
    const preferred = normalizeLocale(stored ?? initialLocale);

    if (i18n.language !== preferred) {
      void i18n.changeLanguage(preferred);
    }

    syncDocumentLanguage(preferred);
    persistLocale(preferred);

    const onLanguageChanged = (locale: string) => {
      const normalized = normalizeLocale(locale);
      syncDocumentLanguage(normalized);
      persistLocale(normalized);
    };

    i18n.on("languageChanged", onLanguageChanged);

    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, [i18n, initialLocale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
