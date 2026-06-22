import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/600.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./cab-focus.css";
import "./globals.css";
import { AppProviders } from "@/app/providers";
import { resolveRequestLocale } from "@/i18n/resolveRequestLocale";

export const metadata: Metadata = {
  title: "The Cab",
  description: "Portfolio command cabin for Aerodrome on Base",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveRequestLocale();

  return (
    <html lang={locale}>
      <body className="cab-focus-root">
        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
