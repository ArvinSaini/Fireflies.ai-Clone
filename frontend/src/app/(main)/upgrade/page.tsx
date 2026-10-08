import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";

export const metadata: Metadata = { title: "Upgrade" };

const PLANS = [
  { name: "Free", price: "$0", note: "forever", features: ["Unlimited transcription", "Limited AI summaries", "800 mins storage"], current: true },
  { name: "Pro", price: "$10", note: "per seat / month, billed annually", features: ["Unlimited AI summaries", "AskFred", "8,000 mins storage", "Integrations"] },
  { name: "Business", price: "$19", note: "per seat / month, billed annually", features: ["Everything in Pro", "Conversation intelligence", "Video recording", "Team analytics"], featured: true },
  { name: "Enterprise", price: "$39", note: "per seat / month, billed annually", features: ["Everything in Business", "SSO & SCIM", "Custom data retention", "Dedicated support"] },
];

/** Pricing placeholder — billing is out of scope for this demo. */
export default function UpgradePage() {
  return (
    <>
      <Topbar title="Upgrade" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <div className="mx-auto max-w-[1100px] px-6 py-10 text-center">
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">40% OFF annual plans</span>
          <h1 className="mt-4 text-[28px] font-medium text-ink">Upgrade your meetings</h1>
          <p className="mt-1 text-[14px] text-ink-4">Billing isn&apos;t connected in this demo — plans are shown for reference.</p>
          <div className="mt-10 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-xl border bg-surface p-6 shadow-xs ${p.featured ? "border-brand ring-4 ring-brand-100" : "border-line"}`}>
                <p className="text-[15px] font-medium text-ink">{p.name}</p>
                <p className="mt-3 text-[30px] font-semibold text-ink">{p.price}</p>
                <p className="text-xs text-ink-4">{p.note}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.features.map((f) => <li key={f} className="flex gap-2 text-[13px] text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{f}</li>)}
                </ul>
                <span className={`mt-6 rounded-lg py-2 text-center text-[13px] font-medium ${p.current ? "border border-line text-ink-4" : "bg-brand text-white"}`}>
                  {p.current ? "Current plan" : "Coming soon"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
