import { Sidebar } from "@/components/layout/Sidebar";

/** Pages with the expanded app sidebar (Home, Tasks, AskFred, Settings…). */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
