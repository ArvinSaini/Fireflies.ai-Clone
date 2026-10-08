"use client";
// Pricing page (billing is out of scope: "Upgrade" opens a coming-soon dialog).
import { BadgeCheck, Check } from "lucide-react";
import { useState } from "react";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

const PLANS = [
  {
    name: "Free", blurb: "For individuals starting with Fireflies", price: { monthly: 0, annual: 0 },
    basics: ["Unlimited transcription*", "Limited AI summaries", "800 minutes of storage/seat"],
    plusTitle: "Features", plus: ["Record Zoom, Google Meet, MS Teams & more", "Transcription in 100+ languages", "AskFred on every meeting"],
  },
  {
    name: "Pro", blurb: "Best suited for individuals and small teams", price: { monthly: 18, annual: 10 },
    basics: ["Unlimited transcription", "Unlimited AI summaries", "8,000 mins of storage/seat"],
    plusTitle: "Everything in Free, plus", plus: ["Download transcripts & summaries", "Smart Search filters", "Integrations with your apps"],
  },
  {
    name: "Business", blurb: "Manage your fast growing team or business", price: { monthly: 29, annual: 19 }, popular: true,
    basics: ["Unlimited transcription", "Unlimited AI summaries", "Unlimited storage"],
    plusTitle: "Everything in Pro, plus", plus: ["Conversation intelligence", "Team analytics (for admins)", "Unlimited public & private channels"],
  },
  {
    name: "Enterprise", blurb: "For advanced security, control & support", price: { monthly: 39, annual: 39 },
    basics: ["Unlimited transcription", "Unlimited AI summaries", "Unlimited storage"],
    plusTitle: "Everything in Business, plus", plus: ["SSO & SCIM", "Custom data retention", "Dedicated support"],
  },
];

export function PlansView() {
  const comingSoon = useComingSoon();
  const [billing, setBilling] = useState<Billing>("annual");
  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10">
      <div className="text-center">
        <h1 className="text-[28px] font-medium text-ink">You are on the <span className="text-brand">Free</span> plan</h1>
        <p className="mt-1 text-[15px] text-ink-3">Upgrade to unlock unlimited AI summaries, storage and team features.</p>
        <div className="mt-8 inline-flex rounded-full border border-line bg-subtle p-1" role="radiogroup" aria-label="Billing period">
          {(["monthly", "annual"] as const).map((b) => (
            <button key={b} role="radio" aria-checked={billing === b} onClick={() => setBilling(b)}
              className={cn("flex items-center gap-2 rounded-full px-6 py-2 text-[13px] font-semibold tracking-wide uppercase",
                billing === b ? "bg-surface text-brand shadow-xs" : "text-ink-3 hover:text-ink")}>
              {b}
              {b === "annual" && <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] text-success">40% OFF</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p, i) => (
          <div key={p.name} className="flex flex-col rounded-xl border border-line bg-surface shadow-xs">
            <div className="border-b border-line p-6">
              <p className="flex items-center gap-2 text-[22px] font-medium text-brand">
                {p.name}
                {i === 0 && <BadgeCheck className="size-5" aria-label="Current plan" />}
                {p.popular && <span className="ml-auto rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">POPULAR</span>}
              </p>
              <p className="mt-2 min-h-10 text-[13px] text-ink-3">{p.blurb}</p>
              <p className="mt-4 text-[28px] font-semibold text-ink">${p.price[billing]}</p>
              <p className="text-[13px] text-ink-4">
                {i === 0 ? "Free forever" : `Per seat/month${billing === "annual" ? " billed annually" : ""}`}
              </p>
            </div>
            <ul className="space-y-2.5 border-b border-line p-6">
              {p.basics.map((f) => <li key={f} className="flex gap-2 text-[13px] text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-ink-4" />{f}</li>)}
            </ul>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-[13px] text-ink-4">{p.plusTitle}</p>
              <ul className="mt-3 flex-1 space-y-2.5">
                {p.plus.map((f) => <li key={f} className="flex gap-2 text-[13px] text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-ink-4" />{f}</li>)}
              </ul>
              {i === 0 ? (
                <span className="mt-6 rounded-lg bg-muted py-2 text-center text-[13px] font-medium text-ink-4">Current</span>
              ) : (
                <button onClick={() => comingSoon({ name: `${p.name} plan`, description: "Billing isn't connected in this demo — plans are shown for reference." })}
                  className="mt-6 rounded-lg bg-brand py-2 text-[13px] font-medium text-white hover:bg-brand-hover">
                  Upgrade
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
