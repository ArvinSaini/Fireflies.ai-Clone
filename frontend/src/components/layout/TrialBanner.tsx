"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const KEY = "ff.trialBannerDismissed";
const noop = () => () => {};
const readDismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Fireflies' top "free trial" strip. Hidden on the server (no flash after dismissal); dismissal is remembered per browser. */
export function TrialBanner() {
  const stored = useSyncExternalStore(noop, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable — hide for this visit only */
    }
  };

  return (
    <div className="relative flex h-10 shrink-0 items-center justify-center gap-2 bg-[#19143a] px-10 text-[13px] text-white print:hidden sm:text-[14px]">
      <span className="truncate">You are eligible for 7 days business plan free trial.</span>
      <Link href="/upgrade" className="inline-flex shrink-0 items-center gap-1 font-medium text-[#a48afb] hover:text-white">
        Start free trial <ArrowRight className="size-4" />
      </Link>
      <button onClick={dismiss} aria-label="Dismiss trial banner" className="absolute right-3 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  );
}
