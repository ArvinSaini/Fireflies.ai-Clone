import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Fireflies.ai", template: "%s | Fireflies.ai" },
  description: "Meeting notes, transcripts and AI summaries — a Fireflies.ai clone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-full text-[14px]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
