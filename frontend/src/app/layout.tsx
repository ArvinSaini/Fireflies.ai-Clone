import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { Providers } from "@/components/providers/Providers";
import { API_URL } from "@/lib/api";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Fireflies.ai", template: "%s | Fireflies.ai" },
  description: "Meeting notes, transcripts and AI summaries — a Fireflies.ai clone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Open the connection to the API early; BackendWarmup then wakes the server. */}
        <link rel="preconnect" href={API_URL} crossOrigin="anonymous" />
      </head>
      <body className="min-h-full text-[14px]">
        <Providers>
          {/* Banner on top, the active route fills the rest of the viewport. */}
          <div className="flex h-dvh flex-col print:block print:h-auto">
            <TrialBanner />
            <div className="min-h-0 flex-1 print:min-h-0">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
