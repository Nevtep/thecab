import type { Metadata } from "next";
import "./globals.css";

import { AppProviders } from "@/ui/providers/app-providers";

export const metadata: Metadata = {
  title: "The Cab",
  description: "Connected-wallet canonical ledger reconstruction for Aerodrome and Mellow analytics on Base."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}