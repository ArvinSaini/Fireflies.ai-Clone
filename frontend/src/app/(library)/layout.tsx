import { Suspense } from "react";
import { ChannelsPanel } from "@/components/layout/ChannelsPanel";
import { AppNav } from "@/components/layout/AppNav";

/** Meetings & Uploads: app nav (compact rail by default) + channels panel, like the Fireflies Notebook. */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden md:flex">
        <AppNav />
        <Suspense fallback={<div className="w-[280px] border-r border-line" />}>
          <ChannelsPanel />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
