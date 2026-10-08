"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { cn } from "@/lib/utils";
import { NAV_FOOTER, NAV_GROUPS, isActive, type NavItem } from "./nav";
import { WorkspaceSwitcher } from "./Sidebar";

function RailButton({ item, path }: { item: NavItem; path: string }) {
  const comingSoon = useComingSoon();
  const active = isActive(item, path);
  const cls = cn(
    "flex size-9 items-center justify-center rounded-lg transition-colors",
    active ? "bg-muted text-ink" : "text-ink-4 hover:bg-muted hover:text-ink",
  );
  const icon = <item.icon className="size-[18px]" strokeWidth={1.75} />;
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

/** Collapsed sidebar shown next to the channels panel on Meetings / Uploads. */
export function IconRail() {
  const path = usePathname();
  return (
    <aside className="flex h-full w-[60px] shrink-0 flex-col items-center border-r border-line bg-sidebar py-3">
      <WorkspaceSwitcher compact />
      <nav className="mt-3 flex flex-1 flex-col items-center gap-1">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className={cn("flex flex-col items-center gap-1", i && "mt-1 border-t border-line pt-2")}>
            {group.filter((item) => item.label !== "Upgrade").map((item) => (
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
