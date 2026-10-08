"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ComingSoonProvider } from "./ComingSoonProvider";
import { AppNavProvider } from "@/components/layout/AppNav";
import { CommandPaletteProvider } from "@/components/search/CommandPalette";
import { CreateMeetingProvider } from "@/components/meetings/CreateMeetingModal";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  const make = () =>
    new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } });
  // Isolated client per server render; one shared client in the browser.
  if (typeof window === "undefined") return make();
  browserQueryClient ??= make();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <ComingSoonProvider>
          <CreateMeetingProvider>
            <CommandPaletteProvider>
              <AppNavProvider>{children}</AppNavProvider>
            </CommandPaletteProvider>
          </CreateMeetingProvider>
        </ComingSoonProvider>
        <Toaster position="bottom-left" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
