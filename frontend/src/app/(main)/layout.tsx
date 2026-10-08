import { HelpButton } from "@/components/layout/HelpButton";
import { IconRail } from "@/components/layout/IconRail";

/** Home, Tasks, AskFred, Settings…: the compact icon rail, like every page of the live app. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden md:flex">
        <IconRail />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <HelpButton />
    </div>
  );
}
