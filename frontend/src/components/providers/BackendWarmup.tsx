"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

let started = false; // once per page load, even if the component remounts

/**
 * Pings the backend as soon as the app opens, on any page. The free Render instance sleeps when idle,
 * so this starts waking it while the user is still on Home, before they open anything that needs data.
 */
export function BackendWarmup() {
  useEffect(() => {
    if (started) return;
    started = true;
    api.health().catch(() => {
      /* nothing to do: data views show their own waking/error states */
    });
  }, []);
  return null;
}
