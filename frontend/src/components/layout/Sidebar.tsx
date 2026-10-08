"use client";

import { ChevronDown, LogOut, Mail, Moon, Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { NewBadge } from "@/components/ui/Primitives";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NAV_FOOTER, NAV_GROUPS, isActive, type NavItem } from "./nav";

function NavLink({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const comingSoon = useComingSoon();
  const active = isActive(item, path);
  const cls = cn(
    "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors",
    active ? "bg-muted font-medium text-ink" : "text-ink-3 hover:bg-muted hover:text-ink",
  );
  const body = (
    <>
      <item.icon className={cn("size-[18px]", active ? "text-ink-2" : "text-ink-4")} strokeWidth={1.75} />
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

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();
  const comingSoon = useComingSoon();
  const name = me?.name ?? "…";
  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn("flex items-center gap-2 rounded-lg py-1.5 hover:bg-muted", compact ? "px-1.5" : "px-2")}
        >
          <Avatar name={name} color={me?.avatar_color} size="sm" />
          {!compact && (
            <>
              <span className="max-w-32 truncate text-[14px] font-medium text-ink">{name}</span>
              <ChevronDown className="size-4 text-ink-4" />
            </>
          )}
        </button>
      )}
      className="w-60"
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-medium text-ink">{name}</p>
            <p className="text-xs text-ink-4">{me?.email}</p>
          </div>
          <MenuSeparator />
          <Link href="/settings" onClick={close}>
            <MenuItem icon={<Settings />}>Settings</MenuItem>
          </Link>
          <MenuItem
            icon={theme === "dark" ? <Sun /> : <Moon />}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut />} onClick={() => { close(); comingSoon("Sign out & multiple accounts"); }}>
            Sign out
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

/** Expanded app sidebar (Home, Tasks, AskFred, …). */
export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const path = usePathname();
  const comingSoon = useComingSoon();
  const [showInvite, setShowInvite] = useState(true);
  return (
    <aside className={cn("flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-sidebar", className)}>
      <div className="flex h-16 items-center px-3">
        <WorkspaceSwitcher />
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
