"use client";

import { Mail, PanelLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Button } from "@/components/ui/Button";
import { NewBadge } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { NAV_FOOTER, NAV_GROUPS, isActive, type NavItem } from "./nav";
import { ProfileMenu } from "./ProfileMenu";

function NavLink({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const comingSoon = useComingSoon();
  const active = isActive(item, path);
  const cls = cn(
    "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors",
    active ? "bg-muted font-medium text-ink" : "text-ink-3 hover:bg-muted hover:text-ink",
  );
  const body = (
    <>
      <item.icon className={cn("size-[18px]", item.accent ?? (active ? "text-ink-2" : "text-ink-4"))} strokeWidth={1.75} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && <NewBadge tone={item.badge.tone}>{item.badge.text}</NewBadge>}
    </>
  );
  if (item.href)
    return (
      <Link href={item.href} className={cls} onClick={onNavigate}>
        {body}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={() => comingSoon({ name: item.label, description: item.comingSoon })}>
      {body}
    </button>
  );
}

/** Expanded app sidebar: the mobile drawer, and the flyout opened from the rail's profile icon. */
export function Sidebar({ onNavigate, onCollapse, className }: { onNavigate?: () => void; onCollapse?: () => void; className?: string }) {
  const path = usePathname();
  const comingSoon = useComingSoon();
  const [showInvite, setShowInvite] = useState(true);
  return (
    <aside className={cn("flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-sidebar", className)}>
      <div className="flex h-16 items-center justify-between px-3">
        <ProfileMenu />
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="Collapse sidebar" className="rounded-lg p-1.5 text-ink-4 hover:bg-muted hover:text-ink">
            <PanelLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className={cn("space-y-0.5", i && "border-t border-line pt-2")}>
            {group.map((item) => (
              <NavLink key={item.label} item={item} path={path} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 px-3 pb-3">
        <button
          type="button"
          onClick={() => comingSoon({ name: "Email Assistant", description: "Fred drafts replies and follow-ups from your inbox with meeting context." })}
          className="mb-2 flex w-full items-center gap-2 rounded-lg bg-brand-soft/70 px-2.5 py-2 text-[13px] font-medium text-ink-2 hover:bg-brand-soft"
        >
          <Mail className="size-4 text-[#ea4335]" /> Try Email Assistant
        </button>
        {NAV_FOOTER.map((item) => (
          <NavLink key={item.label} item={item} path={path} onNavigate={onNavigate} />
        ))}
        {showInvite && (
          <div className="relative mt-3 rounded-xl border border-line bg-surface p-3 shadow-xs">
            <button
              aria-label="Dismiss"
              onClick={() => setShowInvite(false)}
              className="absolute top-2 right-2 rounded p-0.5 text-ink-5 hover:text-ink-3"
            >
              <X className="size-3.5" />
            </button>
            <p className="pr-4 text-[13px] text-ink-2">Invite coworkers to your Fireflies team</p>
            <Button variant="primary" size="sm" className="mt-3 w-full" onClick={() => comingSoon("Teams & sharing")}>
              Create Team
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
