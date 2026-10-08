"use client";

import { Menu, X } from "lucide-react";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

/** Hamburger that opens the app sidebar as a drawer (mobile, and the full-width meeting page). */
export function NavDrawer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open navigation" className={cn("rounded-lg p-2 text-ink-3 hover:bg-muted", className)}>
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-[#0c111d]/30" onMouseDown={() => setOpen(false)}>
          <div className="animate-fade-in relative h-full w-fit" onMouseDown={(e) => e.stopPropagation()}>
            <Suspense fallback={<div className="h-full w-[240px] bg-sidebar" />}>
              <Sidebar onNavigate={() => setOpen(false)} className="shadow-pop" />
            </Suspense>
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute top-4 -right-10 rounded-lg bg-surface p-1.5 text-ink-3 shadow">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
