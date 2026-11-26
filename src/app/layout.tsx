import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Domain Radar — 100k Pattern Tracker & Value Increase Predictor",
  description:
    "Self-updating 100,000-domain intelligence platform on Vercel + Neon Postgres with pattern velocity tracking and 5-year ROI simulation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
