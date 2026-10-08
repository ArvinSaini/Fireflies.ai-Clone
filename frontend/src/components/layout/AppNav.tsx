"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { IconRail } from "./IconRail";
import { Sidebar } from "./Sidebar";

const Ctx = createContext<{ expanded: boolean; setExpanded: (v: boolean) => void }>({
  expanded: false,
  setExpanded: () => {},
});

/** Remembers whether the app nav is expanded while moving between pages (compact by default). */
export function AppNavProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <Ctx.Provider value={{ expanded, setExpanded }}>{children}</Ctx.Provider>;
}

/** Compact icon rail; clicking the profile avatar expands it in place into the full sidebar. */
export function AppNav() {
  const { expanded, setExpanded } = useContext(Ctx);
  return expanded ? <Sidebar onCollapse={() => setExpanded(false)} /> : <IconRail onExpand={() => setExpanded(true)} />;
}
