"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconRail } from "./IconRail";
import { Sidebar } from "./Sidebar";

const SLIDE_MS = 250;

const Ctx = createContext<{ expanded: boolean; setExpanded: (v: boolean) => void }>({
  expanded: false,
  setExpanded: () => {},
});

/** Remembers whether the app nav is expanded while moving between pages (compact by default). */
export function AppNavProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <Ctx.Provider value={{ expanded, setExpanded }}>{children}</Ctx.Provider>;
}

/**
 * Compact icon rail; clicking the profile avatar slides it open into the full sidebar,
 * pushing the page to the right. The width animates; the content is clipped only while sliding
 * so the account menu can overflow once it is open.
 */
export function AppNav() {
  const { expanded, setExpanded } = useContext(Ctx);
  const [showFull, setShowFull] = useState(expanded); // keep the full sidebar visible while it slides shut
  const [sliding, setSliding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const slide = (open: boolean) => {
    clearTimeout(timer.current);
    setSliding(true);
    if (open) setShowFull(true);
    setExpanded(open);
    timer.current = setTimeout(() => {
      setSliding(false);
      if (!open) setShowFull(false);
    }, SLIDE_MS);
  };

  return (
    <div
      className={cn(
        "h-full shrink-0 transition-[width] ease-out motion-reduce:transition-none",
        expanded ? "w-[240px]" : "w-[60px]",
        sliding && "overflow-hidden",
      )}
      style={{ transitionDuration: `${SLIDE_MS}ms` }}
    >
      {showFull ? <Sidebar onCollapse={() => slide(false)} /> : <IconRail onExpand={() => slide(true)} />}
    </div>
  );
}
