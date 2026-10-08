import type { Metadata } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { PlansView } from "@/components/upgrade/PlansView";

export const metadata: Metadata = { title: "Upgrade" };

/** Pricing (placeholder — billing is out of scope for this demo). */
export default function UpgradePage() {
  return (
    <>
      <Topbar title="Plan" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <PlansView />
      </main>
    </>
  );
}
