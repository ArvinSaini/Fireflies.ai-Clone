"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NAV_FOOTER, NAV_GROUPS, isActive, type NavItem } from "./nav";

function RailButton({ item, path }: { item: NavItem; path: string }) {
  const comingSoon = useComingSoon();
  const active = isActive(item, path);
  const cls = cn(
    "relative flex size-9 items-center justify-center rounded-lg transition-colors",
    active ? "bg-muted text-ink" : "text-ink-4 hover:bg-muted hover:text-ink",
  );
  const icon = (
    <>
      <item.icon className={cn("size-[18px]", item.accent)} strokeWidth={1.75} />
      {item.dot && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-success" />}
    </>
  );
  return item.href ? (
    <Link href={item.href} className={cls} title={item.label} aria-label={item.label}>
      {icon}
    </Link>
  ) : (
    <button type="button" className={cls} title={item.label} aria-label={item.label}
      onClick={() => comingSoon({ name: item.label, description: item.comingSoon })}>
      {icon}
    </button>
  );
}

/** Compact app rail, as on every page of the live app. The profile avatar expands it (see AppNav). */
export function IconRail({ onExpand }: { onExpand: () => void }) {
  const path = usePathname();
  const { data: me } = useMe();

  return (
    <aside className="flex h-full w-[60px] shrink-0 flex-col items-center border-r border-line bg-sidebar py-3">
      {/* Avatar; on hover it turns into the sidebar icon with an "Expand sidebar" tooltip, as in the live app. */}
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        className="group relative flex size-9 items-center justify-center rounded-lg hover:bg-muted"
      >
        <span className="group-hover:hidden group-focus-visible:hidden">
          <Avatar name={me?.name ?? "…"} color={me?.avatar_color} size="sm" />
        </span>
        <PanelLeft className="hidden size-[18px] text-ink-3 group-hover:block group-focus-visible:block" strokeWidth={1.75} />
        <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 rounded-lg bg-[#1d2939] px-2.5 py-1.5 text-[13px] whitespace-nowrap text-white shadow-pop group-hover:block group-focus-visible:block dark:bg-[#2b2b30]">
          Expand sidebar
        </span>
      </button>
      <nav className="mt-3 flex flex-1 flex-col items-center gap-1">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className={cn("flex flex-col items-center gap-1", i && "mt-1 border-t border-line pt-2")}>
            {group.map((item) => (
              <RailButton key={item.label} item={item} path={path} />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-1">
        {NAV_FOOTER.map((item) => (
          <RailButton key={item.label} item={item} path={path} />
        ))}
      </div>
  </aside>
);
}
