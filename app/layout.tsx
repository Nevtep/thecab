import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Orbitron } from "next/font/google";
import "./globals.css";

import { AppProviders } from "@/ui/providers/app-providers";

export const metadata: Metadata = {
  title: "The Cab",
  description: "Connected-wallet canonical ledger reconstruction for Aerodrome and Mellow analytics on Base."
};

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-brand"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data"
});

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}