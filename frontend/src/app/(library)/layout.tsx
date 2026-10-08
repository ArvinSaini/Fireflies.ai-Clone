import { Suspense } from "react";
import { ChannelsPanel } from "@/components/layout/ChannelsPanel";
import { IconRail } from "@/components/layout/IconRail";

/** Meetings & Uploads: collapsed icon rail + channels panel, like the Fireflies Notebook. */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden md:flex">
        <IconRail />
        <Suspense fallback={<div className="w-[280px] border-r border-line" />}>
          <ChannelsPanel />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
