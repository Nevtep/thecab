"use client";

import { useEffect, type PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";

import { initI18n, normalizeLocale } from "@/i18n/config";

const i18n = initI18n();

export function I18nProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("i18nextLng") : null;
    const preferred = normalizeLocale(stored ?? navigator.language);

    if (i18n.language !== preferred) {
      void i18n.changeLanguage(preferred);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
