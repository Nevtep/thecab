import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cab",
  description: "Canonical ledger foundation for Aerodrome and Mellow analytics."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}