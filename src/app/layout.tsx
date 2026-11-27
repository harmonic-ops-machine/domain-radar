import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Domain Radar — 100k Verified Available & Expensive Domain Explorer",
  description:
    "Self-updating 100,000-domain intelligence platform with live RDAP verification timestamps, multi-source registrar & aftermarket offers, and 5-year ROI simulation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="swiss-print" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
