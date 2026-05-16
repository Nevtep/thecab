import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Orbitron } from "next/font/google";
import "./cab-focus.css";
import "./globals.css";
import { AppProviders } from "@/app/providers";
import { resolveRequestLocale } from "@/i18n/resolveRequestLocale";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

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
  const fontVariables = `${orbitron.variable} ${inter.variable} ${ibmPlexMono.variable}`;

  return (
    <html lang={locale} className={fontVariables}>
      <body className={`${fontVariables} cab-focus-root`}>
        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
