"use client";

import { Loader2 } from "lucide-react";
import { useBackendSlow } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Shown inside a loading section only when its backend request is unusually slow, which in the demo
 * means the free Render instance is waking up. Renders nothing on normal, fast loads.
 */
export function ServerWaking({ className }: { className?: string }) {
  const slow = useBackendSlow();
  if (!slow) return null;
  return (
    <div role="status" aria-live="polite" className={cn("flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-soft/60 px-4 py-3", className)}>
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand" />
      <div>
        <p className="text-[14px] font-medium text-ink">Waking up the server…</p>
        <p className="mt-0.5 text-[13px] text-ink-3">
          The demo backend runs on a free plan that sleeps when idle. The first load can take up to a minute; your data will appear automatically.
        </p>
      </div>
    </div>
  );
}
