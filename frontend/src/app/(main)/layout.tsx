import { HelpButton } from "@/components/layout/HelpButton";
import { AppNav } from "@/components/layout/AppNav";

/** Home, Tasks, AskFred, Settings…: app nav (compact rail by default), like every page of the live app. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden md:flex">
        <AppNav />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <HelpButton />
    </div>
  );
}
