"use client";

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
        <button
          type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        title={me?.name}
        className="rounded-lg p-1.5 hover:bg-muted"
      >
        <Avatar name={me?.name ?? "…"} color={me?.avatar_color} size="sm" />
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
