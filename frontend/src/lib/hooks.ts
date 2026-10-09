"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { requestTracker } from "./api";

const noopSubscribe = () => () => {};

/** False during SSR/hydration, true afterwards — for values that only exist on the client (clock, locale). */
export const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Global keyboard shortcut, ignoring keystrokes typed into inputs unless `allowInInputs`. */
export function useHotkey(
  match: (e: KeyboardEvent) => boolean,
  handler: (e: KeyboardEvent) => void,
  { allowInInputs = false, enabled = true } = {},
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing && !allowInInputs) return;
      if (match(e)) handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

/** True once backend requests have been pending for `delayMs` without a break, e.g. while the server wakes up. */
export function useBackendSlow(delayMs = 2500): boolean {
  const since = useSyncExternalStore(requestTracker.subscribe, requestTracker.busySince, () => 0);
  const [slowRun, setSlowRun] = useState(0);
  useEffect(() => {
    if (!since) return;
    const id = setTimeout(() => setSlowRun(since), delayMs);
    return () => clearTimeout(id);
  }, [since, delayMs]);
  return since > 0 && slowRun === since;
}
